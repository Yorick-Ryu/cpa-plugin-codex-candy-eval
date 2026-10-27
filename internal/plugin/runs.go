package plugin

import (
	"net/http"
	"time"
)

const modelCooldownMessage = "已跳过：所选模型处于冷却中"

func modelCooling(auth credential, model string, now time.Time) bool {
	for _, cooldown := range auth.Cooldowns {
		if cooldown.Scope != "model" || cooldown.ModelKey != model {
			continue
		}
		if !cooldown.RetryAt.IsZero() && cooldown.RetryAt.After(now) {
			return true
		}
		if cooldown.RetryAt.IsZero() && cooldown.RemainingSecond > 0 {
			return true
		}
		if cooldown.RemainingSecond > 0 {
			return true
		}
	}
	return false
}

// Call with mu held; a credential can only run one test at a time.
func credentialBusyLocked(id string) bool {
	return candyRunning[id] != nil || detectionRunning[id] != nil || pelicanRunning[id]
}

type runSummary struct {
	Started   int `json:"started"`
	Busy      int `json:"busy,omitempty"`
	Skipped   int `json:"skipped,omitempty"`
	Unchecked int `json:"unchecked,omitempty"`
}

// startRuns starts a test on each selected credential that is idle. Credentials whose model list lacks
// model get skip instead. Both callbacks run with mu held; start must launch a goroutine that calls
// tasks.Done.
func startRuns(authIDs []string, all bool, catalog map[string][]string, model string, skip func(id, reason string), start func(auth credential)) managementResponse {
	auths, err := selectedCredentials(authIDs, all)
	if err != nil {
		return jsonError(http.StatusBadGateway, err.Error())
	}
	if len(auths) == 0 {
		return jsonError(http.StatusBadRequest, "没有可测试的已启用凭证")
	}
	mu.Lock()
	defer mu.Unlock()
	if quiescing {
		return jsonError(http.StatusServiceUnavailable, "插件正在停止，请稍后重试")
	}
	summary := runSummary{}
	for _, auth := range auths {
		if credentialBusyLocked(auth.ID) {
			summary.Busy++
			continue
		}
		if modelCooling(auth, model, time.Now()) {
			skip(auth.ID, modelCooldownMessage)
			summary.Skipped++
			continue
		}
		if known, supported := credentialSupportsModel(catalog, auth.ID, model); known && !supported {
			skip(auth.ID, unsupportedModelMessage)
			summary.Skipped++
			continue
		} else if !known {
			summary.Unchecked++
		}
		summary.Started++
		tasks.Add(1)
		start(auth)
	}
	if summary.Skipped > 0 {
		_ = saveStateLocked()
	}
	return jsonResponse(http.StatusOK, summary)
}

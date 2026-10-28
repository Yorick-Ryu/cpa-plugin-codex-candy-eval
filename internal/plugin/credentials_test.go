package plugin

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"
)

func TestCredentialInventoryAndSync(t *testing.T) {
	setupTest(t)
	hostCall = func(method string, _ any) (json.RawMessage, error) {
		if method != "host.auth.list" {
			t.Fatalf("unexpected call %s", method)
		}
		return json.RawMessage(`{"files":[
			{"id":"old.json","provider":"codex","source":"file","priority":99},
			{"id":"cooling.json","provider":"codex","source":"file","status":"error","status_message":"quota exhausted","unavailable":true,"next_retry_after":"2999-01-01T00:00:00Z"},
			{"id":"recovered.json","provider":"codex","source":"file","unavailable":true,"next_retry_after":"2000-01-01T00:00:00Z"},
			{"id":"claude.json","type":"claude","source":"file","disabled":true},
			{"id":"runtime","provider":"gemini","source":"memory","label":"secret-key","email":"secret-key","account_type":"api_key","account":"synthetic-secret-key","priority":-3},
			{"id":"configured","provider":"codex","runtime_only":true,"disabled":true,"unavailable":true},
			{"provider":"codex","name":"missing-id"}]}`), nil
	}
	response := syncCredentialsResponse([]byte(`{"credentials":[{"id":"configured","provider":"codex","name":"Configured Codex","base_url":" https://example.test/v1 ","provider_name":" Codex Group ","disabled":true,"email":"must-not-sync","priority":7},{"id":"compat","provider":"openai-compatible-demo","name":"Configured Demo","priority":9}]}`))
	if response.StatusCode != 200 {
		t.Fatal(string(response.Body))
	}
	all, err := credentials()
	if err != nil || len(all) != 7 {
		t.Fatalf("credentials = %+v, %v", all, err)
	}
	for _, auth := range all {
		if want := map[string]int{"old.json": 99, "runtime": -3, "configured": 7, "compat": 9}[auth.ID]; auth.Priority != want {
			t.Fatalf("priority for %s = %d, want %d", auth.ID, auth.Priority, want)
		}
		if auth.ID == "configured" && (!auth.Disabled || auth.Unavailable || auth.Source != "ai_providers" || auth.Email != "" || auth.BaseURL != "https://example.test/v1" || auth.ProviderName != "Codex Group") {
			t.Fatalf("config merge: %+v", auth)
		}
		if auth.ID == "runtime" && (auth.Name != "synthe…-key" || auth.Email != "") {
			t.Fatalf("unsafe runtime display: %+v", auth)
		}
		if auth.ID == "cooling.json" && (!auth.Unavailable || auth.StatusMessage != "quota exhausted" || auth.NextRetryAfter.IsZero()) || auth.ID == "recovered.json" && auth.Unavailable {
			t.Fatalf("unavailable state: %+v", auth)
		}
	}
	selected, err := selectedCredentials(nil, true)
	if err != nil || len(selected) != 5 {
		t.Fatalf("selected = %+v, %v", selected, err)
	}
	selected, _ = selectedCredentials([]string{"compat", "configured", "cooling.json"}, false)
	if len(selected) != 2 {
		t.Fatalf("selection = %+v", selected)
	}
	for _, body := range []string{`{}`, `{"credentials":[{"id":"a","provider":"codex"},{"id":"a","provider":"codex"}]}`} {
		if res := syncCredentialsResponse([]byte(body)); res.StatusCode != 400 {
			t.Fatal("invalid sync accepted")
		}
	}
	if len(configuredCredentials) != 2 {
		t.Fatal("invalid sync replaced inventory")
	}
	syncCredentialsResponse([]byte(`{"credentials":[{"id":"configured","provider":"codex"},{"id":"old.json","provider":"codex","disabled":true}]}`))
	all, _ = credentials()
	for _, auth := range all {
		if auth.ID == "configured" && !auth.Disabled {
			t.Fatal("sync re-enabled a disabled host credential")
		}
		if auth.ID == "old.json" && (auth.Source != credentialSourceFile || auth.Disabled || auth.Priority != 99) {
			t.Fatal("sync overwrote an authentication file")
		}
	}
	syncCredentialsResponse([]byte(`{"credentials":[]}`))
	if len(configuredCredentials) != 0 {
		t.Fatal("removed configured credentials remained selectable")
	}
}

func TestCredentialListResponse(t *testing.T) {
	setupTest(t)
	for _, body := range []string{`null`, `{}`, `{"files":null}`, `{"files":{}}`, `{"files":[]}`} {
		hostCall = func(string, any) (json.RawMessage, error) { return json.RawMessage(body), nil }
		response := stateResponse()
		want := 502
		if body == `{"files":[]}` {
			want = 200
		}
		if response.StatusCode != want {
			t.Fatalf("body=%s status=%d, want %d", body, response.StatusCode, want)
		}
	}
}

func TestCredentialModelCatalog(t *testing.T) {
	for _, tc := range []struct {
		model            string
		catalog          []string
		known, supported bool
	}{
		{"alias", nil, false, false},
		{"alias", []string{}, true, false},
		{"alias", []string{"upstream"}, true, false},
		{"prefix/alias", []string{"alias"}, true, false},
		{"prefix/alias", []string{"prefix/alias"}, true, true},
		{"alias(high)", []string{"alias"}, true, true},
		{"alias(high)", []string{"alias(high)"}, true, true},
	} {
		known, supported := credentialSupportsModel(map[string][]string{"a": tc.catalog}, "a", tc.model)
		if known != tc.known || supported != tc.supported {
			t.Errorf("%+v: %v %v", tc, known, supported)
		}
	}
}

func TestCandyPreflightPinnedProvidersAndNone(t *testing.T) {
	setupTest(t)
	configuredCredentials["config"] = credential{ID: "config", Provider: "openai-compatible-demo", Source: "ai_providers"}
	hostCall = streamHost(func(method string, payload any) (json.RawMessage, error) {
		if method == "host.auth.list" {
			return json.RawMessage(`{"files":[{"id":"skip","provider":"claude"},{"id":"unknown","provider":"gemini"},{"id":"off","provider":"codex","disabled":true}]}`), nil
		}
		if method != "host.model.execute_stream" {
			return nil, fmt.Errorf("unexpected %s", method)
		}
		var req struct {
			ID       string `json:"auth_id"`
			Provider string `json:"forced_provider"`
		}
		raw, _ := json.Marshal(payload)
		_ = json.Unmarshal(raw, &req)
		if (req.ID != "config" || req.Provider != "openai-compatible-demo") && (req.ID != "unknown" || req.Provider != "gemini") {
			t.Errorf("unpinned or skipped request: %+v", req)
		}
		if body, _ := sentTurn(payload); body["reasoning"].(map[string]any)["effort"] != nil {
			t.Error("none sent a reasoning effort")
		}
		return mockModelResponse("21"), nil
	})
	response := candyRunResponse([]byte(`{"all":true,"model":"alias","effort":"none","runs":2,"model_catalog":{"skip":[],"config":["alias"]}}`))
	if string(response.Body) != `{"started":2,"skipped":1,"unchecked":1}` {
		t.Fatalf("run: %s", response.Body)
	}
	tasks.Wait()
	if len(candyResults["skip"]) != 1 || !candyResults["skip"][0].Skipped || candyResults["skip"][0].DurationMS != 0 {
		t.Fatal("skip was executed or not recorded")
	}
	if len(candyResults["config"]) != 2 || len(candyResults["unknown"]) != 2 || len(candyResults["off"]) != 0 {
		t.Fatal("incorrect run scope")
	}
	candyResults = map[string][]candyResult{}
	loadState()
	if !candyResults["skip"][0].Skipped || !candyResults["config"][0].OK {
		t.Fatal("new credential history was not restored")
	}
}

// Older callbacks omit model cooldowns. Even a persisted, future retry deadline
// must not overrule recovery: the host validates the pinned request's live state.
func TestCandyPreflightUsesHostStateInsteadOfCooldownHistory(t *testing.T) {
	for _, liveCooldown := range []bool{false, true} {
		t.Run(fmt.Sprintf("host_cooling_%t", liveCooldown), func(t *testing.T) {
			setupTest(t)
			now := time.Now().UTC()
			old := candyResult{Time: now, Model: "gpt-6.1-sol", Error: `host_call_failed: {"error":{"code":"model_cooldown","reset_seconds":604800}}`}
			candyResults["recovered"] = []candyResult{old, {Time: now.Add(time.Second), Model: old.Model, Skipped: true, Error: old.Error}}
			if err := saveStateLocked(); err != nil {
				t.Fatal(err)
			}
			candyResults = map[string][]candyResult{}
			loadState()
			calls := 0
			hostCall = streamHost(func(method string, payload any) (json.RawMessage, error) {
				if method == "host.auth.list" {
					return json.RawMessage(`{"files":[{"id":"recovered","provider":"codex","status":"active","unavailable":true,"next_retry_after":"2999-01-01T00:00:00Z","cooldowns":[{"scope":"model","model_key":"gpt-6.1-sol","retry_at":"2999-01-01T00:00:00Z"}]}]}`), nil
				}
				if method != "host.model.execute_stream" {
					return nil, fmt.Errorf("unexpected host call %s", method)
				}
				var req struct {
					ID string `json:"auth_id"`
				}
				raw, _ := json.Marshal(payload)
				_ = json.Unmarshal(raw, &req)
				if req.ID != "recovered" {
					t.Errorf("unpinned request: %s", req.ID)
				}
				calls++
				if liveCooldown {
					return nil, &EnvelopeError{Code: "host_call_failed", Message: `{"error":{"code":"model_cooldown","reset_seconds":3600}}`, HTTPStatus: 429}
				}
				return mockModelResponse("21"), nil
			})
			response := candyRunResponse([]byte(`{"auth_ids":["recovered"],"model":"gpt-6.1-sol","effort":"low","runs":3,"model_catalog":{"recovered":["gpt-6.1-sol"]}}`))
			tasks.Wait()
			if string(response.Body) != `{"started":1}` || calls != map[bool]int{true: 1, false: 3}[liveCooldown] {
				t.Fatalf("run=%s host calls=%d", response.Body, calls)
			}
			results := candyResults["recovered"]
			if len(results) != 2+calls || results[0].Error != old.Error || !results[1].Skipped {
				t.Fatalf("history changed: %+v", results)
			}
			last := results[len(results)-1]
			if liveCooldown && (last.Error != modelCooldownMessage || !last.Skipped || last.OK) || !liveCooldown && (!last.OK || last.Skipped || last.Error != "") {
				t.Fatalf("host result ignored: %+v", last)
			}
		})
	}
}

func TestDetectionPreflightSkipsWithoutRequests(t *testing.T) {
	setupTest(t)
	hostCall = func(method string, _ any) (json.RawMessage, error) {
		if method != "host.auth.list" {
			t.Fatalf("skipped detection executed: %s", method)
		}
		return json.RawMessage(`{"files":[{"id":"a","provider":"claude"}]}`), nil
	}
	response := detectionRunResponse([]byte(`{"all":true,"model":"gpt-5.6-sol","model_catalog":{"a":["claude-model"]}}`))
	if string(response.Body) != `{"started":0,"skipped":1}` {
		t.Fatalf("response = %s", response.Body)
	}
	if r := detectionResults["a"][0]; r.Status != "skipped" || r.Attribution != nil || r.Samples != nil {
		t.Fatalf("result = %+v", r)
	}
	detectionResults = map[string][]detectionResult{}
	loadState()
	if detectionResults["a"][0].Status != "skipped" {
		t.Fatal("skip history not persisted")
	}
}

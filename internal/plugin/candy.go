package plugin

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"time"
)

const candyMaxRuns = 10

const candyPrompt = `不使用任何外部工具回答以下问题：

在一个黑色的袋子里放有三种口味的糖果，每种糖果有两种不同的形状（圆形和五角星形，不同的形状靠手感可以分辨）。现已知不同口味的糖和不同形状的数量统计如下表。参赛者需要在活动前决定摸出的糖果数目，那么，最少取出多少个糖果才能保证手中同时拥有不同形状的苹果味和桃子味的糖？（同时手中有圆形苹果味匹配五角星桃子味糖果，或者有圆形桃子味匹配五角星苹果味糖果都满足要求）

        苹果味  桃子味  西瓜味
圆形       7      9      8
五角星形   7      6      4
`

// candyRecord is one graded answer: correct, wrong, failed or skipped. A Ciallo
// reply without a unique greeting word is inconclusive.
type candyRecord struct {
	record
	Method      string `json:"method,omitempty"`
	Verdict     string `json:"verdict,omitempty"`
	VerdictRule string `json:"verdict_rule,omitempty"`
	Effort      string `json:"effort"`
	Answer      string `json:"answer,omitempty"`
	Attempts    int    `json:"attempts,omitempty"`
}

type candyRunRequest struct {
	runRequest
	Method string `json:"method,omitempty"`
	Effort string `json:"effort"`
	Runs   int    `json:"runs"`
}

func candyRunResponse(body []byte) managementResponse {
	var req candyRunRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return jsonError(http.StatusBadRequest, "请求格式错误："+err.Error())
	}
	if req.Method != "" && req.Method != "candy" && req.Method != "ciallo" {
		return jsonError(http.StatusBadRequest, "未知测试方法")
	}
	req.Model = strings.TrimSpace(req.Model)
	req.Effort = strings.TrimSpace(req.Effort)
	if !validModelName(req.Model, true) {
		return jsonError(http.StatusBadRequest, "请选择模型")
	}
	req.Runs = min(max(req.Runs, 1), candyMaxRuns)
	return startRuns("candy", req.runRequest, req.Runs,
		func(id string) {
			records.Candies.add(id, candyRecord{record: skippedRecord(req.Model), Effort: req.Effort, Method: req.Method})
		},
		func(ctx context.Context, auth credential, p *progress) {
			mu.Lock()
			p.Method = req.Method
			mu.Unlock()
			// Each credential answers serially. Stopping ctx drops the answer it interrupts.
			for range req.Runs {
				r := evaluateCandyMethod(ctx, auth, req.Model, req.Effort, req.Method)
				if ctx.Err() != nil {
					return
				}
				mu.Lock()
				records.Candies.add(auth.ID, r)
				p.Done++
				_ = saveStateLocked()
				mu.Unlock()
				if r.Status == "skipped" {
					return
				}
			}
		})
}

// evaluateCandy grades one answer. A wrong answer is a result, so only failed requests are retried.
func evaluateCandy(ctx context.Context, auth credential, model, effort string) candyRecord {
	return evaluateCandyMethod(ctx, auth, model, effort, "")
}

func evaluateCandyMethod(ctx context.Context, auth credential, model, effort, method string) candyRecord {
	started := time.Now()
	r := candyRecord{record: newRecord(model, started), Effort: effort, Method: method}
	prompt := candyPrompt
	if method == "ciallo" {
		prompt = "ciallo"
	}
	out, attempts, err := askCodex(ctx, auth, model, effort, "", prompt, answerTimeout, nil)
	r.DurationMS, r.Attempts, r.usage = time.Since(started).Milliseconds(), attempts, out.usage
	switch {
	case isModelCooldown(err):
		r.Status, r.Error = "skipped", modelCooldownMessage
	case err != nil:
		r.Status, r.Error = "failed", truncate(err.Error(), 500)
	case hasStandalone21(out.Answer):
		r.Status, r.Answer = "correct", truncate(out.Answer, 4000)
	default:
		r.Status, r.Answer = "wrong", truncate(out.Answer, 4000)
	}
	if err == nil && method == "ciallo" {
		return withCialloVerdict(r)
	}
	return r
}

// hasStandalone21 reports whether "21" appears without adjacent digits.
func hasStandalone21(text string) bool {
	isDigit := func(i int) bool { return i >= 0 && i < len(text) && text[i] >= '0' && text[i] <= '9' }
	for i := 0; i+1 < len(text); i++ {
		if text[i] == '2' && text[i+1] == '1' && !isDigit(i-1) && !isDigit(i+2) {
			return true
		}
	}
	return false
}

const cialloVerdictRule = "ciallo-word-v1"

var replyWords = regexp.MustCompile(`[\p{L}\p{N}_]+`)

// classifyCiallo compares whole greeting words, ignoring case and surrounding
// punctuation/emoji. Neither a substring nor conflicting greetings has a verdict.
func classifyCiallo(answer string) string {
	ciallo, ciao := false, false
	for _, word := range replyWords.FindAllString(strings.ToLower(answer), -1) {
		switch word {
		case "ciallo":
			ciallo = true
		case "ciao":
			ciao = true
		}
	}
	switch {
	case ciallo && !ciao:
		return "pass"
	case ciao && !ciallo:
		return "fail"
	default:
		return "inconclusive"
	}
}

// withCialloVerdict derives grading from the saved answer. State responses apply
// the current rule to historical copies, preserving original evidence on disk.
// Request failures and skipped/cancelled runs are never reclassified as answers.
func withCialloVerdict(r candyRecord) candyRecord {
	if r.Method != "ciallo" || r.Error != "" || (r.Status != "correct" && r.Status != "wrong" && r.Status != "inconclusive") {
		return r
	}
	r.Verdict, r.VerdictRule = classifyCiallo(r.Answer), cialloVerdictRule
	switch r.Verdict {
	case "pass":
		r.Status = "correct"
	case "fail":
		r.Status = "wrong"
	default:
		r.Status = "inconclusive"
	}
	return r
}

package plugin

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

func TestClassifyCiallo(t *testing.T) {
	for _, tc := range []struct{ answer, want string }{
		{"Ciallo! 👋 What can I help you with?", "pass"},
		{"Ciallo～ 👋", "pass"},
		{"Ciallo～ 👋 What can I help you with?", "pass"},
		{"Ciallo～(∠・ω<)⌒☆", "pass"},
		{"Ciallo~(c・w<)★", "pass"},
		{" \nCIALLO！\n", "pass"},
		{"ciallo", "pass"},
		{"Ciao! 👋 What can I help you with?", "fail"},
		{"CIAO～", "fail"},
		{"Ciallo! Ciao!", "inconclusive"},
		{"Ciao! Ciallo~(c・w<)★", "inconclusive"},
		{"speciallover", "inconclusive"},
		{"ciallo123", "inconclusive"},
		{"ciao_world", "inconclusive"},
		{"", "inconclusive"},
		{"Hello!", "inconclusive"},
	} {
		if got := classifyCiallo(tc.answer); got != tc.want {
			t.Errorf("%q: got %s, want %s", tc.answer, got, tc.want)
		}
	}
}

func TestCandyRejectsUnknownMethod(t *testing.T) {
	r := candyRunResponse([]byte(`{"method":"invalid","model":"gpt-6-astra"}`))
	if r.StatusCode != 400 {
		t.Fatalf("unknown method should fail: %+v", r)
	}
}

func TestClearReplyMethodPreservesOtherHistory(t *testing.T) {
	setupTest(t)
	records.Candies["a"] = []candyRecord{{record: record{Status: "correct"}}, {Method: "candy"}, {Method: "ciallo", Verdict: "pass"}}
	if r := clearRecordsResponse("method:ciallo"); r.StatusCode != 200 {
		t.Fatal(r.StatusCode)
	}
	if len(records.Candies["a"]) != 2 {
		t.Fatal("Ciallo clear removed candy history")
	}
	records.Candies["a"] = append(records.Candies["a"], candyRecord{Method: "ciallo"})
	if r := clearRecordsResponse("method:candy"); r.StatusCode != 200 {
		t.Fatal(r.StatusCode)
	}
	if len(records.Candies["a"]) != 1 || records.Candies["a"][0].Method != "ciallo" {
		t.Fatal("candy clear removed Ciallo history")
	}
}

func TestCialloHistoryMigration(t *testing.T) {
	s, _, err := readState([]byte(`{"results":{"a":[{"time":"2026-11-03T00:00:00Z","model":"m","method":"ciallo","verdict":"pass","ok":true,"answer":"Ciallo~(c・w<)★"}]}}`))
	if err != nil {
		t.Fatal(err)
	}
	r := s.Candies["a"][0]
	if r.Method != "ciallo" || r.Verdict != "pass" || r.Status != "correct" {
		t.Fatalf("lost Ciallo history: %+v", r)
	}
}

func TestCialloRunsThroughNewEndpoint(t *testing.T) {
	setupTest(t)
	hostCall = streamHost(func(method string, payload any) (json.RawMessage, error) {
		if method == "host.auth.list" {
			return json.RawMessage(`{"files":[{"id":"a","provider":"codex"}]}`), nil
		}
		body, _ := sentTurn(payload)
		raw, _ := json.Marshal(body)
		if !bytes.Contains(raw, []byte("ciallo")) {
			t.Errorf("missing Ciallo prompt: %s", raw)
		}
		return mockModelResponse("Ciallo~(c・w<)★"), nil
	})
	response := handleManagement(managementRequest{Method: http.MethodPost, Path: managementBase + "/candy/run", Body: []byte(`{"credential_ids":["a"],"model":"m","method":"ciallo","runs":1}`)})
	if response.StatusCode != http.StatusOK {
		t.Fatal(string(response.Body))
	}
	tasks.Wait()
	r := records.Candies["a"][0]
	if r.Method != "ciallo" || r.Verdict != "pass" || r.Status != "correct" {
		t.Fatalf("Ciallo result: %+v", r)
	}
	for _, path := range []string{"/run", "/results", "/detection/run"} {
		if r := handleManagement(managementRequest{Method: http.MethodPost, Path: managementBase + path}); r.StatusCode != http.StatusNotFound {
			t.Fatalf("old route still served: %s", path)
		}
	}
}

func TestCialloNativeAndHistoricalGradingAgree(t *testing.T) {
	setupTest(t)
	auth := credential{ID: "a", Provider: "codex"}
	answers := []string{"Ciallo! 👋 What can I help you with?", "Ciallo～ 👋", "Ciallo～ 👋 What can I help you with?", "Ciao!", "Ciallo or ciao", "Hello!"}
	statuses := []string{"correct", "correct", "correct", "wrong", "inconclusive", "inconclusive"}
	for i, answer := range answers {
		hostCall = streamHost(func(_ string, _ any) (json.RawMessage, error) { return mockModelResponse(answer), nil })
		actual := evaluateCandyMethod(context.Background(), auth, "m", "low", "ciallo")
		original := candyRecord{record: record{Status: "wrong", Model: "m"}, Method: "ciallo", Verdict: "fail", Answer: answer}
		records.Candies["a"] = []candyRecord{original}
		hostCall = func(string, any) (json.RawMessage, error) {
			return json.RawMessage(`{"files":[{"id":"a","provider":"codex"}]}`), nil
		}
		response := stateResponse()
		var state struct {
			Credentials []credentialView `json:"credentials"`
		}
		if err := json.Unmarshal(response.Body, &state); err != nil || response.StatusCode != 200 {
			t.Fatalf("state: %s", response.Body)
		}
		historical := state.Credentials[0].Candies[0]
		if actual.Status != statuses[i] || historical.Status != actual.Status || historical.Verdict != actual.Verdict || historical.VerdictRule != cialloVerdictRule || historical.Answer != answer {
			t.Fatalf("%q: current=%+v historical=%+v", answer, actual, historical)
		}
		if records.Candies["a"][0] != original {
			t.Fatal("history projection rewrote saved evidence")
		}
	}
}

func TestCialloRegradingPreservesNonAnswersAndCandy(t *testing.T) {
	for _, r := range []candyRecord{
		{record: record{Status: "skipped"}, Method: "ciallo", Answer: "ciallo"},
		{record: record{Status: "failed", Error: "401 unauthorized"}, Method: "ciallo", Answer: "ciallo"},
		{record: record{Status: "cancelled"}, Method: "ciallo", Answer: "ciallo"},
		{record: record{Status: "correct"}, Method: "candy", Answer: "21"},
	} {
		if got := withCialloVerdict(r); got != r {
			t.Fatalf("changed non-answer or candy: %+v", got)
		}
	}
}

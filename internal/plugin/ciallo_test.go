package plugin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"
)

func TestClassifyCiallo(t *testing.T) {
	for _, tc := range []struct{ answer, want string }{
		{"Ciallo~(c・w<)★", "pass"},
		{" \nCiallo~(c・w<)★\n", "pass"},
		{"Ciallo!", "fail"},
		{"", "inconclusive"},
		{"Ciallo！", "inconclusive"},
		{"Ciallo~(∠・ω< )⌒★", "inconclusive"},
		{"Ciallo~(c・w<)★，这是我的回复", "pass"},
		{"答案：Ciallo!（降智）", "fail"},
		{"Ciallo! Ciallo~(c・w<)★", "pass"},
		{"The expected answer is Ciallo~(c・w<)★", "pass"},
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

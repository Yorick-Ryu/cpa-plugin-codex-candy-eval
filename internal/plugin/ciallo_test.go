package plugin

import "testing"

func TestClassifyCiallo(t *testing.T) {
	for _, tc := range []struct{ answer, want string }{
		{"Ciallo~(c・w<)★", "pass"},
		{" \nCiallo~(c・w<)★\n", "pass"},
		{"Ciallo!", "fail"},
		{"", "inconclusive"},
		{"Ciallo！", "inconclusive"},
		{"Ciallo~(∠・ω< )⌒★", "inconclusive"},
		{"Ciallo! Ciallo~(c・w<)★", "inconclusive"},
		{"The expected answer is Ciallo~(c・w<)★", "inconclusive"},
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
	candyResults["a"] = []candyResult{{OK: true}, {Method: "candy"}, {Method: "ciallo", Verdict: "pass"}}
	if r := clearHistoryResponse("method:ciallo"); r.StatusCode != 200 {
		t.Fatal(r.StatusCode)
	}
	if len(candyResults["a"]) != 2 {
		t.Fatal("Ciallo clear removed candy history")
	}
	candyResults["a"] = append(candyResults["a"], candyResult{Method: "ciallo"})
	if r := clearHistoryResponse("method:candy"); r.StatusCode != 200 {
		t.Fatal(r.StatusCode)
	}
	if len(candyResults["a"]) != 1 || candyResults["a"][0].Method != "ciallo" {
		t.Fatal("candy clear removed Ciallo history")
	}
}

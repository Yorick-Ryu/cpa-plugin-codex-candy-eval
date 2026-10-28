package plugin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
)

func TestCooldownErrorClassification(t *testing.T) {
	for _, tc := range []struct {
		err  error
		want bool
	}{
		{nil, false},
		{&EnvelopeError{Code: "model_cooldown"}, true},
		{fmt.Errorf("wrapped: %w", &EnvelopeError{Code: "host_call_failed", Message: `{"error":{"code":"model_cooldown"}}`, HTTPStatus: 429}), true},
		{&EnvelopeError{Code: "host_call_failed", Message: `{"error":{"code":"rate_limit_exceeded","message":"model_cooldown mentioned"}}`, HTTPStatus: 429}, false},
		{errors.New("model_cooldown"), false},
		{errors.New(`host_call_failed: {"error":{"code":"model_cooldown"`), false},
	} {
		if got := isModelCooldown(tc.err); got != tc.want {
			t.Fatalf("%v: got %t", tc.err, got)
		}
	}
}

func TestHostCooldownResultsAcrossTests(t *testing.T) {
	setupTest(t)
	calls := 0
	hostCall = func(method string, _ any) (json.RawMessage, error) {
		if method == "host.auth.list" {
			return json.RawMessage(`{"files":[{"id":"a","provider":"codex"}]}`), nil
		}
		if method != "host.model.execute_stream" {
			t.Fatalf("unexpected %s", method)
		}
		calls++
		return nil, &EnvelopeError{Code: "host_call_failed", Message: `{"error":{"code":"model_cooldown","reset_seconds":3600}}`, HTTPStatus: 429}
	}
	auth := credential{ID: "a", Provider: "codex"}
	if r := evaluatePelican(auth, "m", ""); !r.Skipped || r.Error != modelCooldownMessage {
		t.Fatalf("pelican: %+v", r)
	}
	response := detectionRunResponse([]byte(`{"all":true,"model":"m","concurrency":1}`))
	if response.StatusCode != 200 {
		t.Fatal(string(response.Body))
	}
	tasks.Wait()
	r := detectionResults["a"][0]
	if r.Status != "skipped" || r.Error != modelCooldownMessage || r.Attribution != nil {
		t.Fatalf("detection: %+v", r)
	}
	if calls != 1+detectionTarget {
		t.Fatalf("cooldown retried: %d calls", calls)
	}
	for _, sample := range r.Samples {
		if sample.Attempts != 1 {
			t.Fatal("cooldown probe retried")
		}
	}
	_, attempts, err := executeProbe(context.Background(), auth, "m", map[string]any{}, nil, make(chan struct{}, 1))
	if attempts != 1 || !isModelCooldown(err) {
		t.Fatalf("probe: %d %v", attempts, err)
	}
}

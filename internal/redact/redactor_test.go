package redact_test

import (
	"testing"

	"github.com/agentpcap/agentpcap/internal/redact"
	"github.com/agentpcap/agentpcap/pkg/apcap"
)

func TestRedactor(t *testing.T) {
	r := redact.New()

	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "OpenAI Key",
			input:    "client using sk-1234567890abcdef1234567890 for auth",
			expected: "client using [REDACTED_OPENAI_KEY] for auth",
		},
		{
			name:     "Google Key",
			input:    "gemini key AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q",
			expected: "gemini key [REDACTED_GOOGLE_KEY]",
		},
		{
			name:     "Anthropic Key",
			input:    "anthropic secret sk-ant-api03-abcdef1234567890abcdef1234",
			expected: "anthropic secret [REDACTED_ANTHROPIC_KEY]",
		},
		{
			name:     "Bearer Token",
			input:    "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdef",
			expected: "Authorization: Bearer [REDACTED_TOKEN]",
		},
		{
			name:     "Database URI",
			input:    "connecting to postgres://admin:supersecretpassword@db.internal:5432/agents",
			expected: "connecting to postgres://[USER]:[REDACTED_PASS]@db.internal:5432/agents",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := r.RedactText(tc.input)
			if got != tc.expected {
				t.Errorf("got %q, want %q", got, tc.expected)
			}
		})
	}
}

func TestRedactEvent(t *testing.T) {
	r := redact.New()
	ev := &apcap.Event{
		ID:        "ev-1",
		Operation: "POST /v1/chat with key sk-1234567890abcdef1234567890",
		Attributes: map[string]any{
			"authorization": "Bearer secret-token-123",
			"safe_field":    "model-gemini",
		},
		Payload: &apcap.PayloadRef{
			Preview: "my api key is AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q in body",
		},
	}

	redacted := r.RedactEvent(ev)
	if redacted.Operation != "POST /v1/chat with key [REDACTED_OPENAI_KEY]" {
		t.Errorf("operation not redacted: %s", redacted.Operation)
	}
	if redacted.Attributes["authorization"] != "[REDACTED_SENSITIVE_FIELD]" {
		t.Errorf("sensitive attribute not scrubbed: %v", redacted.Attributes["authorization"])
	}
	if redacted.Payload.Preview != "my api key is [REDACTED_GOOGLE_KEY] in body" {
		t.Errorf("payload preview not scrubbed: %s", redacted.Payload.Preview)
	}
}

func TestInspectSecrets(t *testing.T) {
	r := redact.New()
	text := "Found key sk-1234567890abcdef1234567890 in log"
	findings := r.InspectSecrets(text)
	if len(findings) == 0 {
		t.Fatal("expected secret finding, got none")
	}
	if findings[0].PatternName != "OpenAI API Key" {
		t.Errorf("unexpected pattern: %s", findings[0].PatternName)
	}
}

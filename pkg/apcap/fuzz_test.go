package apcap_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/agentpcap/agentpcap/pkg/apcap"
)

func FuzzApcapReader(f *testing.F) {
	// Seed corpus with empty or partial zip data
	f.Add([]byte{})
	f.Add([]byte("PK\x03\x04not-a-valid-zip"))
	f.Add([]byte(`{"format":"apcap"}`))

	f.Fuzz(func(t *testing.T, data []byte) {
		tempDir := t.TempDir()
		p := filepath.Join(tempDir, "fuzz.apcap")
		if err := os.WriteFile(p, data, 0600); err != nil {
			return
		}

		// Reader must NEVER panic on malformed data
		_, _ = apcap.Open(p)
	})
}

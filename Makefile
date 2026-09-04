.PHONY: all dev web test test-race lint build demo screenshots doctor clean release-check

BINARY_NAME=agentpcap

all: web build

dev:
	@echo "Starting web development server and live capture backend..."
	cd web && pnpm dev

web:
	@echo "Building web frontend..."
	cd web && pnpm install && pnpm build

build:
	@echo "Building AgentPCAP single binary..."
	go build -ldflags="-s -w" -o $(BINARY_NAME) ./cmd/agentpcap

test:
	@echo "Running unit tests..."
	go test -v ./...

test-race:
	@echo "Running race tests..."
	go test -race ./...

lint:
	@echo "Running static checks..."
	go vet ./...

demo:
	@echo "Running local multi-agent demo..."
	go run ./cmd/agentpcap demo

screenshots:
	@echo "Generating sample capture and exporting artifacts..."
	go run ./cmd/agentpcap demo --no-browser --output demo.apcap
	go run ./cmd/agentpcap report demo.apcap -o report.html
	@echo "Demo capture and standalone HTML report generated."

doctor:
	@echo "Running diagnostic health checks..."
	go run ./cmd/agentpcap doctor

clean:
	rm -f $(BINARY_NAME) $(BINARY_NAME).exe demo.apcap test_run.apcap report.html safe.apcap
	rm -rf web/dist

release-check: web lint test test-race build
	@echo "Running demo fixture verification..."
	go run ./cmd/agentpcap demo --no-browser --output demo_check.apcap
	go run ./cmd/agentpcap validate demo_check.apcap
	go run ./cmd/agentpcap explain demo_check.apcap
	go run ./cmd/agentpcap check demo_check.apcap
	rm -f demo_check.apcap
	@echo "All release checks passed successfully! Ready for v1.0.0."

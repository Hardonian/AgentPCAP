.PHONY: all build web test test-race lint demo doctor clean release-check

BINARY_NAME=agentpcap

all: web build

web:
	@echo "Building web frontend..."
	cd web && pnpm install && pnpm build

build:
	@echo "Building AgentPCAP binary..."
	go build -o $(BINARY_NAME) ./cmd/agentpcap

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

doctor:
	@echo "Running diagnostic health checks..."
	go run ./cmd/agentpcap doctor

clean:
	rm -f $(BINARY_NAME) $(BINARY_NAME).exe demo.apcap test_run.apcap report.html
	rm -rf web/dist

release-check: web lint test test-race build
	@echo "All release checks passed successfully!"

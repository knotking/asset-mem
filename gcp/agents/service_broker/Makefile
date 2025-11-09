PYTHON ?= python3
UV ?= uv
AGENT_NAME ?= service_broker_agent
PROXY_AGENT_NAME ?= proxy_agent

.PHONY: help setup sync run run-proxy lint test format clean

help:
	@echo "Available targets:"
	@echo "  setup        Install dependencies with uv (creates .venv)"
	@echo "  sync         Synchronize dependencies (uv sync)"
	@echo "  run          Run the service broker agent with ADK"
	@echo "  run-proxy    Run the proxy agent with ADK"
	@echo "  lint         Format source files with black"
	@echo "  test         Run pytest suite"
	@echo "  clean        Remove virtual environment and cache artifacts"

setup: sync

sync:
	$(UV) sync

run:
	$(UV) run adk run $(AGENT_NAME)

run-proxy:
	$(UV) run adk run $(PROXY_AGENT_NAME)

lint format:
	$(UV) run black service_broker_agent proxy_agent shared

test:
	$(UV) run pytest

clean:
	rm -rf .venv __pycache__ */__pycache__


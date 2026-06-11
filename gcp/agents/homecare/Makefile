.PHONY: help install setup clean run test deploy lint format \
	test-eval test-eval-executor-routing test-eval-conversational \
	test-eval-user-docs test-eval-checkpoint test-eval-cost \
	test-eval-shopping test-eval-service test-simulation

# Default target
.DEFAULT_GOAL := help

# Variables
PYTHON := uv run python
PYTEST := uv run pytest
AGENT_DIR := property_agent
DEPLOY_DIR := deployment

# Colors for output
COLOR_RESET := \033[0m
COLOR_BOLD := \033[1m
COLOR_GREEN := \033[32m
COLOR_YELLOW := \033[33m
COLOR_BLUE := \033[34m

define print_header
	@echo "${COLOR_BOLD}${COLOR_BLUE}=== $(1) ===${COLOR_RESET}"
endef

define print_success
	@echo "${COLOR_GREEN}✓ $(1)${COLOR_RESET}"
endef

define print_info
	@echo "${COLOR_YELLOW}ℹ $(1)${COLOR_RESET}"
endef

help: ## Show this help message
	@echo "${COLOR_BOLD}Available targets:${COLOR_RESET}"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  ${COLOR_GREEN}%-15s${COLOR_RESET} %s\n", $$1, $$2}'
	@echo ""

install: ## Install UV and dependencies
	$(call print_header,Installing Dependencies)
	@if ! command -v uv > /dev/null 2>&1; then \
		$(call print_info,Installing UV...); \
		curl -LsSf https://astral.sh/uv/install.sh | sh; \
	fi
	$(call print_info,Syncing dependencies with UV...)
	uv sync --extra dev
	$(call print_success,Dependencies installed successfully)

setup: install ## Setup the project (install dependencies and create .env)
	$(call print_header,Setting Up Project)
	@if [ ! -f .env ]; then \
		$(call print_info,Creating .env from .env.example...); \
		cp .env.example .env; \
		$(call print_warning,Please update .env with your configuration); \
	else \
		$(call print_info,.env file already exists); \
	fi
	$(call print_success,Project setup complete)

clean: ## Clean up generated files and caches
	$(call print_header,Cleaning Up)
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf .pytest_cache
	rm -rf .adk
	$(call print_success,Cleanup complete)

run: ## Run the agent locally
	$(call print_header,Running Agent)
	adk run $(AGENT_DIR)

test: ## Run unit tests (CI-safe; no live Vertex evalsets)
	$(call print_header,Running Unit Tests)
	$(PYTEST) tests/ ../../agent_framework/tests/ -v

test-all: test ## Alias for unit tests (ADK evalsets removed)

define eval_removed_msg
	@echo "${COLOR_YELLOW}ADK evalsets were removed.${COLOR_RESET}"
	@echo "  Use: make test          (unit tests, CI)"
	@echo "  Use: uv run adk web     (manual staging QA)"
	@echo "  Use: make conformance-test  (replay fixtures)"
	@exit 1
endef

test-eval test-eval-executor-routing test-eval-conversational test-eval-user-docs \
test-eval-checkpoint test-eval-cost test-eval-shopping test-eval-service test-simulation:
	$(eval_removed_msg)

CONFORMANCE_DIR := property_agent/conformance

conformance-record: ## Record conformance YAML (requires `uv run adk web` on :8000)
	$(call print_header,Recording Conformance Fixtures)
	uv run adk conformance record $(CONFORMANCE_DIR) none

conformance-test: ## Replay conformance tests (requires recordings + adk web)
	$(call print_header,Running Conformance Tests)
	uv run adk conformance test $(CONFORMANCE_DIR) --mode replay --streaming-mode none

routing-eval: ## Live routing eval vs resolve LLM (requires Vertex creds; ARGS="--filter weblog")
	$(call print_header,Running Routing Eval)
	uv run python -m property_agent.evals.routing.run_routing_eval $(ARGS)

weblog-extract: ## Draft routing/conformance cases from adk web stdout logs (ARGS="web-log*")
	$(call print_header,Extracting Weblog Cases)
	uv run python -m property_agent.evals.routing.extract_weblog_cases $(ARGS)

deploy: ## Deploy the agent to Vertex AI
	$(call print_header,Deploying Agent)
	@if [ ! -f .env ]; then \
		echo "${COLOR_YELLOW}Warning: .env file not found${COLOR_RESET}"; \
		echo "Please run 'make setup' first or create .env manually"; \
		exit 1; \
	fi
	$(PYTHON) $(DEPLOY_DIR)/deploy.py create
	$(call print_success,Agent deployed successfully)

update: ## Update the deployed agent
	$(call print_header,Updating Deployed Agent)
	@if [ ! -f .env ]; then \
		echo "${COLOR_YELLOW}Warning: .env file not found${COLOR_RESET}"; \
		echo "Please run 'make setup' first or create .env manually"; \
		exit 1; \
	fi
	$(PYTHON) $(DEPLOY_DIR)/deploy.py update
	$(call print_success,Agent updated successfully)

grant-permissions: ## Grant RAG corpus permissions
	$(call print_header,Granting Permissions)
	chmod +x $(DEPLOY_DIR)/grant_permissions.sh
	./$(DEPLOY_DIR)/grant_permissions.sh
	$(call print_success,Permissions granted)

lint: ## Run linter
	$(call print_header,Running Linter)
	uv run ruff check .
	$(call print_success,Linting complete)

format: ## Format code
	$(call print_header,Formatting Code)
	uv run ruff format .
	$(call print_success,Formatting complete)

check: ## Run linting and type checking
	$(call print_header,Running Checks)
	uv run ruff check .
	uv run mypy $(AGENT_DIR) --ignore-missing-imports
	$(call print_success,All checks passed)

type-check: ## Run type checking
	$(call print_header,Running Type Check)
	uv run mypy $(AGENT_DIR) --ignore-missing-imports

requirements: ## Generate requirements.txt from pyproject.toml
	$(call print_header,Generating Requirements)
	uv pip compile pyproject.toml -o requirements.txt
	$(call print_success,Requirements generated)

validate-agent-engine-bundle: ## Validate Agent Engine requirements and extra_packages tar
	$(call print_header,Validating Agent Engine Bundle)
	$(PYTEST) tests/test_agent_engine_bundle.py -v
	$(call print_success,Agent Engine bundle validation passed)

shell: ## Start Python shell with environment
	$(call print_header,Starting Python Shell)
	uv run python

env-activate: ## Print instructions for activating virtual environment
	@echo "${COLOR_BOLD}To activate the virtual environment:${COLOR_RESET}"
	@echo "  source .venv/bin/activate"
	@echo ""
	@echo "${COLOR_BOLD}Or use UV commands directly:${COLOR_RESET}"
	@echo "  uv run <command>"

verify: ## Verify installation and setup
	$(call print_header,Verifying Installation)
	@echo "Checking UV installation..."
	@uv --version || (echo "UV not installed. Run 'make install'" && exit 1)
	@echo "Checking Python version..."
	@uv run python --version
	@echo "Checking dependencies..."
	@uv pip list
	@echo ""
	@if [ ! -f .env ]; then \
		$(call print_info,.env file not found. Run 'make setup' to create it); \
	else \
		$(call print_success,All verifications passed); \
	fi

.PHONY: default
default: help


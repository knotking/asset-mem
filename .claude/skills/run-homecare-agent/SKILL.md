---
name: run-homecare-agent
description: Run, evaluate, customize, or deploy the Vertex AI multi-agent system under gcp/agents/homecare. Use whenever the user asks about the property/analysis/checkpoint/diy/coverage/service/shopping/cost/user_docs/knowledge_base agents, ADK, RAG corpus prep, or anything in the gcp/agents/ tree.
---

# Working with the homecare ADK agent

The agent lives at `gcp/agents/homecare/` and is built on Google's Agent Development Kit (ADK). It runs locally via `adk run` and deploys to Vertex AI Agent Engine. **All commands should be run from `gcp/agents/homecare/`** and via `make` or `uv run`, never via raw `python` from a system venv.

## Architecture in one paragraph

`property_agent/agent.py` defines a root orchestrator that delegates to **DocuLink** (`doculink_agent`). DocuLink selects among tools/sub-agents under `property_agent/sub_agents/`:

- `checkpoint_agent` — Firestore vector retrieval; optional `checkpoint_progress_agent` for parallel coverage / DIY / service / cost analysis
- `user_docs_agent` — RAG over user uploads (`context_doc_uris`)
- `knowledge_base_agent` — RAG over the shared corpus
- `diy_agent` / `service_agent` / `cost_agent` / `shopping_agent` — used in checkpoint optional-analysis and DIY orchestrator paths

The root agent + sub-agent registration is in `property_agent/agent.py` and `property_agent/__init__.py`. Prompts are in `prompts.py` files alongside each agent.

## Setup

```bash
cd gcp/agents/homecare
make setup           # installs uv if needed, runs `uv sync`, copies .env.example → .env
```

Edit `.env` and set:
- `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION` (e.g. `us-central1`)
- `RAG_CORPUS=projects/<num>/locations/us-central1/ragCorpora/<id>` — required for the user_docs / knowledge_base agents
- `AGENT_ENGINE_ID=...` — auto-filled after first `make deploy`
- API keys used by sub-agents (SerpAPI, YouTube, etc. — see `.env.example`)

You also need ADC: `gcloud auth application-default login`.

## Run locally

```bash
make run                  # adk run property_agent (CLI chat)
# or
uv run adk web            # ADK web UI; pick property_agent in the dropdown
```

Don't activate the venv manually unless you need to; `uv run` handles it.

## Evaluation

Golden eval sets are recorded from **`adk web`** and committed under `property_agent/evals/*.evalset.json`. See `property_agent/evals/README.md`. Evals hit live Vertex/Gemini and need credentials.

```bash
make test-eval              # all evals (live Vertex, ~3 min)
make test-eval-routing      # doculink_routing.evalset.json
make test-eval-docs
make test-eval-checkpoint
make test-eval-cost
make test-eval-shopping
make test-eval-service
```

Unit tests only (CI-safe): `make test` or `uv run pytest tests/ -v`.

Pass thresholds: `property_agent/evals/test_config.json`.

## Lint / type-check

```bash
make lint        # uv run ruff check .
make format      # uv run ruff format .
make check       # ruff + mypy property_agent --ignore-missing-imports
```

## Deploy

`make deploy` runs `uv run python deployment/deploy.py create` and writes `AGENT_ENGINE_ID` back into `.env`. Use `make update` for subsequent revisions of the same engine.

After the first deploy, run `make grant-permissions` once — it runs `deployment/grant_permissions.sh` which gives the AI Platform Reasoning Engine service agent the custom RAG-corpus query role.

The `REASONING_ENGINE_ID` you put in `gcp/proxy/api/.env` must match the one printed by `make deploy`. Otherwise the proxy will hit the wrong engine.

For staging/prod, the canonical path is the **`deploy-homecare-agent.yaml` GitHub Actions workflow** — `make deploy` is for local iteration / testing.

## RAG corpus

If `RAG_CORPUS` is unset, run:
```bash
uv run python property_agent/shared_libraries/prepare_corpus_and_data.py
```
This creates a corpus and uploads a sample PDF (Alphabet 10-K by default — edit `CORPUS_DISPLAY_NAME`, `PDF_URL`, etc. at the top of the script for real data). The script writes the resulting `RAG_CORPUS` value back into `.env`.

In production, the user_docs corpus is populated asynchronously by the `pubsub_to_user_docs` Cloud Function (`gcp/proxy/workers/function/user_docs/`) when users upload files via the proxy.

## Customization tips
- **Adding a sub-agent**: create a new package under `property_agent/sub_agents/<name>/` with `__init__.py`, `agent.py`, and `prompts.py`. Register it in `property_agent/agent.py` so the root orchestrator can delegate to it.
- **Changing the model**: ADK agents use `gemini-3.1-flash-lite` via `model_config.GLOBAL_GEMINI_MODEL`; direct `generate_content` call sites use `LEGACY_API_GEMINI` (`gemini-2.5-flash`).
- **Adding tools**: ADK tools are normal Python callables; attach them to the sub-agent's `tools` list in its `agent.py`.

## Common gotchas
- `uv sync` failures usually mean Python < 3.11 is on PATH. ADK + the proxy use 3.11+.
- Eval failures with "permission denied on RAG corpus" → run `make grant-permissions`.
- Don't `pip install` into the system Python — the project is uv-managed, so `uv sync` and `uv run` are the only sanctioned entry points.

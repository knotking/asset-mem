# Homecare AI Agent System

## Overview

This is a comprehensive AI agent system designed for home care and vehicle diagnostics. It provides multimodal analysis, research capabilities, service provider discovery, and product recommendations through a sophisticated multi-agent architecture.

The system uses a **single-loop orchestrator** (one executor LLM on `gemini-3.5-flash` plus deterministic chip/accept-offer routing) with a flat tool registry; checkpoint optional branches run inside `analyze_checkpoints` / `run_checkpoint_pipeline`.

**Refactor docs:** [`docs/SINGLE_LOOP_REFACTOR_PLAN.md`](docs/SINGLE_LOOP_REFACTOR_PLAN.md) (phases 0–5) · [`docs/SINGLE_LOOP_CLEANUP.md`](docs/SINGLE_LOOP_CLEANUP.md) (cleanup record)

## Quick Start

From the `gcp/agents/homecare` directory:

```bash
# Show all available commands
make help

# Setup and install dependencies
make setup

# Run the agent locally
make run

# Run unit tests
make test

# Deploy to Vertex AI
make deploy
```

For detailed usage, see sections below.

## System Architecture

### Main Orchestrator Agent (`root_agent`)

The **property agent** (`property_agent`) is the root orchestrator: deterministic pre-routing (chips, accept-offer, casual), then the executor LLM invokes **`analyze_checkpoints`**, **`list_checkpoints`**, or user-document/report tools via a **flat tool registry**.

### Sub-Agents (leaf modules and checkpoint pipeline)

- **`run_checkpoint_pipeline`**: retrieval + optional coverage / DIY / service / cost + assembler + synthesis
- **User Docs Agent**: RAG over user-uploaded documents (`context_doc_uris`)
- **DIY / Service / Cost / Shopping**: Leaf agents invoked inside the checkpoint pipeline

## Key Features

### Document & checkpoint context
- **User documents**: Context via `context_doc_uris` and user-docs RAG
- **Checkpoints**: Timeline and semantic search over property checkpoints

### Comprehensive Research
- **Internet Search**: Google Search integration for general information
- **User Documents**: Warranty and insurance information retrieval
- **Video Tutorials**: YouTube search for DIY repair guides
- **Parallel Processing**: Simultaneous execution of multiple research tools

### Service Provider Discovery
- **Local Search**: Finds service providers near user location
- **Multiple Platforms**: Searches SerpAPI and SerpAPI for comprehensive coverage
- **Detailed Information**: Contact info, locations, specialties, reviews, ratings
- **Authorization Status**: Identifies authorized vs. non-authorized service centers

### Product Recommendations
- **Shopping Agent**: Reusable agent for product recommendations across different contexts (DIY, Professional, etc.)
- **Structured Product Data**: Each product includes:
  - `item_name`: Product/item name
  - `image_url`: Product image URL
  - `vendor`: Vendor/manufacturer/store name
  - `reviews`: Number of reviews
  - `store_url`: URL to product/store page
- **Category-Based**: Shopping agent adapts based on category (DIY, Professional, etc.) provided by calling agents
- **Comprehensive Product Lists**: Essential items needed to fix specific problems
- **Shopping Guidance**: Tips for comparing prices and return policies

## Agent Details

| Attribute | Details |
|:----------|:--------|
| **Interaction Type** | Conversational with multimodal support |
| **Complexity** | Advanced multi-agent system |
| **Agent Type** | Two-hop orchestrator with flat tool registry |
| **Components** | Tools, RAG, External APIs, Multimodal Analysis |
| **Vertical** | Home Care and Vehicle Diagnostics |

## Workflow

### Input Processing
The system accepts various input types:
- **User Query**: Text description of the issue or question
- **Context Doc URIs**: GCS URLs for user uploads and attached documents (warranties, manuals, policies)
- **Checkpoint IDs**: Explicit checkpoint selection for checkpoint chat
- **Property Address / search_location**: Location for local service and cost context

### Processing Flow
1. **Root routing**: `single_loop_routing` → casual canned reply OR orchestrator LLM + flat tools
2. **Checkpoint path**: `run_checkpoint_pipeline` — retrieval, optional parallel branches, assembler, synthesis
3. **Docs path**: `user_docs_retrieval`; general questions without docs/checkpoints → orchestrator markdown only (`route=none`)
4. **Response**: Proxy merges `state_delta` into Firestore message (`contentMarkdown` + `contentJson`); clients render via `resolveMessageContentParts`

### Output Schema
```json
{
  "analysisResult": "Multimodal analysis summary",
  "researchResults": {
    "summaryOfFindings": "Research summary",
    "yourDocuments": "Warranty/insurance information",
    "googleSearch": "Internet search results",
    "youtubeSearch": "Video tutorial results"
  },
  "serviceProviderResults": {
    "serpAPIResults": [...],
    "googleSearchResults": [...]
  },
  "productRecommendationsResults": {
    "recommendedProducts": {
      "[category]": {
        "products": [
          {
            "item_name": "string",
            "image_url": "string",
            "vendor": "string",
            "reviews": "string",
            "store_url": "string"
          }
        ]
      }
    }
  },
  
}
```

## Agent Architecture

See [property_agent/ARCHITECTURE.md](property_agent/ARCHITECTURE.md) and [docs/SINGLE_LOOP_REFACTOR_PLAN.md](docs/SINGLE_LOOP_REFACTOR_PLAN.md).

### Key Features

*   **Retrieval-Augmented Generation (RAG):** Leverages [Vertex AI RAG
    Engine](https://cloud.google.com/vertex-ai/generative-ai/docs/rag-overview)
    to fetch relevant documentation.
*   **Citation Support:** Provides accurate citations for the retrieved content,
    formatted as URLs.
*   **Clear Instructions:** Adheres to strict guidelines for providing factual
    answers and proper citations.

## Setup and Installation Instructions
### Prerequisites

*   **Google Cloud Account:** You need a Google Cloud account.
*   **Python 3.9+:** Ensure you have Python 3.9 or a later version installed.
*   **UV:** Install UV (the fast Python package installer) by following the instructions: [https://github.com/astral-sh/uv](https://github.com/astral-sh/uv)
*   **Git:** Ensure you have git installed.

### Project Setup with UV

1.  **Clone the Repository:**

    ```bash
    git clone <repository-url>
    cd gcp/agents/homecare
    ```

2.  **Install UV (if not already installed):**

    ```bash
    curl -LsSf https://astral.sh/uv/install.sh | sh
    ```

    Or install via pip:
    ```bash
    pip install uv
    ```

3.  **Install Dependencies with UV:**

    ```bash
    uv sync
    ```

    This command reads the `pyproject.toml` file and installs all the necessary dependencies into a virtual environment managed by UV.

4.  **Activate the Virtual Environment:**

    ```bash
    source .venv/bin/activate
    ```

    Or use UV's built-in environment activation:

    ```bash
    uv run <command>
    ```

    UV can run commands directly in the virtual environment without explicit activation.

5.  **Set up Environment Variables:**
    Rename the file ".env.example" to ".env" 
    Follow the steps in the file to set up the environment variables.

6.  **Setup Corpus:**
    If you have an existing corpus in Vertex AI RAG Engine, please set corpus information in your .env file. For example: RAG_CORPUS='projects/123/locations/us-central1/ragCorpora/456'. 

    If you don't have a corpus setup yet, please follow "How to upload my file to my RAG corpus" section. The `prepare_corpus_and_data.py` script will automatically create a corpus (if needed) and update the `RAG_CORPUS` variable in your `.env` file with the resource name of the created or retrieved corpus.

#### How to upload my file to my RAG corpus

The `property_agent/shared_libraries/prepare_corpus_and_data.py` script helps you set up a RAG corpus and upload an initial document. By default, it downloads Alphabet's 2024 10-K PDF and uploads it to a new corpus.

1.  **Authenticate with your Google Cloud account:**
    ```bash
    gcloud auth application-default login
    ```

2.  **Set up environment variables in your `.env` file:**
    Ensure your `.env` file (copied from `.env.example`) has the following variables set:
    ```
    GOOGLE_CLOUD_PROJECT=your-project-id
    GOOGLE_CLOUD_LOCATION=your-location  # e.g., us-central1
    ```

3.  **Configure and run the preparation script:**
    *   **To use the default behavior (upload Alphabet's 10K PDF):**
        Simply run the script:
        ```bash
        python property_agent/shared_libraries/prepare_corpus_and_data.py
        ```
        This will create a corpus named `Alphabet_10K_2024_corpus` (if it doesn't exist) and upload the PDF `goog-10-k-2024.pdf` downloaded from the URL specified in the script.

    *   **To upload a different PDF from a URL:**
        a. Open the `property_agent/shared_libraries/prepare_corpus_and_data.py` file.
        b. Modify the following variables at the top of the script:
           ```python
           # --- Please fill in your configurations ---
           # ... project and location are read from .env ...
           CORPUS_DISPLAY_NAME = "Your_Corpus_Name"  # Change as needed
           CORPUS_DESCRIPTION = "Description of your corpus" # Change as needed
           PDF_URL = "https://path/to/your/document.pdf"  # URL to YOUR PDF document
           PDF_FILENAME = "your_document.pdf"  # Name for the file in the corpus
           # --- Start of the script ---
           ```
        c. Run the script:
           ```bash
           python property_agent/shared_libraries/prepare_corpus_and_data.py
           ```

    *   **To upload a local PDF file:**
        a. Open the `property_agent/shared_libraries/prepare_corpus_and_data.py` file.
        b. Modify the `CORPUS_DISPLAY_NAME` and `CORPUS_DESCRIPTION` variables as needed (see above).
        c. Modify the `main()` function at the bottom of the script to directly call `upload_pdf_to_corpus` with your local file details:
           ```python
           def main():
             initialize_vertex_ai()
             corpus = create_or_get_corpus() # Uses CORPUS_DISPLAY_NAME & CORPUS_DESCRIPTION

             # Upload your local PDF to the corpus
             local_file_path = "/path/to/your/local/file.pdf" # Set the correct path
             display_name = "Your_File_Name.pdf" # Set the desired display name
             description = "Description of your file" # Set the description

             # Ensure the file exists before uploading
             if os.path.exists(local_file_path):
                 upload_pdf_to_corpus(
                     corpus_name=corpus.name,
                     pdf_path=local_file_path,
                     display_name=display_name,
                     description=description
                 )
             else:
                 print(f"Error: Local file not found at {local_file_path}")

             # List all files in the corpus
             list_corpus_files(corpus_name=corpus.name)
           ```
        d. Run the script:
           ```bash
           python property_agent/shared_libraries/prepare_corpus_and_data.py
           ```

More details about managing data in Vertex RAG Engine can be found in the
[official documentation page](https://cloud.google.com/vertex-ai/generative-ai/docs/rag-quickstart).

## Running the Agent
You can run the agent using the ADK command or the Makefile.

### Using Makefile (Recommended)

From the `gcp/agents/homecare` directory:

```bash
# Show all available commands
make help

# Setup the project
make setup

# Run the agent locally
make run

# Run unit tests
make test

# Deploy the agent
make deploy
```

### Unit tests (`tests/`)

`make test` runs fast unit tests under `tests/` (mocked, no live Vertex). CI runs this on PRs via `.github/workflows/test-homecare-agent.yaml`.

```bash
make test
# or
uv run pytest tests/ -v
```

**Opt-in live search integration**: real YouTube via **YouTube Data API v3** (needs `YOUTUBE_API_KEY`) and real SerpAPI shopping. Shared gates and print helpers live in `tests/diy_live_helpers.py`. The same checks appear in **`tests/test_diy_external_integration.py`** (raw `youtube_search` / `product_recommendations`) and **`tests/test_diy_agent.py`** (`_youtube_for_diagnosis` / `_products_for_diagnosis` as used by the DIY orchestrator). All are **skipped** unless you enable them (so `make test` stays safe for CI):

1. Set `RUN_EXTERNAL_DIY_SEARCH_TESTS=1`.
2. For YouTube tests, set `YOUTUBE_API_KEY` (enable the YouTube Data API v3 on the key in Google Cloud Console).
3. For product tests, set `SERP_API_KEY` (same as production; `.env` is loaded when `diy_live_helpers` imports).

```bash
RUN_EXTERNAL_DIY_SEARCH_TESTS=1 uv run pytest tests/test_diy_external_integration.py tests/test_diy_agent.py -v -s -m integration_external
```

Use ``-s`` so YouTube and product rows are printed to the terminal when tests pass (without ``-s``, pytest still shows that output if a test fails).

Pytest marker: `integration_external` (see `pyproject.toml`). Details and skip reasons are also in the test file’s module docstring.

### Using ADK Directly

1.  Run agent in CLI:

    ```bash
    adk run property_agent
    ```

2.  Run agent with ADK Web UI:
    ```bash
    adk web
    ```
    Select the property_agent from the dropdown

### Example Interactions

**Example 1: Vehicle Scratch Repair**

User uploads image of car scratch with query: "How can I fix this scratch on my car?"

Agent Response:
- **Analysis**: "Significant white scratch marks on the rear quarter panel of a red vehicle"
- **Research**: DIY repair methods, paint touch-up techniques, YouTube tutorials
- **Service Providers**: Local auto body shops, paint specialists with ratings and contact info
- **Products**: Touch-up paint kits, sandpaper, primer from Amazon, Home Depot, Lowe's

**Example 2: Home Plumbing Issue**

User uploads video of leaky faucet with query: "My kitchen faucet is leaking, what should I do?"

Agent Response:
- **Analysis**: "Water dripping from kitchen faucet base, potential seal or cartridge issue"
- **Research**: Faucet repair guides, common causes, troubleshooting steps
- **Service Providers**: Local plumbers, hardware store services with reviews
- **Products**: Replacement cartridges, O-rings, tools from multiple retailers

**Example 3: Appliance Manual Query**

User uploads washing machine manual with query: "What does error code E3 mean?"

Agent Response:
- **Analysis**: "Washing machine service manual with error code definitions"
- **Research**: E3 error code meaning, troubleshooting steps, common solutions
- **Service Providers**: Appliance repair services, manufacturer service centers
- **Products**: Replacement parts, cleaning supplies if needed

## Evaluating the Agent

See **[docs/AGENT_TESTING_STRATEGY.md](docs/AGENT_TESTING_STRATEGY.md)** for the full audit, test pyramid, and phased plan.

ADK web-recorded `*.evalset.json` files and `make test-eval*` were **removed**. Use:

- **`make test`** — unit tests under `tests/` (CI on every PR)
- **`make routing-eval`** — deterministic single-loop routing dataset
- **`make routing-eval-ci`** — routing eval + baseline gate (runs in CI)
- **`make contract-check`** — contentJson schema + deterministic rubric (runs in CI)
- **`make trajectory-eval-ci`** — executor tool trajectory + baseline gate (runs in CI)
- **`make conformance-guard-ci`** — tool-boundary guard eval + baseline gate (runs in CI)
- **`make prose-judge-ci`** — Phase 4 prose judge dry-run baseline (runs in CI)
- **`make eval-dashboard`** — aggregate CI baselines + weblog latency (Phase 4)
- **`uv run adk web`** — manual staging QA against `property_agent`
- **`make conformance-web-record`** / **`make conformance-web`** — adk web with record/replay plugins
- **`make conformance-record`** / **`make conformance-test`** — ADK conformance fixtures (test uses HomeApp replay compare)

See **`property_agent/evals/README.md`** for command details.

## Deploying the Agent

### Using Makefile (Recommended)

From the `gcp/agents/homecare` directory:

```bash
# Deploy the agent (first time)
make deploy

# Update existing deployment
make update

# Grant RAG corpus permissions (required for deployed agent)
make grant-permissions
```

### Using UV Directly

The Agent can be deployed to Vertex AI Agent Engine using:

```bash
uv run python deployment/deploy.py create
```

Or to update an existing deployment:

```bash
uv run python deployment/deploy.py update
```

Or if your virtual environment is already activated:

```bash
python deployment/deploy.py create
```

After deploying the agent, you'll be able to read the following INFO log message:

```
Deployed agent to Vertex AI Agent Engine successfully, resource name: projects/<PROJECT_NUMBER>/locations/us-central1/reasoningEngines/<AGENT_ENGINE_ID>
```

Please note your Agent Engine resource name and update `.env` file accordingly as this is crucial for testing the remote agent.

You may also modify the deployment script for your use cases.

## Testing the deployed agent

After deploying the agent, follow these steps to test it:

1. **Update Environment Variables:**
   - Open your `.env` file.
   - The `AGENT_ENGINE_ID` should have been automatically updated by the `deployment/deploy.py` script when you deployed the agent. Verify that it is set correctly:
     ```
     AGENT_ENGINE_ID=projects/<PROJECT_NUMBER>/locations/us-central1/reasoningEngines/<AGENT_ENGINE_ID>
     ```

2. **Grant RAG Corpus Access Permissions:**
   - Ensure your `.env` file has the following variables set correctly:
     ```
     GOOGLE_CLOUD_PROJECT=your-project-id
     RAG_CORPUS=projects/<project-number>/locations/us-central1/ragCorpora/<corpus-id>
     ```
   - Run the permissions script:
     ```bash
     chmod +x deployment/grant_permissions.sh
     ./deployment/grant_permissions.sh
     ```
   This script will:
   - Read the environment variables from your `.env` file
   - Create a custom role with RAG Corpus query permissions
   - Grant the necessary permissions to the AI Platform Reasoning Engine Service Agent

3. **Test the Remote Agent:**
   - Run the test script:
     ```bash
     python deployment/run.py
     ```
   This script will:
   - Connect to your deployed agent
   - Send a series of test queries
   - Display the agent's responses with proper formatting

The test script includes example queries about Alphabet's 10-K report. You can modify the queries in `deployment/run.py` to test different aspects of your deployed agent.

## Customization

### Customize Agent
You can customize system instruction for the agent and add more tools to suit your need, for example, google search.

### Customize Vertex RAG Engine
You can read more about [official Vertex RAG Engine documentation](https://cloud.google.com/vertex-ai/generative-ai/docs/rag-quickstart) for more details on customizing corpora and data.

### Plug-in other retrieval sources
You can also integrate your preferred retrieval sources to enhance the agent's
capabilities. For instance, you can seamlessly replace or augment the existing
`VertexAiRagRetrieval` tool with a tool that utilizes Vertex AI Search or any
other retrieval mechanism. This flexibility allows you to tailor the agent to
your specific data sources and retrieval requirements.

## Disclaimer

This agent sample is provided for illustrative purposes only and is not intended for production use. It serves as a basic example of an agent and a foundational starting point for individuals or teams to develop their own agents.

This sample has not been rigorously tested, may contain bugs or limitations, and does not include features or optimizations typically required for a production environment (e.g., robust error handling, security measures, scalability, performance considerations, comprehensive logging, or advanced configuration options).

Users are solely responsible for any further development, testing, security hardening, and deployment of agents based on this sample. We recommend thorough review, testing, and the implementation of appropriate safeguards before using any derived agent in a live or critical system.
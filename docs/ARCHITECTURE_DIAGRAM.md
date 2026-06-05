# HomeApp Architecture Diagram

<img width="2752" height="1536" alt="architecture" src="https://github.com/user-attachments/assets/2f646c02-d69e-4f62-8f08-a3b23460032d" />


A visual representation of the HomeApp platform architecture, showing the relationships between frontend applications, backend services, and AI components.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    HOMEAPP PLATFORM                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              CLIENT APPLICATIONS                                 │   │
│  │                                                                                  │   │
│  │   ┌───────────────────┐        ┌───────────────────┐        ┌──────────────┐   │   │
│  │   │     Mobile App    │        │      Web App      │        │   Telegram   │   │   │
│  │   │     (Expo RN)     │        │    (Next.js)      │        │     Bot      │   │   │
│  │   │                   │        │                   │        │              │   │   │
│  │   │  iOS │ Android    │        │   SSR + CSR       │        │   Aiogram    │   │   │
│  │   └─────────┬─────────┘        └─────────┬─────────┘        └──────┬───────┘   │   │
│  │             │                            │                          │           │   │
│  └─────────────┼────────────────────────────┼──────────────────────────┼───────────┘   │
│                │                            │                          │               │
│                └────────────────────────────┼──────────────────────────┘               │
│                                             │                                           │
│                                             ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                                  FIREBASE LAYER                                  │   │
│  │                                                                                  │   │
│  │   ┌───────────────────┐   ┌───────────────────┐   ┌───────────────────┐        │   │
│  │   │   Authentication  │   │    Firestore      │   │   Cloud Storage   │        │   │
│  │   │                   │   │    (Database)     │   │   (Documents)     │        │   │
│  │   │   • Email/Pass    │   │                   │   │                   │        │   │
│  │   │   • Google OAuth  │   │   • Properties    │   │   • User Uploads  │        │   │
│  │   │   • Session Mgmt  │   │   • Sessions      │   │   • Attachments   │        │   │
│  │   │                   │   │   • Messages      │   │                   │        │   │
│  │   └───────────────────┘   └───────────────────┘   └─────────┬─────────┘        │   │
│  │                                                              │                  │   │
│  └──────────────────────────────────────────────────────────────┼──────────────────┘   │
│                                                                 │                      │
│                                                                 ▼                      │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                             GOOGLE CLOUD PLATFORM                                │   │
│  │                                                                                  │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │   │                          PROXY API (Cloud Run)                          │   │   │
│  │   │                                                                         │   │   │
│  │   │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │   │
│  │   │   │  FastAPI    │  │  Webhooks   │  │  Sessions   │  │   File      │   │   │   │
│  │   │   │  Server     │  │  Handler    │  │  API        │  │   Upload    │   │   │   │
│  │   │   └─────────────┘  └─────────────┘  └─────────────┘  └──────┬──────┘   │   │   │
│  │   │                                                              │          │   │   │
│  │   └──────────────────────────────────────────────────────────────┼──────────┘   │   │
│  │                                │                                 │               │   │
│  │                                │                                 ▼               │   │
│  │   ┌────────────────────────────┴─────────────────┐   ┌──────────────────────┐   │   │
│  │   │                                              │   │     Cloud Pub/Sub    │   │   │
│  │   │           VERTEX AI AGENT ENGINE             │   │                      │   │   │
│  │   │                                              │   │  ┌────────────────┐  │   │   │
│  │   │   ┌──────────────────────────────────────┐   │   │  │  Upload Topic  │  │   │   │
│  │   │   │       ROOT PROPERTY AGENT            │   │   │  │                │  │   │   │
│  │   │   │                                      │   │   │  │  Results Topic │  │   │   │
│  │   │   │   Orchestrates routing & delegation  │   │   │  └────────┬───────┘  │   │   │
│  │   │   │                                      │   │   │           │          │   │   │
│  │   │   └──────────────┬───────────────────────┘   │   └───────────┼──────────┘   │   │
│  │   │                  │                           │               │               │   │
│  │   │     ┌────────────┴────────────┐              │               ▼               │   │
│  │   │     ▼                         ▼              │   ┌──────────────────────┐   │   │
│  │   │  ┌──────────────┐   ┌──────────────────┐    │   │  Cloud Functions     │   │   │
│  │   │  │  DOCULINK    │   │    ANALYSIS      │    │   │                      │   │   │
│  │   │  │  AGENT       │   │    AGENT         │    │   │  1. RAG Import       │   │   │
│  │   │  │              │   │                  │    │   │     Worker           │   │   │
│  │   │  │  Document    │   │  Multimodal      │    │   │                      │   │   │
│  │   │  │  Q&A         │   │  Diagnostics     │    │   │  2. Checkpoint       │   │   │
│  │   │  │              │   │                  │    │   │     Analysis Worker  │   │   │
│  │   │  └───────┬──────┘   └──────────────────┘    │   │                      │   │   │
│  │   │          │                                   │   │  3. Metrics Worker   │   │   │
│  │   │   ┌──────┴──────┐                           │   └──────────┬───────────┘   │   │
│  │   │   ▼             ▼                           │              │               │   │
│  │   │ ┌──────────┐ ┌─────────────────┐            │              │               │   │
│  │   │ │CHECKPOINT│ │KNOWLEDGE BASE   │            │              │               │   │
│  │   │ │ AGENT    │ │  AGENT          │            │              │               │   │
│  │   │ │          │ │                 │            │              │               │   │
│  │   │ │Timeline  │ │General          │            │              │               │   │
│  │   │ │Queries + │ │RAG Corpus       │            │              │               │   │
│  │   │ │Analysis* │ │                 │            │              │               │   │
│  │   │ └────┬─────┘ └────────┬────────┘            │              │               │   │
│  │   │      │                │                     │              │               │   │
│  │   │      │  ┌─────────────┴──────┐              │              │               │   │
│  │   │      │  │   USER DOCS AGENT  │              │              │               │   │
│  │   │      │  │   (User Uploads)   │              │              │               │   │
│  │   │      │  └────────────────────┘              │              │               │   │
│  │   │      │                                      │              │               │   │
│  │   │      ▼ run_checkpoint_pipeline (tool)      │              │               │   │
│  │   │   ┌────────────────────────────────┐       │              │               │   │
│  │   │   │  Optional branches inside:     │       │              │               │   │
│  │   │   │  • coverage / diy / service    │       │              │               │   │
│  │   │   │  • cost (Python pipelines)     │       │              │               │   │
│  │   │   └────────────────────────────────┘       │              │               │   │
│  │   │      │                │                     │              │               │   │
│  │   └──────┼────────────────┼─────────────────────┘              │               │   │
│  │          │                │                                    │               │   │
│  │          ▼                ▼                                    │               │   │
│  │   ┌─────────────────────────────────────────────────────────────────────────┐   │   │
│  │   │                        VERTEX AI RAG ENGINE                             │   │   │
│  │   │                                                                         │   │   │
│  │   │   ┌────────────────────────┐    ┌────────────────────────────────┐     │   │   │
│  │   │   │   User Upload Corpus   │◄───│   Knowledge Base Corpus        │     │   │   │
│  │   │   │                        │    │                                │     │   │   │
│  │   │   │   • Property docs      │    │   • Home maintenance guides    │     │   │   │
│  │   │   │   • User manuals       │    │   • Repair instructions        │     │   │   │
│  │   │   │   • Receipts           │    │   • Product information        │     │   │   │
│  │   │   └────────────────────────┘    └────────────────────────────────┘     │   │   │
│  │   │                                                                         │   │   │
│  │   └─────────────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                                  │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture

### Frontend Layer

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               SHARED COMMON PACKAGE                             │
│                              (apps/common)                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│   │    Contexts     │  │     Types       │  │    Firebase     │                 │
│   │                 │  │                 │  │    Config       │                 │
│   │  • AuthContext  │  │  • Property     │  │                 │                 │
│   │  • Session      │  │  • Session      │  │  • Web adapter  │                 │
│   │  • Property     │  │  • Checkpoint   │  │  • Native adapt │                 │
│   │  • Checkpoint   │  │  • Message      │  │                 │                 │
│   │  • Messages     │  │  • User         │  │                 │                 │
│   │  • Documents    │  │  • Document     │  │                 │                 │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
│                                                                                  │
└──────────────────────────────────┬───────────────────────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
     ┌──────────────────────────┐   ┌──────────────────────────┐
     │       MOBILE APP         │   │         WEB APP          │
     │       (apps/mapp)        │   │       (apps/webapp)      │
     ├──────────────────────────┤   ├──────────────────────────┤
     │                          │   │                          │
     │  Framework:              │   │  Framework:              │
     │  • Expo SDK 54           │   │  • Next.js 15            │
     │  • React Native 0.81     │   │  • React 19              │
     │  • Expo Router           │   │  • App Router            │
     │                          │   │                          │
     │  Styling:                │   │  Styling:                │
     │  • NativeWind            │   │  • Tailwind CSS          │
     │  • Tailwind CSS          │   │  • Framer Motion         │
     │                          │   │                          │
     │  Components:             │   │  Components:             │
     │  • RN Primitives         │   │  • Radix UI              │
     │  • Gifted Chat           │   │  • shadcn/ui style       │
     │  • Lucide Icons          │   │  • Recharts              │
     │                          │   │                          │
     │  Platforms:              │   │  Features:               │
     │  • iOS                   │   │  • SSR + CSR             │
     │  • Android               │   │  • Server Actions        │
     │  • Web (via Expo)        │   │  • Real-time updates     │
     │                          │   │                          │
     └──────────────────────────┘   └──────────────────────────┘
```

---

### Multi-Agent System Architecture

```
                                    ┌─────────────────────────────────┐
                                    │          USER REQUEST           │
                                    │                                 │
                                    │  • user_query                   │
                                    │  • context_doc_uris (optional)  │
                                    │  • checkpoint_ids (optional)    │
                                    │  • checkpoint_optional_agents   │
                                    │  • primary_agent (checkpoint|docs)│
                                    │  • property_id / search_location │
                                    └───────────────┬─────────────────┘
                                                    │
                                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              ROOT PROPERTY AGENT                                  │
│   Single orchestrator (resolve + flat tools); casual queries answered directly    │
└───────────────────────────────────────┬───────────────────────────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                         ORCHESTRATOR LLM + FLAT TOOLS                             │
│                                                                                   │
│   Tools: run_checkpoint_pipeline | user_docs_retrieval | knowledge_base_retrieval │
│                                                                                   │
│   IF new checkpoint analysis:                                                     │
│     run_checkpoint_pipeline → retrieval → parallel branches → assembler           │
│       → synthesis → state_delta (contentJson + contentMarkdown)                   │
│   ELIF route=user_docs OR context_doc_uris:                                       │
│     user_docs_retrieval                                                           │
│   ELIF route=knowledge_base:                                                      │
│     knowledge_base_retrieval                                                      │
│                                                                                   │
│        │              │                │                                          │
│        ▼              ▼                ▼                                          │
│  ┌────────────┐ ┌───────────┐ ┌─────────────┐                                    │
│  │ Checkpoint │ │ User Docs │ │ Knowledge   │                                    │
│  │  pipeline  │ │   RAG     │ │ Base RAG    │                                    │
│  └─────┬──────┘ └─────┬─────┘ └──────┬──────┘                                    │
└────────┼──────────────┼──────────────┼────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            VERTEX AI RAG ENGINE                                  │
│                                                                                  │
│   ┌────────────────────────────┐      ┌────────────────────────────────┐        │
│   │    User Upload Corpus      │      │    Knowledge Base Corpus       │        │
│   │                            │      │                                │        │
│   │  Filtered by matching      │      │  General home maintenance      │        │
│   │  context_doc_uris          │      │  and repair information        │        │
│   └────────────────────────────┘      └────────────────────────────────┘        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

### Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DOCUMENT UPLOAD FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

    User                  Client App              API                Cloud Services
      │                       │                    │                       │
      │  Select document      │                    │                       │
      ├──────────────────────►│                    │                       │
      │                       │                    │                       │
      │                       │ Upload to Storage  │                       │
      │                       ├───────────────────►│                       │
      │                       │                    │                       │
      │                       │                    │ Store in Cloud        │
      │                       │                    │ Storage               │
      │                       │                    ├──────────────────────►│
      │                       │                    │                       │
      │                       │                    │ Publish to Pub/Sub    │
      │                       │                    ├──────────────────────►│
      │                       │                    │                       │
      │                       │                    │        ┌──────────────┤
      │                       │                    │        │ Cloud Fn     │
      │                       │                    │        │ triggers     │
      │                       │                    │        │              │
      │                       │                    │        │ Import to    │
      │                       │                    │        │ RAG corpus   │
      │                       │                    │        │              │
      │                       │                    │◄───────┤ Publish      │
      │                       │                    │        │ result       │
      │                       │                    │        └──────────────┤
      │                       │                    │                       │
      │                       │◄───────────────────┤ Update status         │
      │◄──────────────────────┤                    │                       │
      │  Upload complete      │                    │                       │
      │                       │                    │                       │


┌─────────────────────────────────────────────────────────────────────────────────┐
│                              QUERY FLOW                                         │
└─────────────────────────────────────────────────────────────────────────────────┘

    User                  Client App              API               Agent Engine
      │                       │                    │                       │
      │  Send message         │                    │                       │
      ├──────────────────────►│                    │                       │
      │                       │                    │                       │
      │                       │ POST /chat         │                       │
      │                       ├───────────────────►│                       │
      │                       │                    │                       │
      │                       │                    │ Invoke agent          │
      │                       │                    ├──────────────────────►│
      │                       │                    │                       │
      │                       │                    │     ┌─────────────────┤
      │                       │                    │     │ Route to        │
      │                       │                    │     │ sub-agent       │
      │                       │                    │     │                 │
      │                       │                    │     │ RAG retrieval   │
      │                       │                    │     │ or analysis     │
      │                       │                    │     │                 │
      │                       │                    │◄────┤ Return          │
      │                       │                    │     │ response        │
      │                       │                    │     └─────────────────┤
      │                       │                    │                       │
      │                       │◄───────────────────┤ SSE stream /          │
      │                       │                    │ JSON response         │
      │◄──────────────────────┤                    │                       │
      │  Display response     │                    │                       │
      │                       │                    │                       │
```

---

### Checkpoint Analysis Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CHECKPOINT ANALYSIS FLOW                                │
└─────────────────────────────────────────────────────────────────────────────────┘

    User                  Client App              API               Background Workers
      │                       │                    │                       │
      │  Create Checkpoint    │                    │                       │
      ├──────────────────────►│                    │                       │
      │                       │                    │                       │
      │                       │ POST /analyze      │                       │
      │                       ├───────────────────►│                       │
      │                       │                    │                       │
      │                       │                    │ Publish to Pub/Sub    │
      │                       │                    ├──────────────────────►│
      │                       │                    │                       │
      │                       │                    │        ┌──────────────┤
      │                       │                    │        │ Analysis Fn  │
      │                       │                    │        │ triggers     │
      │                       │                    │        │              │
      │                       │                    │        │ calls Vertex │
      │                       │                    │        │ AI Vision    │
      │                       │                    │        │              │
      │                       │                    │        │ Writes to    │
      │                       │                    │        │ Firestore    │
      │                       │                    │        └──────────────┤
      │                       │                    │                       │
      │◄──────────────────────┤                    │                       │
      │  Firestore Listener   │                    │                       │
      │  Updates UI           │                    │                       │
      │                       │                    │                       │
      │                       │                    │                       │
```

---

### Infrastructure Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GOOGLE CLOUD PLATFORM                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                         COMPUTE LAYER                                     │  │
│   │                                                                           │  │
│   │   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │  │
│   │   │   Cloud Run     │   │ Cloud Functions │   │ Vertex AI           │   │  │
│   │   │                 │   │                 │   │ Reasoning Engine    │   │  │
│   │   │  • Proxy API    │   │  • RAG Import   │   │                     │   │  │
│   │   │  • Auto-scaling │   │    Worker       │   │  • Property Agent   │   │  │
│   │   │  • HTTPS        │   │  • Pub/Sub      │   │  • Sub-agents       │   │  │
│   │   │                 │   │    triggered    │   │                     │   │  │
│   │   └─────────────────┘   └─────────────────┘   └─────────────────────┘   │  │
│   │                                                                           │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                         AI/ML LAYER                                       │  │
│   │                                                                           │  │
│   │   ┌─────────────────────────────────────────────────────────────────┐    │  │
│   │   │                    Vertex AI                                     │    │  │
│   │   │                                                                  │    │  │
│   │   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │    │  │
│   │   │   │ RAG Engine   │  │ Gemini       │  │ Agent Builder        │  │    │  │
│   │   │   │              │  │ Models       │  │ (ADK)                │  │    │  │
│   │   │   │ • Embeddings │  │              │  │                      │  │    │  │
│   │   │   │ • Retrieval  │  │ • flash-lite │  │ • Multi-agent        │  │    │  │
│   │   │   │ • Ranking    │  │ • vision     │  │   orchestration      │  │    │  │
│   │   │   └──────────────┘  └──────────────┘  └──────────────────────┘  │    │  │
│   │   │                                                                  │    │  │
│   │   └─────────────────────────────────────────────────────────────────┘    │  │
│   │                                                                           │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                         DATA LAYER                                        │  │
│   │                                                                           │  │
│   │   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────┐   │  │
│   │   │  Cloud Storage  │   │    Pub/Sub      │   │  Artifact Registry  │   │  │
│   │   │                 │   │                 │   │                     │   │  │
│   │   │  • Documents    │   │  • Upload topic │   │  • Docker images    │   │  │
│   │   │  • Attachments  │   │  • Results      │   │  • API containers   │   │  │
│   │   │                 │   │    topic        │   │                     │   │  │
│   │   └─────────────────┘   └─────────────────┘   └─────────────────────┘   │  │
│   │                                                                           │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                    INFRASTRUCTURE (GitHub Actions + gcloud)                 │  │
│   │                                                                           │  │
│   │   Workflows: create-environment │ deploy-proxy │ deploy-workers │ agent  │  │
│   │                                                                           │  │
│   │   Environments:       staging          │        prod                      │  │
│   │                                                                           │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FIREBASE                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────────────────┐  │
│   │ Authentication  │   │   Firestore     │   │      Storage                │  │
│   │                 │   │   (NoSQL DB)    │   │                             │  │
│   │ • Email/Pass    │   │                 │   │  • User documents           │  │
│   │ • Google OAuth  │   │  Collections:   │   │  • Synced to GCS            │  │
│   │ • Session       │   │  • users        │   │                             │  │
│   │   management    │   │  • properties   │   │                             │  │
│   │                 │   │  • sessions     │   │                             │  │
│   │                 │   │  • messages     │   │                             │  │
│   └─────────────────┘   └─────────────────┘   └─────────────────────────────┘  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure Mapping

```
HomeApp/
│
├── apps/                           # Frontend applications
│   ├── common/                     # Shared package
│   │   ├── src/
│   │   │   ├── contexts/          # Shared React contexts
│   │   │   ├── firebase/          # Platform-specific Firebase adapters
│   │   │   └── types.ts           # Shared TypeScript types
│   │   └── package.json
│   │
│   ├── mapp/                       # Mobile app (Expo)
│   │   ├── app/                   # Expo Router pages
│   │   ├── components/            # UI components
│   │   ├── hooks/                 # Custom hooks
│   │   └── lib/                   # Utilities
│   │
│   └── webapp/                     # Web app (Next.js)
│       ├── src/
│       │   ├── app/              # Next.js App Router
│       │   ├── components/       # UI components
│       │   ├── contexts/         # Web-specific contexts
│       │   └── lib/              # Utilities
│       └── scripts/              # Migration & deployment scripts
│
└── gcp/                            # Backend services
    ├── agents/
    │   └── homecare/
    │       ├── property_agent/    # Root orchestrator
    │       │   ├── agents/        # Leaf specialists (user_docs, kb, coverage, diy, …)
    │       │   ├── checkpoint/    # pipeline, retrieval, analysis, progress_stream
    │       │   ├── routing/
    │       │   ├── runtime/       # agent.py, homecare_runner.py, vertex_app
    │       │   └── registry.py   # flat tool registry
    │       ├── tests/             # Unit tests (make test; CI on PRs)
    │       └── property_agent/evals/  # Placeholder only — ADK evalsets removed
    │
    ├── proxy/
    │   ├── api/                   # FastAPI service
    │   │   ├── main.py           # Entrypoint
    │   │   ├── firebase_api.py   # Firebase integration
    │   │   ├── telegram_api.py   # Telegram bot
    │   │   └── vertex_client.py  # Vertex AI client
    │   └── workers/              # Pub/Sub workers
    │       └── function/         # RAG import function
    │
    └── common/                    # Shared Python (token, pubsub, storage, gemini helpers)
```

**Infrastructure** lives in [`.github/workflows/`](../.github/workflows/) (`create-environment.yaml`, `deploy-*.yaml`), not under `gcp/`.

---

## Key Integration Points

| Component | Integrates With | Method |
|-----------|-----------------|--------|
| Mobile App | Firebase | Firebase SDK (native) |
| Web App | Firebase | Firebase SDK (web) |
| Mobile App | API | REST/HTTPS |
| Web App | API | REST/HTTPS + Server Actions |
| Telegram Bot | API | Webhooks |
| API | Agent Engine | Vertex AI Client |
| API | Pub/Sub | Google Cloud SDK |
| Cloud Function | RAG Engine | Vertex AI SDK |
| Agents | RAG Corpus | Vertex AI RAG API |

---

## Environment Configuration

| Environment | API Endpoint | Firebase Project | GitHub environment |
|-------------|--------------|------------------|------------------|
| Development | localhost:8080 | dev-project | — |
| Staging | Cloud Run proxy URL | staging-project | `staging` |
| Production | Cloud Run proxy URL | prod-project | `prod` |

---

## Related Documentation

- **Backend Architecture**: See [`gcp/docs/ARCHITECTURE.md`](./gcp/docs/ARCHITECTURE.md)
- **Technology Stack**: See [`TECH_STACK.md`](./TECH_STACK.md)
- **Setup Guide**: See [`gcp/docs/SETUP_AND_DEPLOYMENT.md`](./gcp/docs/SETUP_AND_DEPLOYMENT.md)
- **GitHub Actions / deploy map**: See [`.github/workflows/README.md`](../.github/workflows/README.md)
- **Deployment docs**: See [`docs/deployment/README.md`](./deployment/README.md)


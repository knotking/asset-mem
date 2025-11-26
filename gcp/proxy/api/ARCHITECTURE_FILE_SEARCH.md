# Gemini File Search Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         HomeApp System with File Search                 │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────┐        ┌──────────────┐        ┌──────────────┐
│   Web App    │        │  Mobile App  │        │   Telegram   │
│  (Next.js)   │        │ (React Native│        │     Bot      │
└──────┬───────┘        └──────┬───────┘        └──────┬───────┘
       │                       │                       │
       └───────────────────────┼───────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Firebase Auth     │
                    │   (Authentication)  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────────────────────────┐
                    │        Proxy API Layer                  │
                    │  (FastAPI - gcp/proxy/api/main.py)      │
                    │                                          │
                    │  Endpoints:                              │
                    │  • /file-search/create-store             │
                    │  • /file-search/user/* (user-scoped)     │
                    │  • /firebase-agent-query                 │
                    │  • /extract-doc-info                     │
                    │  [DEPRECATED: import-gcs-file, query]    │
                    └─────────┬────────────┬──────────┬────────┘
                              │            │          │
              ┌───────────────┘            │          └────────────────┐
              │                            │                           │
    ┌─────────▼─────────┐     ┌──────────▼──────────┐   ┌────────────▼──────────┐
    │ Gemini File Search│     │  Vertex AI Agent    │   │  Document Analysis    │
    │   (RAG Service)   │     │  Engine (Existing)  │   │   (Gemini Vision)     │
    │                   │     │                     │   │                       │
    │ gemini_file_      │     │ vertex_client.py    │   │ document_analysis.py  │
    │ search.py         │     │                     │   │                       │
    └─────────┬─────────┘     └──────────┬──────────┘   └────────────┬──────────┘
              │                          │                           │
    ┌─────────▼──────────┐              │                           │
    │   Gemini API       │              │                           │
    │  (google-genai)    │              │                           │
    │                    │              │                           │
    │ • File Search      │              │                           │
    │ • RAG Indexing     │              │                           │
    │ • Semantic Search  │              │                           │
    └─────────┬──────────┘              │                           │
              │                          │                           │
              │                ┌─────────▼─────────┐                 │
              │                │  Vertex AI RAG    │                 │
              │                │   (Existing)      │                 │
              │                │                   │                 │
              │                │ • User Docs Agent │                 │
              │                │ • Knowledge Base  │                 │
              │                └─────────┬─────────┘                 │
              │                          │                           │
              └──────────────────────────┼───────────────────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │ Google Cloud Storage│
                              │                     │
                              │ • User documents/   │
                              │ • User uploads/     │
                              │ • Telegram-uploads/ │
                              └─────────────────────┘
```

## Component Architecture

### 1. Gemini File Search Module

```
┌────────────────────────────────────────────────────────────────┐
│                  gemini_file_search.py                         │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │        GeminiFileSearchManager                        │    │
│  │                                                        │    │
│  │  Public Methods:                                       │    │
│  │  • create_file_search_store(display_name)            │    │
│  │  • list_file_search_stores()                         │    │
│  │  • delete_file_search_store(store_name)              │    │
│  │  • upload_file_to_store(file_path, store_name)       │    │
│  │  • import_gcs_file_to_store(gcs_uri, store_name)     │    │
│  │  • query_file_search(query, store_names)             │    │
│  │  • get_operation_status(operation_name)              │    │
│  │                                                        │    │
│  │  Private Methods:                                      │    │
│  │  • _extract_grounding_chunks(metadata)               │    │
│  │  • _extract_grounding_supports(metadata)             │    │
│  └──────────────────────────────────────────────────────┘    │
│                             │                                  │
│                             ▼                                  │
│                  ┌─────────────────────┐                       │
│                  │  google.genai SDK   │                       │
│                  │  (File Search API)  │                       │
│                  └─────────────────────┘                       │
└────────────────────────────────────────────────────────────────┘
```

### 2. Data Flow

#### Upload Flow

```
User Upload
    │
    ▼
┌───────────────────────┐
│ Frontend              │
│ • File picker         │
│ • Firebase Storage    │
└───────┬───────────────┘
        │ Upload to GCS
        │ gs://bucket/user_id/file.pdf
        ▼
┌───────────────────────┐
│ GCS Bucket            │
│ documents/user123/    │
└───────┬───────────────┘
        │
        │ Trigger webhook
        ▼
┌───────────────────────────────────┐
│ Proxy API [DEPRECATED]            │
│ /file-search/import-gcs-file      │
│ USE: /file-search/user/* instead  │
└───────┬───────────────────────────┘
        │
        ├──────────────────┬─────────────────┐
        │                  │                 │
        ▼                  ▼                 ▼
┌──────────────┐  ┌─────────────────┐  ┌──────────────┐
│ Gemini File  │  │ Vertex AI RAG   │  │  Document    │
│   Search     │  │  (Existing)     │  │  Analysis    │
│              │  │                 │  │  (Vision AI) │
│ • Index      │  │ • Index         │  │              │
│ • Chunk      │  │ • Embed         │  │ • Extract    │
│ • Embed      │  │                 │  │ • Classify   │
└──────────────┘  └─────────────────┘  └──────────────┘
        │                  │                 │
        └──────────────────┴─────────────────┘
                           │
                           ▼
                    File Indexed
                    Ready for Search
```

#### Query Flow (RAG)

```
User Query: "What is my property address?"
    │
    ▼
┌─────────────────────────┐
│ Frontend                │
│ • Chat interface        │
│ • Session context       │
└───────┬─────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ Proxy API [DEPRECATED]          │
│ /file-search/query              │
│ USE: Agent tools or user/* API  │
└───────┬─────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│ GeminiFileSearchManager.query_file_search()       │
│                                                   │
│ 1. Send query to Gemini API                      │
│ 2. File Search retrieves relevant chunks         │
│ 3. Gemini generates answer with citations        │
│ 4. Extract grounding metadata                    │
└───────┬───────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────┐
│ Gemini API (File Search)                         │
│                                                   │
│ ┌─────────────────────────────────────────┐     │
│ │ 1. Semantic Search                       │     │
│ │    • Query embedding                     │     │
│ │    • Vector similarity search            │     │
│ │    • Retrieve top-k chunks               │     │
│ └─────────┬───────────────────────────────┘     │
│           │                                       │
│ ┌─────────▼───────────────────────────────┐     │
│ │ 2. RAG Generation                        │     │
│ │    • Combine query + retrieved chunks    │     │
│ │    • Generate contextual answer          │     │
│ │    • Add citations                       │     │
│ └─────────┬───────────────────────────────┘     │
│           │                                       │
│ ┌─────────▼───────────────────────────────┐     │
│ │ 3. Grounding                             │     │
│ │    • Link answer segments to sources     │     │
│ │    • Include page numbers                │     │
│ │    • Add chunk excerpts                  │     │
│ └─────────┬───────────────────────────────┘     │
└───────────┼───────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│ Response                            │
│                                     │
│ {                                   │
│   text: "123 Main Street...",       │
│   grounding_metadata: {             │
│     grounding_chunks: [             │
│       {                             │
│         document_name: "Deed",      │
│         page_number: 1,             │
│         chunk_text: "..."           │
│       }                             │
│     ]                               │
│   }                                 │
│ }                                   │
└───────┬─────────────────────────────┘
        │
        ▼
    Frontend Display
    • Answer with citations
    • Source documents
    • Page references
```

### 3. Store Organization

```
Gemini File Search Stores

┌─────────────────────────────────────────────┐
│ Store: user_123_documents                   │
│ (fileSearchStores/abc123)                   │
│                                             │
│ Documents:                                  │
│  • Property Deed (deed.pdf)                 │
│  • Insurance Policy (insurance.pdf)         │
│  • Inspection Report (inspection.pdf)       │
│                                             │
│ Indexed: 3 documents                        │
│ Size: ~15 MB                                │
│ Status: Ready                               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Store: user_456_documents                   │
│ (fileSearchStores/def456)                   │
│                                             │
│ Documents:                                  │
│  • Mortgage Statement (mortgage.pdf)        │
│  • Tax Assessment (tax.pdf)                 │
│                                             │
│ Indexed: 2 documents                        │
│ Size: ~8 MB                                 │
│ Status: Ready                               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Store: property_789_docs                    │
│ (fileSearchStores/ghi789)                   │
│                                             │
│ Documents:                                  │
│  • Appraisal Report (appraisal.pdf)         │
│  • Survey (survey.pdf)                      │
│  • Title Report (title.pdf)                 │
│                                             │
│ Indexed: 3 documents                        │
│ Size: ~22 MB                                │
│ Status: Ready                               │
└─────────────────────────────────────────────┘
```

## Integration Patterns

### Pattern 1: Parallel RAG Systems

```
                    User Query
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ Gemini   │  │ Vertex   │  │ Direct   │
    │   File   │  │   AI     │  │  Agent   │
    │  Search  │  │   RAG    │  │  Query   │
    └────┬─────┘  └────┬─────┘  └────┬─────┘
         │             │             │
         └─────────────┼─────────────┘
                       │
              Router / Orchestrator
                       │
                   Response
```

**Use Cases:**
- **Gemini File Search**: User-uploaded documents, semantic Q&A
- **Vertex AI RAG**: Knowledge base, curated content
- **Direct Agent**: Real-time calculations, API calls

### Pattern 2: Document Upload Pipeline

```
1. User Uploads Document
         │
         ▼
2. Firebase Storage
         │
         ├─────────────────┐
         │                 │
         ▼                 ▼
3a. Gemini File Search  3b. Document Analysis
    • Index content         • Extract metadata
    • Enable RAG            • Classify type
         │                 │
         └────────┬────────┘
                  │
                  ▼
4. Update Firestore
   • Document metadata
   • Analysis results
   • Search readiness
```

### Pattern 3: User-Scoped Stores

```
User Session Start
        │
        ▼
Get or Create User Store
        │
        ├─── Store exists? ───→ Use existing
        │                       fileSearchStores/user_123
        │
        └─── Create new ───────→ Create store
                                fileSearchStores/user_456
                                    │
                                    ▼
                            All user queries use
                            their specific store
```

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Production Environment                   │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ Cloud Run (Proxy API)                                        │
│                                                               │
│  Environment Variables:                                       │
│  • GEMINI_API_KEY         (Gemini authentication)           │
│  • FIREBASE_WEBHOOK_SECRET (API security)                   │
│  • GOOGLE_CLOUD_BUCKET    (GCS bucket name)                 │
│  • GCP_PROJECT_ID         (Project ID)                      │
│  • REASONING_ENGINE_ID    (Vertex AI agent)                 │
│                                                               │
│  Container:                                                   │
│  • Python 3.11                                               │
│  • FastAPI                                                   │
│  • google-genai SDK                                          │
│  • google-cloud-storage                                      │
│  • Auto-scaling                                              │
└──────────┬───────────────────────────────────────────────────┘
           │
           ├──────────────┬──────────────┬──────────────┐
           │              │              │              │
┌──────────▼─────┐ ┌─────▼──────┐ ┌────▼──────┐ ┌────▼──────┐
│  Gemini API    │ │ Vertex AI  │ │    GCS    │ │ Firestore │
│  (External)    │ │            │ │           │ │           │
│                │ │ • Agent    │ │ • Files   │ │ • Users   │
│ • File Search  │ │ • RAG      │ │ • Docs    │ │ • Docs    │
└────────────────┘ └────────────┘ └───────────┘ └───────────┘
```

## Security Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Security Layers                       │
└────────────────────────────────────────────────────────┘

Layer 1: API Authentication
┌─────────────────────────────────────────────────────┐
│ Firebase Webhook Secret                             │
│ • URL path contains secret                          │
│ • Prevents unauthorized API access                  │
└─────────────────────────────────────────────────────┘
                     │
Layer 2: API Key Management
┌─────────────────────────────────────────────────────┐
│ Gemini API Key (Environment Variable)               │
│ • Stored securely in Cloud Run                      │
│ • Not exposed to clients                            │
│ • Rate limits per key                               │
└─────────────────────────────────────────────────────┘
                     │
Layer 3: User Isolation
┌─────────────────────────────────────────────────────┐
│ User-Scoped Stores                                   │
│ • Each user has separate File Search store          │
│ • Store names include user ID                       │
│ • No cross-user data access                         │
└─────────────────────────────────────────────────────┘
                     │
Layer 4: GCS Permissions
┌─────────────────────────────────────────────────────┐
│ Service Account Permissions                         │
│ • Read-only GCS access                              │
│ • Write to specific folders only                    │
│ • No public file access                             │
└─────────────────────────────────────────────────────┘
```

## Scalability & Performance

```
Performance Characteristics

┌─────────────────────────────────────────────────────┐
│ Operation          │ Latency      │ Throughput     │
├────────────────────┼──────────────┼────────────────┤
│ Create Store       │ 100-200ms    │ 100/sec        │
│ Import File (sync) │ 10-60s       │ 10/min         │
│ Import File (async)│ 100-500ms    │ 1000/min       │
│ Query (Flash)      │ 1-3s         │ 100/sec        │
│ Query (Pro)        │ 2-5s         │ 50/sec         │
└─────────────────────────────────────────────────────┘

Scaling Strategy

┌───────────────────────────────────────────────────┐
│ Horizontal Scaling (Cloud Run)                    │
│ • Auto-scale based on requests                    │
│ • Max instances: 100                              │
│ • Min instances: 1                                │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│ Gemini API Rate Limits                            │
│ • Free tier: 15 RPM (requests per minute)         │
│ • Tier 1: 360 RPM                                 │
│ • Tier 2: 1000 RPM                                │
│ • Tier 3: 4000 RPM                                │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│ Optimization Strategies                           │
│ • Async file imports for batch operations         │
│ • Use gemini-2.5-flash for most queries           │
│ • Cache common queries (if applicable)            │
│ • Batch upload operations                         │
└───────────────────────────────────────────────────┘
```

## Monitoring & Observability

```
┌─────────────────────────────────────────────────────┐
│                  Monitoring Stack                    │
└─────────────────────────────────────────────────────┘

┌───────────────────────────────────┐
│ Application Logs                  │
│ (Cloud Logging)                   │
│                                   │
│ • API requests/responses          │
│ • Error traces                    │
│ • Operation status                │
│ • Query performance               │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│ Metrics                           │
│ (Cloud Monitoring)                │
│                                   │
│ • Request count                   │
│ • Error rate                      │
│ • Latency percentiles             │
│ • Store count & size              │
└───────────────────────────────────┘

┌───────────────────────────────────┐
│ Alerts                            │
│                                   │
│ • High error rate (>5%)           │
│ • Slow queries (>10s)             │
│ • Storage limit approaching       │
│ • API quota warnings              │
└───────────────────────────────────┘
```

## Cost Structure

```
┌─────────────────────────────────────────────────────┐
│                   Cost Breakdown                     │
└─────────────────────────────────────────────────────┘

Gemini API Costs
┌─────────────────────────────────────────────────┐
│ Indexing (one-time)                             │
│ • $0.15 per 1M tokens                           │
│ • Average: $0.02-0.05 per document              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Query Costs                                     │
│ • Input tokens: $0.15/1M                        │
│ • Output tokens: $0.60/1M                       │
│ • Average query: $0.001-0.005                   │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ Storage                                         │
│ • Free (included with indexing)                 │
└─────────────────────────────────────────────────┘

Infrastructure Costs
┌─────────────────────────────────────────────────┐
│ Cloud Run                                       │
│ • ~$0.10/million requests                       │
│ • Minimal compute for proxy                    │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ GCS Storage                                     │
│ • $0.02 per GB/month (standard)                 │
└─────────────────────────────────────────────────┘

Example Monthly Cost (Medium Usage)
┌─────────────────────────────────────────────────┐
│ • 1000 documents indexed: ~$30                  │
│ • 10,000 queries: ~$20                          │
│ • Cloud Run: ~$5                                │
│ • GCS (50GB): ~$1                               │
│ ────────────────────────────────────────        │
│ Total: ~$56/month                               │
└─────────────────────────────────────────────────┘
```

## Comparison: Gemini File Search vs Vertex AI RAG

```
┌─────────────────────────────────────────────────────────────┐
│ Feature              │ Gemini File Search │ Vertex AI RAG  │
├──────────────────────┼────────────────────┼────────────────┤
│ Setup Complexity     │ Simple (API key)   │ Complex (GCP)  │
│ Cost (small scale)   │ Low ($0-50/mo)     │ Higher         │
│ Indexing Speed       │ Fast (1-2 min)     │ Fast (1-2 min) │
│ Citation Quality     │ Excellent          │ Good           │
│ File Types           │ 100+               │ Limited        │
│ Max File Size        │ 100 MB             │ Varies         │
│ Query Latency        │ 1-3s               │ 2-4s           │
│ Free Tier            │ Yes (1 GB)         │ Limited        │
│ Maintenance          │ Minimal            │ Moderate       │
│ Best For             │ User docs, Q&A     │ Enterprise KB  │
└─────────────────────────────────────────────────────────────┘

Recommendation: Use Both
• Gemini File Search: User-uploaded documents
• Vertex AI RAG: Knowledge base and curated content
```

## Future Enhancements

```
Phase 1 (Current): ✅ Complete
├─ Basic File Search integration
├─ Store management
├─ GCS file import
└─ RAG queries with citations

Phase 2 (Next Quarter): 🚧 Planned
├─ Automatic store creation on user signup
├─ Background document indexing
├─ Query result caching
└─ Usage analytics dashboard

Phase 3 (Future): 📋 Roadmap
├─ Multi-modal search (images, videos)
├─ Advanced filters and facets
├─ Custom chunking strategies
├─ Batch query operations
└─ Webhook notifications for indexing completion
```

---

## Key Takeaways

1. **Simple Integration**: Gemini File Search adds RAG with minimal code
2. **User Isolation**: Each user gets their own searchable document store
3. **Parallel Systems**: Works alongside existing Vertex AI RAG
4. **Cost Effective**: Pay per use, generous free tier
5. **Production Ready**: Comprehensive error handling and monitoring

**Status**: ✅ Deployed and operational
**Last Updated**: November 26, 2024


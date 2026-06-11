# Docs Chat Agent Overview

## Introduction

The Docs Chat Agent is a specialized AI agent that enables users to directly query their uploaded documents through the chat interface. It provides a first-class document Q&A experience with explicit routing, flexible scope control, and proper citation of sources.

## Purpose

The Docs Chat Agent serves as a dedicated document retrieval and question-answering system. It:

- **Enables Direct Document Queries**: Users can explicitly select "Docs" mode to query their document library
- **Provides Flexible Search Scope**: Supports both selected documents and all-documents search modes
- **Returns Cited Answers**: All responses include proper citations referencing source documents
- **Maintains Context**: Scopes searches to the current property and user
- **Integrates Seamlessly**: Works alongside Analysis and Checkpoint agents as a primary agent type

## Scope

The Docs Chat Agent handles document-based queries including:

### Document Content Queries
- Warranty information and coverage details
- Manual instructions and specifications
- Policy terms and conditions
- Product information and features
- Installation and setup guides
- Maintenance schedules and procedures

### Document Search
- Finding specific information across documents
- Comparing information from multiple documents
- Extracting key details from document collections
- Answering questions based on document content

### Document Types Supported
- PDF documents (manuals, warranties, policies)
- Text documents (notes, instructions)
- Scanned documents (OCR-processed)
- Any document indexed in the RAG corpus

## Architecture

The Docs Chat Agent follows a hierarchical routing pattern:

```
property_agent (resolve + executor)
└── user_docs_retrieval (when primary_agent="docs" or route=user_docs)
    └── Vertex AI RAG (semantic search)
        └── User Documents in GCS
```

### Component Breakdown

1. **property_agent**: When `primary_agent=docs`, pre-routing seeds `route=user_docs` and the executor calls `user_docs_retrieval`
2. **Executor**: Calls `user_docs_retrieval` directly (no doculink transfer)
3. **User Docs Agent**: Retrieves information from user-uploaded documents
4. **Vertex AI RAG**: Performs semantic search over document corpus
5. **GCS Storage**: Stores user documents and import metadata

## Key Features

### 1. Explicit Routing

Users can explicitly select "Docs" as the primary agent type through the UI:
- Web app: Chat settings popover
- Mobile app: Chat settings modal
- API: `primary_agent: "docs"` parameter

### 2. Dual Search Modes

**Selected Documents Mode**:
- Searches only user-selected documents
- Activated when `context_doc_uris` is provided
- Ideal for targeted queries about specific documents

**All Documents Mode**:
- Searches entire user document library
- Activated when `context_doc_uris` is empty/absent
- Ideal for broad queries across all documents

### 3. Citation System

All responses include proper citations:
```
[Answer text based on retrieved information]

Citations:
- Document Title, Section Name
- Another Document Title, Section Name
```

### 4. Property Scoping

Documents are automatically scoped to:
- Current user (via user_id)
- Current property (via property_id when available)
- Prevents cross-property information leakage

### 5. RAG-Powered Search

Uses Vertex AI RAG for semantic search:
- `similarity_top_k: 10` - Returns top 10 relevant chunks
- `vector_distance_threshold: 0.6` - Filters by relevance
- Semantic understanding of queries
- Context-aware retrieval

## Technology Stack

### AI & ML
- **Gemini 2.5 Flash**: Agent orchestration and response generation
- **Vertex AI RAG**: Document retrieval and semantic search
- **Vector Embeddings**: Document indexing and similarity search

### Infrastructure
- **Google Cloud Storage**: Document storage
- **Firestore**: Session and metadata storage
- **Cloud Run**: API deployment
- **Vertex AI Agent Builder**: Agent hosting

### Frontend
- **React (Web)**: Web application UI
- **React Native (Mobile)**: Mobile application UI
- **TypeScript**: Type-safe frontend code

## Workflow

### User Interaction Flow

1. **Document Upload**:
   - User uploads documents to property
   - Documents stored in GCS
   - Indexed in Vertex AI RAG corpus
   - Import results stored as JSON metadata

2. **Agent Selection**:
   - User opens chat settings
   - Selects "Docs" as primary agent
   - Optionally selects specific documents

3. **Query Submission**:
   - User types question about documents
   - Query sent to API with `primary_agent: "docs"`
   - Includes `context_doc_uris` if documents selected

4. **Agent Processing**:
   - property_agent resolve sets route=user_docs
   - Executor calls user_docs_retrieval
   - User Docs agent queries RAG corpus
   - Retrieves relevant document chunks

5. **Response Generation**:
   - Agent synthesizes answer from retrieved chunks
   - Adds citations for source documents
   - Returns formatted response to user

### Backend Processing Flow

```
API Request (primary_agent="docs")
    ↓
Root Property Agent
    ↓
property_agent executor (docs route)
    ↓
User Docs Agent
    ↓
get_rag_file_ids() - Get file IDs for search scope
    ↓
Vertex AI RAG retrieval_query()
    ↓
Retrieved document chunks
    ↓
Synthesize answer with citations
    ↓
Return to user
```

## Response Format

### Successful Retrieval

```json
{
  "user_docs_result": "The warranty covers parts and labor for 2 years from the date of purchase. It includes coverage for defects in materials and workmanship but excludes damage from misuse or normal wear and tear.\n\nCitations:\n- Product Warranty Document, Section 2: Coverage Details\n- Installation Manual, Warranty Information"
}
```

### No Information Found

```json
{
  "user_docs_result": "No relevant information could be found in your uploaded documents or provided context to answer this question."
}
```

## Integration Points

### Client Applications

**Web Application**:
- Chat settings popover with "Docs" option
- Document selector panel
- Compact settings bar showing current mode
- Real-time response streaming

**Mobile Application**:
- Chat settings modal with "Docs" option
- Document selection drawer
- Compact settings bar
- Native UI components

### Backend Services

**Proxy API**:
- Receives requests with `primary_agent` field
- Validates and forwards to agent
- Streams responses back to client

**Agent Workers**:
- Process document queries
- Manage RAG retrieval
- Generate responses with citations

**Firebase Integration**:
- User authentication
- Session management
- Document metadata storage

## Performance Characteristics

### Response Times

- **Selected Docs Mode**: 2-5 seconds (typical)
- **All Docs Mode**: 3-7 seconds (varies with document count)
- **No Results**: 1-2 seconds

### Scalability

- **Concurrent Users**: Horizontal scaling via Cloud Run
- **Document Count**: Efficient with 1-1000+ documents per user
- **Query Throughput**: Limited by Vertex AI RAG quotas

### Resource Usage

- **Memory**: Minimal (stateless agent)
- **Storage**: GCS for documents, minimal for metadata
- **Compute**: Pay-per-request via Cloud Run

## Security and Privacy

### Access Control

- **User Isolation**: Each user's documents stored separately
- **Property Scoping**: Documents scoped to properties
- **RAG Corpus Scoping**: File IDs filtered by user/property

### Data Protection

- **Encryption in Transit**: TLS for all API calls
- **Encryption at Rest**: GCS encryption for documents
- **Authentication**: Firebase Auth for user identity
- **Authorization**: Property ownership validation

### Privacy Considerations

- **No Cross-User Access**: Users can only query their own documents
- **No Cross-Property Access**: Documents scoped to properties
- **Citation Only**: Responses cite sources, don't expose raw documents
- **Audit Logging**: All queries logged for security

## Error Handling

### Graceful Degradation

- **No Documents**: Returns clear "no information found" message
- **RAG Failure**: Falls back to best-effort answer (if configured)
- **Partial Results**: Returns available information with note

### Error Messages

- **No Documents Uploaded**: "You don't have any documents uploaded yet."
- **No Matching Documents**: "No relevant information could be found in your uploaded documents."
- **Property ID Missing**: "Property ID is required for document queries."
- **RAG Service Error**: "Unable to search documents at this time. Please try again."

## Comparison with Other Agents

### vs. Property Agent (checkpoint path)

| Feature | Docs Agent (`user_docs_retrieval`) | Checkpoint pipeline (`run_checkpoint_pipeline`) |
|---------|-----------------------------------|------------------------------------------------|
| Purpose | Document Q&A | Checkpoint retrieval + optional analysis |
| Input | Text query + `context_doc_uris` | Text query + `checkpoint_ids` |
| Output | Document-based answer | `contentJson` accordions + `contentMarkdown` |
| Use Case | "What's in my warranty?" | "Analyse my garage checkpoints" |
| Data Source | User documents (RAG) | Firestore checkpoints + optional branches |

### vs. Checkpoint chat (same root agent)

| Feature | Docs mode (`primary_agent=docs`) | Checkpoint mode (`primary_agent=checkpoint`) |
|---------|----------------------------------|---------------------------------------------|
| Purpose | Document Q&A | Property history + analysis |
| Input | Text query | Text query + checkpoint IDs |
| Output | Markdown prose | Structured analysis + prose |
| Use Case | "What's my coverage?" | "What changed in my kitchen?" |
| Data Source | User documents | Checkpoint data |

## Use Cases

### Common Scenarios

1. **Warranty Lookup**: "What does my appliance warranty cover?"
2. **Manual Reference**: "How do I reset my thermostat according to the manual?"
3. **Policy Check**: "What's the deductible on my home insurance?"
4. **Specification Lookup**: "What are the dimensions of my refrigerator?"
5. **Installation Guide**: "What are the installation requirements from the manual?"
6. **Maintenance Schedule**: "When should I replace the HVAC filter?"
7. **Product Features**: "What features does my dishwasher have?"
8. **Troubleshooting**: "What does error code E3 mean in my manual?"

### Advanced Use Cases

1. **Multi-Document Comparison**: "Compare the warranties for my washer and dryer"
2. **Document Search**: "Find all mentions of 'water damage' in my policies"
3. **Cross-Reference**: "Does my warranty cover what the manual says to do?"
4. **Historical Lookup**: "What did the original purchase agreement say?"

## Future Enhancements

### Planned Features

- **Document Filtering**: Filter by document type, date, or category
- **Multi-Document Chat**: Conversational queries across documents
- **Document Summarization**: Generate summaries of long documents
- **Key Information Extraction**: Auto-extract key details (dates, amounts, etc.)
- **Document Comparison**: Side-by-side comparison of documents
- **Version Tracking**: Track document versions and changes

### Technical Improvements

- **Improved RAG**: Better chunking and embedding strategies
- **Caching**: Cache frequent queries for faster responses
- **Batch Processing**: Process multiple queries efficiently
- **Advanced Citations**: Link to specific pages/sections
- **Document Preview**: Show document snippets in chat

## Related Documentation

- [Docs Chat Implementation](DOCS_CHAT_IMPLEMENTATION.md)
- [Docs Chat Testing Guide](DOCS_CHAT_TESTING.md)
- [Docs Chat API Integration](DOCS_CHAT_API_INTEGRATION.md)
- [User Docs Agent README](../../gcp/agents/homecare/property_agent/agents/user_docs_agent/README.md)
- [Property Agent README](../../gcp/agents/homecare/property_agent/README.md)
- [Property Agent Architecture](../../gcp/agents/homecare/property_agent/ARCHITECTURE.md)

## Support

For issues or questions:
1. Check agent logs in Cloud Logging
2. Review API request/response payloads
3. Verify RAG corpus configuration
4. Check document indexing status
5. Validate property and user scoping

# Docs Chat Agent Documentation

Welcome to the Docs Chat Agent documentation. This feature enables users to directly query their uploaded documents through the AI chat interface with explicit routing and proper citations.

## Quick Links

- **[Overview](DOCS_CHAT_OVERVIEW.md)** - Feature overview, architecture, and use cases
- **[Implementation](DOCS_CHAT_IMPLEMENTATION.md)** - Technical implementation details and code changes
- **[API Integration](DOCS_CHAT_API_INTEGRATION.md)** - API endpoints, request/response formats, and client integration
- **[Testing Guide](DOCS_CHAT_TESTING.md)** - Comprehensive testing instructions and test cases
- **[Index](INDEX.md)** - Complete documentation index

## What is Docs Chat?

Docs Chat is a specialized AI agent that allows users to:
- ✅ Query their uploaded documents directly
- ✅ Search specific documents or entire document library
- ✅ Get answers with proper citations
- ✅ Maintain context within property and user scope

## Key Features

### 🎯 Explicit Routing
Select "Docs" as the primary agent type through the UI for direct document queries.

### 📄 Flexible Search Modes
- **Selected Docs Mode**: Search only selected documents
- **All Docs Mode**: Search entire user document library

### 📚 Proper Citations
All responses include citations referencing source documents.

### 🔒 Secure & Scoped
Documents are scoped to the current user and property, ensuring privacy and security.

## Quick Start

### For Users

1. **Upload Documents**: Upload your documents (manuals, warranties, policies) to your property
2. **Select Docs Mode**: Open chat settings and select "Docs" as the primary agent
3. **Optional**: Select specific documents to search, or leave empty to search all
4. **Ask Questions**: Type your question about the documents
5. **Get Answers**: Receive answers with citations from your documents

### For Developers

**Backend Integration**:
```python
# Route to docs agent
request = {
    "user_query": "What warranty do I have?",
    "primary_agent": "docs",
    "context_doc_uris": ["gs://bucket/warranty.pdf"],
    "property_id": "prop123"
}
```

**Frontend Integration**:
```typescript
// Set primary agent to docs
setPrimaryAgent("docs");

// Query documents
const response = await queryDocuments({
  user_id: userId,
  user_query: "What warranty do I have?",
  primary_agent: "docs",
  context_doc_uris: selectedDocs,
});
```

## Architecture

```
User Query (primary_agent="docs")
    ↓
Root Property Agent
    ↓
property_agent executor
    ↓
User Docs Agent
    ↓
Vertex AI RAG
    ↓
User Documents in GCS
    ↓
Answer with Citations
```

## Use Cases

### Common Scenarios

- **Warranty Lookup**: "What does my appliance warranty cover?"
- **Manual Reference**: "How do I reset my thermostat?"
- **Policy Check**: "What's my insurance deductible?"
- **Specification Lookup**: "What are the dimensions of my refrigerator?"
- **Installation Guide**: "What are the installation requirements?"
- **Maintenance Schedule**: "When should I replace the HVAC filter?"

## Response Format

```
[Answer based on retrieved documents]

Citations:
- Document Title, Section Name
- Another Document Title, Section Name
```

## Documentation Structure

```
docs/docs_chat/
├── README.md                        # This file - Quick start guide
├── INDEX.md                         # Complete documentation index
├── DOCS_CHAT_OVERVIEW.md           # Feature overview and architecture
├── DOCS_CHAT_IMPLEMENTATION.md     # Technical implementation details
├── DOCS_CHAT_API_INTEGRATION.md    # API integration guide
└── DOCS_CHAT_TESTING.md            # Testing guide and test cases
```

## Getting Started

### Read First
1. [Overview](DOCS_CHAT_OVERVIEW.md) - Understand the feature and architecture
2. [Implementation](DOCS_CHAT_IMPLEMENTATION.md) - Learn about the technical implementation

### For Integration
3. [API Integration](DOCS_CHAT_API_INTEGRATION.md) - Integrate with the API
4. [Testing Guide](DOCS_CHAT_TESTING.md) - Test the implementation

## Related Features

- **[Analysis Agent](../analysis/README.md)** - Problem diagnosis and solutions
- **[Checkpoint Agent](../checkpoint/README.md)** - Property history and condition tracking
- **[User Docs Agent](../../gcp/agents/homecare/property_agent/sub_agents/user_docs_agent/README.md)** - Underlying document retrieval agent

## Support

### Common Issues

**No results returned**:
- Check document indexing in RAG corpus
- Verify file IDs in import results
- Ensure documents are uploaded and processed

**Wrong documents searched**:
- Verify property ID scoping
- Check user ID in session
- Validate context_doc_uris

**Missing citations**:
- Check user_docs_agent prompt
- Verify retrieved contexts have metadata
- Review response format

### Getting Help

1. Check agent logs in Cloud Logging
2. Review API request/response payloads
3. Verify RAG corpus configuration
4. Test with sample documents
5. Consult the [Testing Guide](DOCS_CHAT_TESTING.md)

## Contributing

When updating this documentation:
1. Keep examples up to date with code changes
2. Add new use cases as they emerge
3. Update API documentation for any schema changes
4. Include screenshots for UI changes
5. Test all code examples before committing

## Version History

- **v1.0** (January 2026) - Initial release
  - Explicit docs mode routing
  - Selected docs and all-docs modes
  - Citation system
  - Web and mobile UI integration

## License

This documentation is part of the HomeApp project.

---

**Need help?** Check the [Testing Guide](DOCS_CHAT_TESTING.md) or review the [Implementation Details](DOCS_CHAT_IMPLEMENTATION.md).

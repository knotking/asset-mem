# GCP Proxy API Documentation

This directory contains feature documentation for the GCP Proxy API endpoints and functions.

## Available Documentation

### Architecture & Overview

- **[Architecture](./ARCHITECTURE.md)** - Comprehensive system architecture, components, and data flows for the GCP Proxy
- **[Improvements Summary](./IMPROVEMENTS_SUMMARY.md)** - Summary of recent improvements and architecture changes

### API Endpoints

- **[Adding Functions](./ADDING_FUNCTIONS.md)** - Guide for adding new API endpoints and functions to the proxy
- **[Document Analysis API](./DOCUMENT_ANALYSIS_API.md)** - Documentation for the document analysis endpoint using Vertex AI Gemini
- **[Service Broker API](./SERVICE_BROKER_API.md)** - Documentation for the service broker agent webhook endpoint

## Quick Links

- [Main Proxy README](../README.md) - Deployment and setup instructions
- [Workers README](../workers/README.md) - Background workers documentation

## Documentation Structure

Each API documentation file follows a consistent structure:

1. **Overview** - What the endpoint does
2. **Architecture** - System design and flow
3. **Files** - Code organization
4. **API Endpoint** - Request/response formats
5. **Configuration** - Environment variables and setup
6. **Usage Examples** - Code samples
7. **Testing** - How to test the endpoint
8. **Deployment** - Deployment instructions

## Contributing

When adding new API endpoints:

1. Follow the guide in [ADDING_FUNCTIONS.md](./ADDING_FUNCTIONS.md)
2. Create a new documentation file following the existing patterns
3. Update this README with a link to your new documentation


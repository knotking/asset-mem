# HomeApp Platform Presentation

> **AI-Powered Home Care & Property Diagnostics Platform**


---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [Platform Architecture](#platform-architecture)
5. [Key Features](#key-features)
6. [Technology Stack](#technology-stack)
7. [Multi-Agent AI System](#multi-agent-ai-system)
8. [Applications](#applications)
9. [Use Cases](#use-cases)
10. [Deployment & Infrastructure](#deployment--infrastructure)
11. [Future Roadmap](#future-roadmap)

---

<img width="1241" height="694" alt="HomeGeek AI Idea Explained" src="https://github.com/user-attachments/assets/081a804b-7a93-4194-9fb8-21c2b1e6c525" />

## Executive Summary

**HomeApp** is a comprehensive AI-powered platform that provides intelligent home care diagnostics, property maintenance guidance, and service recommendations through multimodal AI analysis and retrieval-augmented generation (RAG).

### Key Highlights

- 🤖 **Multi-Agent AI System** powered by Google Vertex AI Reasoning Engine
- 📱 **Cross-Platform Applications** - Mobile (iOS/Android) and Web
- 🔍 **Multimodal Analysis** - Images, videos, documents, and text
- 📚 **RAG-Powered Knowledge Base** - Document retrieval and Q&A
- 🛠️ **Comprehensive Diagnostics** - Triage, coverage, DIY, services, and cost analysis
- ☁️ **Cloud-Native Architecture** - Built on Google Cloud Platform

---

## Problem Statement

### Challenges in Home Care & Property Maintenance

1. **Information Overload**
   - Scattered information across manuals, warranties, and online resources
   - Difficulty finding relevant solutions quickly

2. **Diagnostic Complexity**
   - Visual issues require expert analysis
   - Multiple potential causes for common problems
   - Uncertainty about repair vs. replace decisions

3. **Service Discovery**
   - Finding trusted local service providers
   - Comparing costs and services
   - Understanding warranty and insurance coverage

4. **DIY Guidance**
   - Lack of step-by-step instructions
   - Safety concerns and complexity assessment
   - Product recommendations and sourcing

5. **Document Management**
   - Important documents (warranties, manuals, receipts) are often misplaced
   - Difficulty retrieving relevant information when needed

---

## Solution Overview

### HomeApp Platform

HomeApp addresses these challenges through an integrated AI platform that:

- **Analyzes** multimodal inputs (photos, videos, documents) using advanced AI
- **Retrieves** relevant information from user documents and knowledge base
- **Recommends** DIY solutions, service providers, and products
- **Estimates** costs and compares options
- **Provides** comprehensive coverage analysis

### Value Proposition

✅ **Instant Diagnostics** - Get AI-powered analysis of property issues in seconds  
✅ **Personalized Guidance** - Recommendations based on your documents and location  
✅ **Cost Transparency** - Compare DIY vs. professional service costs  
✅ **Trusted Providers** - Find authorized and highly-rated local service providers  
✅ **Document Intelligence** - Your documents become searchable knowledge  

---

## Platform Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT APPLICATIONS                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Mobile App  │  │   Web App    │  │  Telegram    │      │
│  │  (Expo RN)   │  │  (Next.js)   │  │     Bot      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼─────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   FIREBASE      │
                    │  • Auth         │
                    │  • Firestore    │
                    │  • Storage      │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  PROXY API      │
                    │  (Cloud Run)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  VERTEX AI      │
                    │  Agent Engine   │
                    │  • Multi-Agent  │
                    │  • RAG Engine   │
                    │  • Gemini 2.5   │
                    └─────────────────┘
```

### Component Layers

1. **Client Layer**
   - Mobile app (iOS, Android, Web)
   - Web application (Next.js)
   - Telegram bot interface

2. **Firebase Layer**
   - Authentication & user management
   - Real-time database (Firestore)
   - File storage (Cloud Storage)

3. **API Gateway**
   - FastAPI proxy service
   - Request routing & validation
   - Streaming responses

4. **AI Layer**
   - Vertex AI Reasoning Engine
   - Multi-agent orchestration
   - RAG corpus for document retrieval

---

## Key Features

### 1. Multimodal Diagnostics

**Visual Analysis**
- Upload photos or videos of property issues
- AI analyzes visual content using Gemini 2.5 Flash
- Provides initial triage and diagnosis

**Document Analysis**
- Extract key information from documents
- Property address extraction
- Entity recognition (warranties, policies, receipts)

### 2. Intelligent Triage

**Problem Assessment**
- Clear diagnosis or clarification questions
- Severity assessment
- Urgency recommendations

**Iterative Refinement**
- Follow-up questions to gather more context
- Progressive diagnosis refinement
- Structured JSON responses

### 3. Coverage Analysis

**Warranty & Insurance**
- Retrieves warranty information from user documents
- Insurance coverage analysis
- Policy recommendations

**Document Intelligence**
- Searches user-uploaded documents
- Extracts relevant coverage details
- Provides citations and sources

### 4. DIY Recommendations

**Step-by-Step Guidance**
- Detailed repair instructions
- Embedded YouTube video tutorials
- Safety considerations

**Product Recommendations**
- Curated product suggestions
- Pricing and vendor information
- Direct purchase links

**Cost Estimates**
- DIY cost breakdown
- Complexity ratings
- Time estimates

### 5. Service Provider Discovery

**Local Search**
- Finds nearby service providers
- Authorized service centers
- Highly-rated businesses

**Provider Details**
- Business information and contact
- Star ratings and review counts
- Google Maps integration
- Yelp reviews

**Cost Estimates**
- Professional service cost ranges
- Comparison with DIY options
- What's included in service

### 6. Document Management & RAG

**Document Upload**
- Support for PDFs, images, videos
- Automatic indexing to RAG corpus
- User-specific document corpus

**Knowledge Retrieval**
- Q&A from user documents
- General knowledge base access
- Citation support

**Search Capabilities**
- Semantic search across documents
- Context-aware retrieval
- Multi-document synthesis

---

## Technology Stack

### Frontend Technologies

**Mobile App (Expo/React Native)**
- React Native 0.81.5
- Expo SDK 54
- Expo Router 6.13
- NativeWind (Tailwind CSS)
- React Native Gifted Chat
- Firebase SDK

**Web App (Next.js)**
- Next.js 15.3.3
- React 19.1.0
- Tailwind CSS
- Radix UI components
- Framer Motion
- Genkit (AI integration)

**Shared Package**
- TypeScript 5.4.5
- Shared React contexts
- Common Firebase configuration
- Shared types and interfaces

### Backend Technologies

**API Service**
- FastAPI 0.116.1
- Python 3.11
- Uvicorn ASGI server
- Pydantic validation

**AI/ML Platform**
- Google Vertex AI Reasoning Engine
- Vertex AI RAG Engine
- Gemini 2.5 Flash
- Google Agent Development Kit (ADK)
- LangChain & LlamaIndex

**Cloud Infrastructure**
- Google Cloud Run (API)
- Cloud Functions Gen2 (Workers)
- Cloud Storage (Documents)
- Cloud Pub/Sub (Messaging)
- Firebase (Auth, Firestore, Storage)

**Infrastructure as Code**
- Terraform
- Docker
- Artifact Registry

### External Integrations

- **SerpAPI** - Local business search
- **Yelp API** - Service provider listings
- **YouTube API** - Video tutorials
- **Google Maps** - Location services
- **Google Search** - General information retrieval

---

## Multi-Agent AI System

### Agent Architecture

```
                    ROOT PROPERTY AGENT
                    (Orchestrator)
                           │
        ┌──────────────────┴──────────────────┐
        │                                      │
   ANALYSIS AGENT                      DOCULINK AGENT
   (Multimodal Diagnostics)            (Document Retrieval)
        │                                      │
   ┌────┴────┐                          ┌──────┴──────┐
   │        │                          │              │
TRIAGE   COVERAGE                    USER DOCS    KNOWLEDGE
AGENT    AGENT                       AGENT        BASE AGENT
   │        │                          │              │
   │    ┌───┴───┐                      │              │
   │    │       │                      │              │
DIY   SERVICE  COST                    │              │
AGENT  AGENT   AGENT                   │              │
   │    │       │                      │              │
   └────┼───────┘                      │              │
        │                              │              │
        └──────────────┬───────────────┴──────────────┘
                       │
              VERTEX AI RAG ENGINE
```

### Agent Responsibilities

#### Root Property Agent
- **Role**: Main orchestrator
- **Responsibilities**:
  - Routes requests based on input parameters
  - Delegates to Analysis or DocuLink agents
  - Handles casual queries directly

#### Analysis Agent
- **Triage Agent**: Multimodal analysis, initial diagnosis
- **Coverage Agent**: Warranty/insurance retrieval
- **DIY Agent**: Step-by-step instructions, videos, products
- **Service Agent**: Local provider discovery
- **Shopping Agent**: Product recommendations
- **Cost Agent**: Cost estimates and comparisons

#### DocuLink Agent
- **User Docs Agent**: Retrieves from user-uploaded documents
- **Knowledge Base Agent**: Accesses general knowledge corpus

### Agent Workflow

1. **Input Processing**
   - User query analysis
   - Parameter extraction (diagnosis_uris, context_doc_uris)
   - Routing decision

2. **Agent Selection**
   - If diagnosis URIs → Analysis Agent
   - If no diagnosis URIs → DocuLink Agent

3. **Sub-Agent Execution**
   - Parallel or sequential agent execution
   - Tool calls (RAG, APIs, search)
   - Result aggregation

4. **Response Assembly**
   - Structured JSON output
   - Citation inclusion
   - Streaming to client

---

## Applications

### Mobile App (`apps/mapp`)

**Platforms**: iOS, Android, Web (via Expo)

**Key Features**:
- 📸 Camera integration for photo/video capture
- 📎 Document picker for file uploads
- 💬 Real-time chat interface with Gifted Chat
- 📊 Structured response rendering (accordions)
- 🎥 YouTube video embedding
- 🗺️ Google Maps integration
- 📋 Copy/share message functionality
- 🔔 Push notifications

**Tech Stack**:
- Expo SDK 54
- React Native 0.81.5
- NativeWind (Tailwind CSS)
- Firebase SDK
- React Native Gifted Chat

### Web App (`apps/webapp`)

**Platform**: Desktop browsers

**Key Features**:
- 🖥️ Responsive design
- ⚡ Server-side rendering (SSR)
- 🔄 Real-time updates
- 📊 Data visualization (Recharts)
- 🎨 Modern UI with Radix components
- 🌓 Theme support (dark/light mode)

**Tech Stack**:
- Next.js 15.3.3
- React 19.1.0
- Tailwind CSS
- Radix UI
- Genkit (AI flows)

### Shared Package (`apps/common`)

**Purpose**: Code sharing between mobile and web

**Contents**:
- Shared React contexts (Auth, Session, Property)
- Common Firebase configuration
- Shared TypeScript types
- Platform-specific adapters

---

## Use Cases

### Use Case 1: HVAC System Diagnosis

**Scenario**: User notices their AC isn't cooling properly

**Flow**:
1. User uploads photo of AC unit and thermostat
2. Triage Agent analyzes images
3. Coverage Agent checks warranty documents
4. DIY Agent provides troubleshooting steps + YouTube videos
5. Service Agent finds local HVAC technicians
6. Cost Agent compares DIY vs. professional repair costs

**Output**: Comprehensive analysis with diagnosis, warranty status, DIY options, service providers, and cost comparison

### Use Case 2: Document Q&A

**Scenario**: User wants to know what their home warranty covers

**Flow**:
1. User asks: "What does my home warranty cover?"
2. DocuLink Agent routes to User Docs Agent
3. RAG retrieval searches user's uploaded warranty documents
4. Returns relevant coverage information with citations

**Output**: Extracted warranty coverage details with document citations

### Use Case 3: Leak Detection & Repair

**Scenario**: User discovers a water leak under the sink

**Flow**:
1. User uploads video of leak
2. Triage Agent analyzes video and provides diagnosis
3. DIY Agent provides step-by-step repair instructions
4. Shopping Agent recommends replacement parts
5. Service Agent finds emergency plumbers
6. Cost Agent estimates repair costs

**Output**: Urgent diagnosis, repair steps, parts list, emergency services, and cost estimates

### Use Case 4: Appliance Manual Lookup

**Scenario**: User needs to know how to reset their dishwasher

**Flow**:
1. User asks: "How do I reset my dishwasher?"
2. DocuLink Agent searches user's uploaded manuals
3. Knowledge Base Agent searches general appliance database
4. Returns reset instructions with manual citations

**Output**: Step-by-step reset instructions from user's manual or knowledge base

---

## Deployment & Infrastructure

### Cloud Architecture

**Google Cloud Platform**
- **Cloud Run**: API service (auto-scaling)
- **Cloud Functions**: Background workers (Pub/Sub triggered)
- **Cloud Storage**: Document storage
- **Pub/Sub**: Asynchronous messaging
- **Vertex AI**: Agent engine and RAG

**Firebase**
- **Authentication**: User management
- **Firestore**: Real-time database
- **Storage**: File storage (synced with GCS)

### Infrastructure as Code

**Terraform Modules**:
- Cloud Run deployment
- Cloud Functions deployment
- Pub/Sub topics and subscriptions
- Storage buckets
- IAM roles and service accounts
- Secret Manager integration

**Environments**:
- Staging
- Production

### Deployment Process

**Agents**:
```bash
cd gcp/agents/homecare
make deploy
make grant-permissions
```

**API**:
```bash
gcloud run deploy homecare-agent-proxy --source api
```

**Infrastructure**:
```bash
cd gcp/terraform/environments/staging
terraform plan
terraform apply
```

### Scalability

- **Horizontal Scaling**: Cloud Run auto-scales based on traffic
- **Streaming Responses**: Server-Sent Events (SSE) for real-time updates
- **Async Processing**: File uploads processed via Pub/Sub
- **RAG Optimization**: Pre-indexed documents for fast retrieval

---

## Future Roadmap

### Short-Term Enhancements

- [ ] **Enhanced Multimodal Support**
  - Support for more file formats
  - Batch processing capabilities
  - Video analysis improvements

- [ ] **Advanced RAG Features**
  - Multi-document synthesis
  - Cross-document references
  - Temporal document versioning

- [ ] **User Experience**
  - Voice input/output
  - AR visualization for repairs
  - Scheduled maintenance reminders

### Medium-Term Goals

- [ ] **Integration Expansion**
  - Smart home device integration
  - IoT sensor data analysis
  - Calendar integration for service appointments

- [ ] **Advanced Analytics**
  - Property health scoring
  - Predictive maintenance
  - Cost trend analysis

- [ ] **Community Features**
  - User reviews and ratings
  - Community Q&A forum
  - Shared repair experiences

### Long-Term Vision

- [ ] **AI Model Improvements**
  - Fine-tuned domain models
  - Multi-language support
  - Enhanced reasoning capabilities

- [ ] **Platform Expansion**
  - Commercial property support
  - Vehicle diagnostics integration
  - Insurance claim automation

- [ ] **Enterprise Features**
  - Multi-property management
  - Team collaboration tools
  - Advanced reporting and analytics

---

## Key Metrics & Success Indicators

### Technical Metrics
- **Response Time**: < 5 seconds for triage
- **Accuracy**: High-quality diagnoses and recommendations
- **Uptime**: 99.9% availability
- **Scalability**: Handles 1000+ concurrent users

### User Metrics
- **User Satisfaction**: High ratings for diagnostic accuracy
- **Engagement**: Daily active users
- **Retention**: Monthly active users
- **Feature Adoption**: Usage of different agent capabilities

### Business Metrics
- **Cost Savings**: Average cost reduction through DIY recommendations
- **Service Discovery**: Conversion rate to service providers
- **Document Utilization**: Active use of document Q&A features

---

## Conclusion

HomeApp represents a comprehensive solution to modern home care challenges, leveraging cutting-edge AI technology to provide:

✅ **Intelligent Diagnostics** through multimodal AI analysis  
✅ **Personalized Guidance** via RAG-powered document retrieval  
✅ **Comprehensive Support** from triage to service discovery  
✅ **Cost Transparency** with detailed estimates and comparisons  
✅ **Seamless Experience** across mobile and web platforms  

Built on a robust, scalable cloud architecture with a sophisticated multi-agent AI system, HomeApp is positioned to transform how homeowners manage and maintain their properties.

---

## Additional Resources

- **Architecture Diagrams**: [`ARCHITECTURE_DIAGRAM.md`](./ARCHITECTURE_DIAGRAM.md)
- **Technology Stack**: [`TECH_STACK.md`](./TECH_STACK.md)
- **Backend Architecture**: [`../gcp/docs/ARCHITECTURE.md`](../gcp/docs/ARCHITECTURE.md)
- **Setup Guide**: [`../gcp/docs/SETUP_AND_DEPLOYMENT.md`](../gcp/docs/SETUP_AND_DEPLOYMENT.md)
- **Frontend Guide**: [`../apps/README.md`](../apps/README.md)

---

**For questions or more information, please refer to the documentation or contact the HomeApp platform team.**


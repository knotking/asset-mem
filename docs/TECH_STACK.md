# HomeApp Technology Stack

This document provides a comprehensive overview of the technologies and frameworks used to build the HomeApp platform across backend, mobile, and web applications.

---

## Table of Contents

1. [Backend Technologies](#backend-technologies)
2. [Mobile App Technologies](#mobile-app-technologies)
3. [Web App Technologies](#web-app-technologies)
4. [Shared Technologies](#shared-technologies)
5. [Infrastructure & DevOps](#infrastructure--devops)

---

## Backend Technologies

The backend is built using Python and deployed on Google Cloud Platform, providing APIs, AI agent orchestration, and file processing capabilities.

### Core Framework & Runtime

- **Python 3.11**: Primary programming language
- **FastAPI 0.116.1**: Modern, high-performance web framework for building APIs
- **Uvicorn 0.35.0**: ASGI server for running FastAPI applications
- **Pydantic 2.11.7**: Data validation using Python type annotations

### AI & Machine Learning

- **Google Cloud Vertex AI (google-cloud-aiplatform 1.110.0)**: Managed AI/ML platform
  - Vertex AI Agent Builder / Agent Development Kit (ADK)
  - Vertex AI RAG (Retrieval-Augmented Generation) Engine
  - Reasoning Engine for multi-agent orchestration
- **LangChain 1.0.2+**: Framework for developing applications powered by language models
- **LangChain Community 0.4+**: Community-contributed LangChain integrations
- **LlamaIndex 0.12**: Data framework for LLM applications and RAG systems
- **Google GenAI SDK (google-genai 1.0.0+)**: Client library for Google's Gemini models

### Cloud Services & APIs

- **Google Cloud Pub/Sub 2.31.1**: Messaging service for asynchronous communication
- **Google Cloud Storage**: Object storage for user-uploaded documents and assets
- **Firebase Admin SDK 6.9.0**: Server-side Firebase integration for authentication and Firestore
- **Google Cloud Functions**: Serverless functions for Pub/Sub-triggered workers

### HTTP & Async Libraries

- **HTTPX 0.28.1**: Modern HTTP client library for async requests
- **AioHTTP 3.12.15**: Async HTTP client/server framework
- **Requests 2.32.4**: HTTP library for synchronous requests

### Additional Tools

- **Aiogram 3.21.0**: Asynchronous framework for building Telegram bots
- **Python-dotenv 1.1.1**: Loads environment variables from `.env` files
- **FastAPI CORS 0.0.6**: CORS middleware for FastAPI
- **Telegramify-markdown 0.5.1**: Markdown formatting for Telegram messages

### Testing & Development

- **Pytest 8.3.5+**: Testing framework
- **Pytest-asyncio 0.26.0+**: Async test support
- **Black 25.1.0+**: Code formatter

### Agent Architecture

The backend implements a multi-agent system using Google Cloud's Agent Development Kit (ADK):

- **Root Property Agent**: Two-hop orchestrator (`resolve_turn_llm` + executor LLM) with flat tool registry
  - `run_checkpoint_pipeline`: Checkpoint retrieval + optional coverage/DIY/service/cost branches
  - `user_docs_retrieval`: RAG over user-uploaded documents
  - `knowledge_base_retrieval`: RAG over shared corpus

---

## Mobile App Technologies

The mobile application is built using React Native with Expo, providing cross-platform support for iOS, Android, and web.

### Core Framework

- **React Native 0.81.5**: Cross-platform mobile framework
- **React 19.1.0**: UI library
- **Expo SDK 54**: Development platform and toolchain
- **Expo Router 6.13**: File-based routing for React Native
- **TypeScript 5.9.2**: Type-safe JavaScript

### UI & Styling

- **NativeWind 4.2.1**: Tailwind CSS for React Native
- **Tailwind CSS 3.4.14**: Utility-first CSS framework
- **Tailwind CSS Animate 1.0.7**: Animation utilities
- **React Native Reanimated 4.1.1**: High-performance animations
- **React Native SVG 15.12.1**: SVG support for React Native

### UI Components

- **React Native Primitives (@rn-primitives/*)**: Comprehensive UI component library
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu, Popover, Tabs, and more
- **React Native Gifted Chat 2.8.1**: Chat UI components
- **Lucide React Native 0.545.0**: Icon library

### Navigation & Routing

- **React Navigation 7.0.0**: Navigation library
- **React Native Screens 4.16.0**: Native screen management
- **React Native Safe Area Context 5.6.0**: Safe area handling

### Media & Assets

- **Expo Image 3.0.10**: Optimized image component
- **Expo Video 3.0.12**: Video playback
- **Expo Video Thumbnails 10.0.7**: Video thumbnail generation
- **Expo Image Picker 17.0.8**: Image selection from gallery
- **Expo Document Picker 14.0.7**: Document selection
- **Expo AV 16.0.7**: Audio/video playback utilities

### Firebase Integration

- **Firebase SDK 12.4.0**: Authentication, Firestore, Storage
- **Expo Auth Session 7.0.8**: Authentication flows

### Utilities & Helpers

- **React Native Async Storage 2.2.0**: Persistent key-value storage
- **React Native WebView 13.16.0**: WebView component
- **React Native YouTube Iframe 2.4.1**: YouTube video embedding
- **React Native Markdown Display 7.0.2**: Markdown rendering
- **React Native NetInfo 11.4.1**: Network state detection
- **Expo Clipboard 8.0.7**: Clipboard access
- **Expo Haptics 15.0.7**: Haptic feedback
- **Expo Linking 8.0.8**: Deep linking
- **Expo Web Browser 15.0.8**: In-app browser

### Development Tools

- **Expo Dev Client 6.0.17**: Custom development build
- **Babel 7.26.0**: JavaScript compiler
- **Metro**: React Native bundler
- **RNX Kit Metro Config 2.1.2**: Metro configuration utilities
- **Prettier 3.6.2**: Code formatter

### Polyfills

- **React Native Polyfill Globals 3.1.0**: Global polyfills
- **Web Streams Polyfill 4.2.0**: Streams API polyfill
- **Text Encoding 0.7.0**: Text encoding utilities

---

## Web App Technologies

The web application is built using Next.js with React, providing a responsive web experience.

### Core Framework

- **Next.js 15.3.3**: React framework with server-side rendering and static generation
- **React 19.1.0**: UI library
- **TypeScript 5**: Type-safe JavaScript
- **Turbopack**: Next-generation bundler (used in development)

### UI & Styling

- **Tailwind CSS 3.4.1**: Utility-first CSS framework
- **Tailwind CSS Typography 0.5.13**: Typography plugin
- **Tailwind CSS Animate 1.0.7**: Animation utilities
- **Framer Motion 11.3.19**: Animation library
- **CSS Modules**: Component-scoped styling

### UI Components

- **Radix UI**: Unstyled, accessible component primitives
  - Accordion, Alert Dialog, Avatar, Checkbox, Dialog, Dropdown Menu, Popover, Progress, Radio Group, Select, Separator, Slider, Switch, Tabs, Toast, Tooltip
- **Lucide React 0.475.0**: Icon library
- **Cmdk 1.0.0**: Command menu component
- **Embla Carousel React 8.0.0**: Carousel component
- **Recharts 2.15.1**: Charting library

### Forms & Validation

- **React Hook Form 7.54.2**: Form state management
- **Zod 3.24.2**: Schema validation
- **Hookform Resolvers 4.1.3**: Zod integration for React Hook Form
- **React Day Picker 8.10.1**: Date picker component
- **React Dropzone 14.2.3**: File dropzone component

### Firebase Integration

- **Firebase SDK 12.4.0**: Authentication, Firestore, Storage
- **Google Cloud Storage 7.17.0**: Server-side storage access

### AI Integration

- **Genkit 1.14.1**: AI orchestration framework
- **Genkit Google AI 1.14.1**: Google AI integrations
- **Genkit Next 1.14.1**: Next.js integration for Genkit
- **Genkit CLI 1.14.1**: Development CLI tools

### Content & Markdown

- **React Markdown 9.0.1**: Markdown rendering
- **Remark GFM 4.0.0**: GitHub Flavored Markdown support

### Utilities

- **Date-fns 3.6.0**: Date manipulation library
- **Class Variance Authority 0.7.1**: Component variant management
- **Clsx 2.1.1**: Conditional class names
- **Tailwind Merge 3.0.1**: Merge Tailwind classes
- **Next Themes 0.3.0**: Theme management
- **Patch Package 8.0.0**: Patch npm packages

---

## Shared Technologies

Technologies and packages shared across mobile and web applications.

### Common Package (`apps/common`)

- **TypeScript 5.4.5**: Type-safe code sharing
- **Firebase SDK 12.4.0**: Shared Firebase configuration
- **React Native Async Storage 1.22.0**: Storage utilities

The common package provides:
- Shared React contexts (Auth, Firebase, Session, Property, etc.)
- Shared Firebase configuration and initialization
- Shared TypeScript types and interfaces
- Platform-specific Firebase adapters (web vs. native)

---

## Infrastructure & DevOps

### Cloud Platform

- **Google Cloud Platform (GCP)**:
  - Cloud Run: Containerized API deployment
  - Cloud Functions: Serverless workers
  - Cloud Storage: Object storage
  - Pub/Sub: Message queuing
  - Vertex AI: AI/ML services
  - Artifact Registry: Container image storage
  - Cloud Build: CI/CD

### Deployment & infrastructure

- **GitHub Actions + gcloud**: Environment provisioning (`create-environment.yaml`) and component deploys (`deploy-*.yaml`)
- **Docker**: Containerization
- **GCloud CLI**: Google Cloud command-line tools
- **EAS Build**: Expo Application Services for mobile builds

### Authentication & Backend Services

- **Firebase Authentication**: User authentication
- **Cloud Firestore**: NoSQL database
- **Firebase Storage**: File storage
- **Firebase Admin SDK**: Server-side Firebase access

### Version Control & CI/CD

- **Git**: Version control
- **GitHub Actions**: CI/CD pipelines (referenced in deployment scripts)

### Development Tools

- **Node.js 20.x**: JavaScript runtime (required for frontend development)
- **npm**: Package manager
- **Expo CLI**: Mobile development tooling
- **UV**: Python package manager (used for agent development)

---

## Architecture Patterns

### Backend

- **Multi-Agent System**: Hierarchical agent architecture with routing and delegation
- **RESTful APIs**: FastAPI-based REST endpoints
- **Event-Driven Architecture**: Pub/Sub for asynchronous processing
- **RAG (Retrieval-Augmented Generation)**: Document-based Q&A using Vertex AI RAG Engine
- **Streaming Responses**: Server-sent events (SSE) for real-time AI responses

### Frontend

- **Component-Based Architecture**: React components for reusable UI
- **Context API**: Shared state management across applications
- **File-Based Routing**: Expo Router (mobile) and Next.js App Router (web)
- **Progressive Web App**: Web app with mobile-like features
- **Responsive Design**: Mobile-first approach with Tailwind CSS

### Shared

- **Monorepo Structure**: Single repository for multiple applications
- **TypeScript**: Type safety across the stack
- **Design System**: Shared UI primitives and design tokens

---

## Version Requirements

- **Node.js**: 20.x (LTS recommended)
- **Python**: 3.11+
- **npm**: Ships with Node.js
- **Expo CLI**: Latest (for mobile development)
- **Google Cloud SDK**: Latest (for backend deployment)

---

For detailed setup and deployment instructions, refer to:
- `apps/README.md` - Frontend setup guide
- `gcp/README.md` - Backend setup guide
- `gcp/docs/ARCHITECTURE.md` - Backend architecture details
- `gcp/docs/SETUP_AND_DEPLOYMENT.md` - Deployment guide


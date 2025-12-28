# HomeApp Web Application (`webapp`)

The HomeApp web application allows property managers and homeowners to access their property data, manage documents, and view diagnostics from a desktop or tablet interface. Built with **Next.js** and **React**.

## Key Features

### 🏠 Property Dashboard
- **Overview**: View all properties and their status.
- **Details**: Access comprehensive property information.
- **Documents**: Upload and manage property documents.

### 💬 AI Chat
- **Conversational Interface**: Chat with the AI agent about your property.
- **Dual Agent System**: Choose between Analysis Agent (repairs, diagnosis) and Checkpoint Agent (condition tracking).
- **Intelligent Suggestions**: AI suggests the best agent based on your query intent.
- **Document Q&A**: Ask questions about uploaded manuals and docs.
- **Checkpoint Context**: Select checkpoints to provide visual context for your conversations.

### 📸 Checkpoints
- **Visual History**: Capture and track property condition over time with photos/videos.
- **AI Analysis**: Automatic damage detection and condition assessment using Gemini AI.
- **Comparison**: Compare checkpoints side-by-side with AI-generated change summaries.
- **Metrics Dashboard**: View overall property health, deterioration rates, and issue tracking.
- **Issues Tracking**: Detailed breakdown of detected issues by severity and location.

## Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui
- **State Management**: React Context
- **Backend Integration**: Firebase (Auth, Firestore, Storage)

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start Development Server**:
    ```bash
    npm run dev
    ```

3.  **Open in Browser**:
    Navigate to `http://localhost:9002` (or the port shown in terminal).

## Project Structure

- `src/app/`: Next.js App Router pages.
- `src/components/`: Reusable UI components.
- `src/contexts/`: React Context providers (Auth, Property, Session, Checkpoint, Preferences).
- `src/lib/`: Utility functions and types.
- `src/hooks/`: Custom React hooks.
- `src/scripts/`: Migration and utility scripts.
- `docs/`: Documentation and guides.

## Troubleshooting

If you encounter issues:

1. **Chat sessions not working?** → Make sure the dev server is running and environment variables are loaded. See [Troubleshooting Guide](./docs/TROUBLESHOOTING.md#chat-session-creation-fails)
2. **Build failures?** → Check [Troubleshooting Guide](./docs/TROUBLESHOOTING.md#build-failures)
3. **Environment variables not loading?** → Restart the dev server after modifying `.env` files

For more help, see the complete [Troubleshooting Guide](./docs/TROUBLESHOOTING.md).

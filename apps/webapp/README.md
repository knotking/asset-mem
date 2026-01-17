# HomeApp Web Application (`webapp`)

The HomeApp web application allows property managers and homeowners to access their property data, manage documents, and view diagnostics from a desktop or tablet interface. Built with **Next.js** and **React**.

## Key Features

### 🏠 Property Dashboard
- **Overview**: View all properties and their status.
- **Details**: Access comprehensive property information.
- **Documents**: Upload and manage property documents.
- **Inspections**: Dedicated section for property inspection reports with AI analysis.

### 💬 AI Chat
- **Conversational Interface**: Chat with the AI agent about your property.
- **Document Q&A**: Ask questions about uploaded manuals and docs.
- **Inspection Reports**: Query inspection findings with natural language (e.g., "What are the critical issues?").

### 📸 Checkpoints
- **Timeline View**: View a visual history of property checkpoints.
- **AI Analysis**: Automatically analyze checkpoint photos for condition assessment.
- **Comparison Mode**: Compare checkpoints over time to detect changes.
- **Metrics Dashboard**: Track property health scores and issue trends.

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
  - `home/properties/[propertyId]/`: Property-specific pages (chat, checkpoints, inspections, details).
- `src/components/`: Reusable UI components.
  - `checkpoints/`: Checkpoint-related components.
  - `inspections/`: Inspection reports components (cards, lists, dialogs).
  - `chat/`: Chat interface components.
- `src/contexts/`: React Context providers (Auth, Property, Checkpoint, Inspection).
- `src/lib/`: Utility functions and types.
- `src/scripts/`: Migration and utility scripts.

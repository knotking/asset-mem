# HomeApp Web Application (`webapp`)

The HomeApp web application allows property managers and homeowners to access their property data, manage documents, and view diagnostics from a desktop or tablet interface. Built with **Next.js** and **React**.

## Key Features

### 🏠 Property Dashboard
- **Overview**: View all properties and their status.
- **Details**: Access comprehensive property information.
- **Documents**: Upload and manage property documents.

### 💬 AI Chat
- **Conversational Interface**: Chat with the AI agent about your property.
- **Document Q&A**: Ask questions about uploaded manuals and docs.
- **Implementation**: [docs/CHAT.md](docs/CHAT.md) — V2 `contentMarkdown` / `contentJson` rendering and thinking strip.

### 📸 Checkpoints (Preview)
- **Timeline View**: View a visual history of property checkpoints.
- **Status**: Currently in preview mode with placeholder data. Full integration with backend Checkpoint analysis is coming soon.

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

Copy `.env.example` to `.env` and set values. For **Settings → AI usage**, limits come from the proxy **`POST /token-quota-status`** (free tier from `STRIPE_B2C_PRICE_TOKEN_CAPS_JSON` → `free` on the proxy).

## Project Structure

- `src/app/`: Next.js App Router pages.
- `src/components/`: Reusable UI components.
- `src/contexts/`: React Context providers.
- `src/lib/`: Utility functions and types.
- `src/scripts/`: Migration and utility scripts.

# HomeApp Mobile Application (`mapp`)

The HomeApp mobile application is a comprehensive property care tool built with **React Native** and **Expo**. It empowers homeowners to manage their properties, track maintenance, and leverage AI for diagnostics and advice.

## Key Features

### 🏠 Property Management
- **Dashboard**: Overview of all your properties.
- **Details**: In-depth view of each property including location, size, and custom details.

### 📸 Checkpoints & Time Travel
- **Visual Timeline**: Capture photos and videos of your property over time to track its condition.
- **AI Analysis**: Automatically analyzes photos to detect room types, identify assets (appliances, furniture), and assess condition.
- **Comparison Mode**: Side-by-side comparison of checkpoints (e.g., "Before" vs "After") with AI-powered change detection.
- **Room Detection**: Automatically categorizes photos by room (Kitchen, Bathroom, etc.).
- **Metrics**: Track property health scores and issue trends over time.

### 💬 AI Assistant
- **Context-Aware Chat**: Chat with an AI agent that knows your property details.
- **Multimodal Support**: Send photos and documents to the AI for analysis.
- **Document Q&A**: Ask questions about your uploaded user manuals, warranties, and receipts.
- **Inspection Reports**: Query and analyze property inspection reports with natural language.

### 📄 Document Management
- **Central Repository**: Store and organize important property documents.
- **AI-Powered Search**: Find information within documents using natural language queries.
- **Inspection Reports**: Dedicated section for property inspection reports with analysis results.
- **Document Types**: Support for deeds, insurance policies, utility bills, inspection reports, and more.

## Technology Stack

- **Framework**: React Native with Expo SDK 54
- **Language**: TypeScript
- **Styling**: NativeWind (Tailwind CSS)
- **Navigation**: Expo Router
- **State Management**: React Context
- **Backend Integration**: Firebase (Auth, Firestore, Storage) & Custom Python Backend (GCP)

## Getting Started

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Start the App**:
    ```bash
    npm run dev
    ```

3.  **Run on Device/Simulator**:
    - Press `i` for iOS Simulator
    - Press `a` for Android Emulator
    - Scan the QR code with Expo Go on your physical device

## Project Structure

- `app/`: Expo Router pages and navigation structure.
- `components/`: Reusable UI components.
  - `property-details/`: Components specific to the property details screen (Checkpoints, Chat, Documents, Inspections).
  - `ui/`: Core UI primitives (Buttons, Cards, Inputs).
- `contexts/`: React Context providers (Auth, Property, Checkpoint).
- `hooks/`: Custom React hooks.
- `lib/`: Utility functions and API clients.

## Feature Details

### Checkpoint Feature

The Checkpoints feature is a core part of the app, allowing users to create a visual history of their property.

- **Frontend**: Located in `components/property-details/PropertyCheckpointsTab.tsx`.
- **State**: Managed by `CheckpointContext`.
- **Analysis**: Images are uploaded to Firebase Storage, which triggers a background process on GCP to analyze them using Gemini Flash 2.5.
- **Real-time Updates**: The app listens to Firestore for analysis results and updates the UI automatically.

### Inspection Reports Feature

The Inspection Reports feature provides a dedicated interface for managing and querying property inspection reports.

- **Frontend**: Located in `components/property-details/PropertyInspectionsTab.tsx`.
- **Components**:
  - `PropertyInspectionsTab`: Main tab view with stats and report list.
  - `InspectionsDrawerContent`: Drawer for selecting reports in chat context.
  - `InspectionDetailModal`: Modal for viewing report details.
- **Document Type**: Reports are stored as `INSPECTION_REPORT` document type in Firestore.
- **AI Integration**: Reports can be queried via chat using the inspection_agent backend.
- **Features**: Stats dashboard, status indicators, issue badges, download/view actions.

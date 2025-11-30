# Firebase Common Module

Common Firebase Admin SDK utilities for GCP services.

## Overview

This module provides a centralized Firebase Admin SDK client that can be used across GCP services. It handles initialization, authentication, and provides access to Firebase services like Firestore and Auth.

## Features

- Firebase Admin SDK initialization with flexible credential handling
- ID token verification
- User management
- Firestore client access
- Configuration from environment variables or Secret Manager

## Installation

```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

```python
from gcp.common.firebase import FirebaseClient, FirebaseConfig

# Load config from environment variables
config = FirebaseConfig.from_env()
client = FirebaseClient(config)

# Verify an ID token
decoded_token = client.verify_id_token(id_token)
user_id = decoded_token['uid']

# Get Firestore client
db = client.get_firestore()
doc_ref = db.collection('users').document(user_id)
```

### Configuration

#### Environment Variables

Set these environment variables:

```bash
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CREDENTIALS_PATH=/path/to/service-account.json  # Optional
# Or use default credentials:
GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json
```

#### Secret Manager

```python
from gcp.common.firebase import FirebaseConfig

config = FirebaseConfig.from_gcp_secret_manager(
    project_id="your-project-id",
    config_secret="firebase-config"
)
client = FirebaseClient(config)
```

### API Reference

#### FirebaseConfig

Configuration container for Firebase Admin SDK.

**Methods:**
- `from_env()` - Load from environment variables
- `from_gcp_secret_manager()` - Load from Secret Manager
- `validate()` - Validate configuration

#### FirebaseClient

Firebase Admin SDK client wrapper.

**Methods:**
- `verify_id_token(id_token: str)` - Verify Firebase ID token
- `get_user(uid: str)` - Get user information by UID
- `get_firestore()` - Get Firestore client instance
- `get_app()` - Get Firebase Admin app instance

**Properties:**
- `project_id` - Firebase project ID

## Error Handling

The module raises `FirebaseError` exceptions for Firebase-related errors:

```python
from gcp.common.firebase import FirebaseClient, FirebaseError

try:
    client = FirebaseClient()
    token = client.verify_id_token(id_token)
except FirebaseError as e:
    print(f"Firebase error: {e}")
    print(f"Status code: {e.status_code}")
    print(f"Details: {e.details}")
```

## Examples

### Verify ID Token in API Endpoint

```python
from fastapi import Request, HTTPException
from gcp.common.firebase import FirebaseClient, FirebaseError

client = FirebaseClient()

async def verify_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    token = auth_header.split(" ")[1]
    try:
        decoded_token = client.verify_id_token(token)
        return decoded_token['uid']
    except FirebaseError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
```

### Access Firestore

```python
from gcp.common.firebase import FirebaseClient

client = FirebaseClient()
db = client.get_firestore()

# Read document
doc_ref = db.collection('users').document('user123')
doc = doc_ref.get()
if doc.exists:
    print(f"Document data: {doc.to_dict()}")

# Write document
doc_ref.set({
    'name': 'John Doe',
    'email': 'john@example.com'
})
```

## Integration with GCP Proxy

This module is used by `gcp/proxy/api/firebase_api.py` to handle Firebase authentication and operations.

## License

Copyright 2025 Google LLC

Licensed under the Apache License, Version 2.0


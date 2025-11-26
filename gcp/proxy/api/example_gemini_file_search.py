#!/usr/bin/env python3
"""
Example usage of Gemini File Search API

This demonstrates how to use Google's File Search for RAG
(Retrieval Augmented Generation) with semantic search.

Requirements:
- Set GEMINI_API_KEY environment variable
- Have GCS files ready or local files to upload
"""

import os
from gemini_file_search import get_file_search_manager


def example_1_create_store_and_query():
    """
    Example 1: Create a store, upload a file, and query it.
    """
    print("\n" + "="*70)
    print("Example 1: Create Store, Upload File, Query")
    print("="*70 + "\n")
    
    manager = get_file_search_manager()
    
    # Step 1: Create a File Search store
    print("📦 Creating File Search store...")
    store = manager.create_file_search_store("Example Property Documents")
    store_name = store["name"]
    print(f"✓ Created store: {store_name}\n")
    
    # Step 2: Import a file from GCS
    print("📄 Importing document from GCS...")
    gcs_uri = "gs://your-bucket/documents/sample.pdf"  # Replace with your GCS URI
    
    try:
        result = manager.import_gcs_file_to_store(
            gcs_uri=gcs_uri,
            store_name=store_name,
            display_name="Sample Property Document",
            mime_type="application/pdf",
            wait_for_completion=True
        )
        print(f"✓ Import status: {result['status']}\n")
    except Exception as e:
        print(f"✗ Import failed: {e}")
        print("Tip: Update gcs_uri with your actual GCS file path\n")
        return
    
    # Step 3: Query the documents
    print("🔍 Querying documents...")
    response = manager.query_file_search(
        query="What is this document about?",
        store_names=[store_name],
        model="gemini-2.5-flash"
    )
    
    print(f"📝 Answer:\n{response['text']}\n")
    
    # Show citations if available
    if response.get('grounding_metadata'):
        chunks = response['grounding_metadata'].get('grounding_chunks', [])
        if chunks:
            print("📌 Citations:")
            for i, chunk in enumerate(chunks[:3], 1):
                print(f"  {i}. {chunk.get('document_name')} (page {chunk.get('page_number', 'N/A')})")
    
    print("\n✓ Example 1 complete!")


def example_2_upload_local_file():
    """
    Example 2: Upload a local file to File Search.
    """
    print("\n" + "="*70)
    print("Example 2: Upload Local File")
    print("="*70 + "\n")
    
    manager = get_file_search_manager()
    
    # Get or create a store
    stores = manager.list_file_search_stores()
    if stores:
        store_name = stores[0]["name"]
        print(f"📦 Using existing store: {store_name}\n")
    else:
        store = manager.create_file_search_store("Local Files Store")
        store_name = store["name"]
        print(f"📦 Created new store: {store_name}\n")
    
    # Upload a local file
    local_file = "sample.txt"  # Replace with your file path
    
    print(f"📤 Uploading {local_file}...")
    
    try:
        result = manager.upload_file_to_store(
            file_path=local_file,
            store_name=store_name,
            display_name="Local Document",
            wait_for_completion=True
        )
        print(f"✓ Upload status: {result['status']}\n")
    except Exception as e:
        print(f"✗ Upload failed: {e}")
        print("Tip: Create a sample.txt file first or update the file_path\n")
        return
    
    print("✓ Example 2 complete!")


def example_3_multi_document_query():
    """
    Example 3: Query across multiple documents with citations.
    """
    print("\n" + "="*70)
    print("Example 3: Multi-Document Query with Citations")
    print("="*70 + "\n")
    
    manager = get_file_search_manager()
    
    # List stores
    stores = manager.list_file_search_stores()
    if not stores:
        print("✗ No stores found. Run example 1 first.\n")
        return
    
    store_names = [store["name"] for store in stores]
    print(f"📚 Querying {len(store_names)} store(s)\n")
    
    # Ask a question
    query = "What are the main topics covered in the documents?"
    print(f"❓ Question: {query}\n")
    
    response = manager.query_file_search(
        query=query,
        store_names=store_names,
        model="gemini-2.5-flash",
        include_grounding_metadata=True
    )
    
    print(f"📝 Answer:\n{response['text']}\n")
    
    # Show detailed citations
    if response.get('grounding_metadata'):
        chunks = response['grounding_metadata'].get('grounding_chunks', [])
        
        if chunks:
            print("📌 Sources & Citations:")
            for i, chunk in enumerate(chunks, 1):
                print(f"\n  Source {i}:")
                print(f"    Document: {chunk.get('document_name', 'Unknown')}")
                print(f"    Page: {chunk.get('page_number', 'N/A')}")
                chunk_text = chunk.get('chunk_text', '')
                if chunk_text:
                    preview = chunk_text[:100] + "..." if len(chunk_text) > 100 else chunk_text
                    print(f"    Excerpt: {preview}")
    
    print("\n✓ Example 3 complete!")


def example_4_list_and_manage_stores():
    """
    Example 4: List, create, and delete stores.
    """
    print("\n" + "="*70)
    print("Example 4: Store Management")
    print("="*70 + "\n")
    
    manager = get_file_search_manager()
    
    # List existing stores
    print("📋 Listing all stores:")
    stores = manager.list_file_search_stores()
    
    if stores:
        for i, store in enumerate(stores, 1):
            print(f"  {i}. {store['display_name']} ({store['name']})")
        print(f"\n  Total: {len(stores)} store(s)\n")
    else:
        print("  No stores found\n")
    
    # Create a new store
    print("📦 Creating a new store...")
    store = manager.create_file_search_store("Test Store for Demo")
    new_store_name = store["name"]
    print(f"✓ Created: {store['display_name']} ({new_store_name})\n")
    
    # List again
    stores = manager.list_file_search_stores()
    print(f"📋 Now have {len(stores)} store(s)\n")
    
    # Delete the test store
    print(f"🗑️  Deleting test store...")
    manager.delete_file_search_store(new_store_name)
    print("✓ Deleted\n")
    
    # List final count
    stores = manager.list_file_search_stores()
    print(f"📋 Final count: {len(stores)} store(s)\n")
    
    print("✓ Example 4 complete!")


def example_5_async_upload():
    """
    Example 5: Async upload without waiting for completion.
    """
    print("\n" + "="*70)
    print("Example 5: Async Upload (Non-blocking)")
    print("="*70 + "\n")
    
    manager = get_file_search_manager()
    
    # Get or create store
    stores = manager.list_file_search_stores()
    if stores:
        store_name = stores[0]["name"]
    else:
        store = manager.create_file_search_store("Async Upload Store")
        store_name = store["name"]
    
    print(f"📦 Using store: {store_name}\n")
    
    # Start async upload
    gcs_uri = "gs://your-bucket/large-file.pdf"
    
    print(f"📤 Starting async upload of {gcs_uri}...")
    
    try:
        result = manager.import_gcs_file_to_store(
            gcs_uri=gcs_uri,
            store_name=store_name,
            display_name="Large Document",
            wait_for_completion=False  # Don't wait
        )
        
        operation_name = result.get('operation_name')
        print(f"✓ Upload started")
        print(f"  Operation: {operation_name}")
        print(f"  Status: {result['status']}\n")
        
        # Later, check status
        print("⏳ Checking operation status...")
        status = manager.get_operation_status(operation_name)
        print(f"  Done: {status['done']}")
        print(f"  Status: {status['status']}\n")
        
    except Exception as e:
        print(f"✗ Operation failed: {e}\n")
    
    print("✓ Example 5 complete!")


def example_6_integration_with_user_workflow():
    """
    Example 6: Integration pattern for user document workflow.
    """
    print("\n" + "="*70)
    print("Example 6: User Document Workflow Integration")
    print("="*70 + "\n")
    
    manager = get_file_search_manager()
    
    # Simulate a user uploading documents
    user_id = "user123"
    user_store_name = f"user_{user_id}_documents"
    
    print(f"👤 User: {user_id}")
    print(f"📁 Creating/getting user's File Search store...\n")
    
    # Create user-specific store (or get existing)
    try:
        store = manager.create_file_search_store(f"Documents for {user_id}")
        store_name = store["name"]
        print(f"✓ Created store: {store_name}\n")
    except Exception as e:
        # Store might already exist
        stores = manager.list_file_search_stores()
        user_stores = [s for s in stores if user_id in s.get('display_name', '')]
        if user_stores:
            store_name = user_stores[0]["name"]
            print(f"✓ Using existing store: {store_name}\n")
        else:
            print(f"✗ Error: {e}\n")
            return
    
    # Simulate uploading user's documents
    user_documents = [
        {"gcs_uri": "gs://bucket/user123/property-deed.pdf", "type": "Deed"},
        {"gcs_uri": "gs://bucket/user123/insurance.pdf", "type": "Insurance"},
        {"gcs_uri": "gs://bucket/user123/inspection.pdf", "type": "Inspection"}
    ]
    
    print("📄 Importing user documents:")
    for doc in user_documents:
        print(f"  • {doc['type']}: {doc['gcs_uri']}")
    print()
    
    # In production, you would actually import these
    # For demo, we'll skip actual import
    print("  (Skipping actual import for demo)\n")
    
    # Simulate user asking a question
    user_query = "What is my property address and when was it last inspected?"
    print(f"❓ User asks: '{user_query}'\n")
    
    # Query the user's documents
    print("🤖 Generating answer from user's documents...\n")
    
    # In production:
    # response = manager.query_file_search(
    #     query=user_query,
    #     store_names=[store_name]
    # )
    # print(f"📝 Answer: {response['text']}\n")
    
    print("✓ Example 6 complete!")
    print("  Tip: Adapt this pattern for your user document workflow")


def main():
    """Run all examples."""
    print("\n" + "="*70)
    print("GEMINI FILE SEARCH - USAGE EXAMPLES")
    print("="*70)
    
    # Check API key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("\n✗ ERROR: GEMINI_API_KEY environment variable not set")
        print("\n  Get your API key: https://aistudio.google.com/apikey")
        print("  Then set it: export GEMINI_API_KEY=your-key\n")
        return
    
    print(f"\n✓ GEMINI_API_KEY is set\n")
    
    # Menu
    examples = {
        "1": ("Create Store, Upload, Query", example_1_create_store_and_query),
        "2": ("Upload Local File", example_2_upload_local_file),
        "3": ("Multi-Document Query", example_3_multi_document_query),
        "4": ("Store Management", example_4_list_and_manage_stores),
        "5": ("Async Upload", example_5_async_upload),
        "6": ("User Workflow Integration", example_6_integration_with_user_workflow),
        "all": ("Run All Examples", None),
    }
    
    print("Choose an example to run:")
    for key, (name, _) in examples.items():
        print(f"  {key}. {name}")
    
    choice = input("\nEnter choice (1-6 or 'all'): ").strip()
    
    if choice == "all":
        for key in ["1", "2", "3", "4", "5", "6"]:
            try:
                examples[key][1]()
            except Exception as e:
                print(f"\n✗ Example {key} failed: {e}\n")
    elif choice in examples and examples[choice][1]:
        try:
            examples[choice][1]()
        except Exception as e:
            print(f"\n✗ Example failed: {e}\n")
    else:
        print("\n✗ Invalid choice\n")
    
    print("\n" + "="*70)
    print("Examples completed!")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()


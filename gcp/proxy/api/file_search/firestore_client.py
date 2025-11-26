# Firestore Client for Gemini File Search Metadata
# Handles CRUD operations for file metadata and search stores

import os
import logging
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter

from .models import (
    FileMetadata,
    FileSearchStore,
    FileStatus,
    StoreType,
    FileListRequest,
)

logger = logging.getLogger(__name__)


class FileSearchFirestoreClient:
    """
    Firestore client for managing Gemini File Search metadata.
    
    Collections:
    - gemini_files: File metadata with user_id, timestamps, and Gemini references
    - file_search_stores: Search store configurations per user/property
    """
    
    FILES_COLLECTION = "gemini_files"
    STORES_COLLECTION = "file_search_stores"
    
    def __init__(self, project_id: Optional[str] = None):
        """Initialize Firestore client."""
        self.project_id = project_id or os.environ.get("GCP_PROJECT_ID")
        self.db = firestore.Client(project=self.project_id)
        logger.info(f"Initialized FileSearchFirestoreClient for project: {self.project_id}")
    
    # ==================== File Metadata Operations ====================
    
    def create_file(self, file_metadata: FileMetadata) -> FileMetadata:
        """Create a new file metadata record."""
        doc_ref = self.db.collection(self.FILES_COLLECTION).document(file_metadata.id)
        doc_ref.set(file_metadata.model_dump())
        logger.info(f"Created file metadata: {file_metadata.id} for user: {file_metadata.user_id}")
        return file_metadata
    
    def get_file(self, file_id: str) -> Optional[FileMetadata]:
        """Get file metadata by ID."""
        doc_ref = self.db.collection(self.FILES_COLLECTION).document(file_id)
        doc = doc_ref.get()
        if doc.exists:
            return FileMetadata(**doc.to_dict())
        return None
    
    def get_file_by_gemini_name(self, gemini_file_name: str) -> Optional[FileMetadata]:
        """Get file metadata by Gemini file name."""
        query = (
            self.db.collection(self.FILES_COLLECTION)
            .where(filter=FieldFilter("gemini_file_name", "==", gemini_file_name))
            .limit(1)
        )
        docs = list(query.stream())
        if docs:
            return FileMetadata(**docs[0].to_dict())
        return None
    
    def update_file(self, file_id: str, updates: Dict[str, Any]) -> Optional[FileMetadata]:
        """Update file metadata."""
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        doc_ref = self.db.collection(self.FILES_COLLECTION).document(file_id)
        doc_ref.update(updates)
        logger.info(f"Updated file metadata: {file_id}")
        return self.get_file(file_id)
    
    def update_file_status(
        self, 
        file_id: str, 
        status: FileStatus, 
        gemini_file_name: Optional[str] = None,
        gemini_file_uri: Optional[str] = None,
        error_message: Optional[str] = None,
        expires_at: Optional[datetime] = None,
    ) -> Optional[FileMetadata]:
        """Update file status after Gemini processing."""
        updates = {
            "status": status.value,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        if gemini_file_name:
            updates["gemini_file_name"] = gemini_file_name
        if gemini_file_uri:
            updates["gemini_file_uri"] = gemini_file_uri
        if error_message:
            updates["error_message"] = error_message
        if expires_at:
            updates["expires_at"] = expires_at.isoformat()
        if status == FileStatus.ACTIVE:
            updates["processed_at"] = datetime.now(timezone.utc).isoformat()
        
        return self.update_file(file_id, updates)
    
    def delete_file(self, file_id: str) -> bool:
        """Delete file metadata (soft delete - marks as DELETED)."""
        try:
            self.update_file(file_id, {
                "status": FileStatus.DELETED.value,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info(f"Soft deleted file: {file_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file {file_id}: {e}")
            return False
    
    def hard_delete_file(self, file_id: str) -> bool:
        """Permanently delete file metadata."""
        try:
            doc_ref = self.db.collection(self.FILES_COLLECTION).document(file_id)
            doc_ref.delete()
            logger.info(f"Hard deleted file: {file_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to hard delete file {file_id}: {e}")
            return False
    
    def list_files(self, request: FileListRequest) -> List[FileMetadata]:
        """List files for a user with optional filters."""
        query = self.db.collection(self.FILES_COLLECTION)
        
        # Filter by user_id
        query = query.where(filter=FieldFilter("user_id", "==", request.user_id))
        
        # Optional property filter
        if request.property_id:
            query = query.where(filter=FieldFilter("property_id", "==", request.property_id))
        
        # Optional status filter
        if request.status:
            query = query.where(filter=FieldFilter("status", "==", request.status.value))
        
        # Ordering
        direction = firestore.Query.DESCENDING if request.order_desc else firestore.Query.ASCENDING
        query = query.order_by(request.order_by, direction=direction)
        
        # Pagination
        query = query.offset(request.offset).limit(request.limit)
        
        files = []
        for doc in query.stream():
            files.append(FileMetadata(**doc.to_dict()))
        
        return files
    
    def list_active_files_for_user(
        self, 
        user_id: str, 
        property_id: Optional[str] = None
    ) -> List[FileMetadata]:
        """Get all active (searchable) files for a user."""
        return self.list_files(FileListRequest(
            user_id=user_id,
            property_id=property_id,
            status=FileStatus.ACTIVE,
            limit=1000,
        ))
    
    def get_files_by_gcs_uris(
        self, 
        user_id: str, 
        gcs_uris: List[str]
    ) -> List[FileMetadata]:
        """Get file metadata for specific GCS URIs."""
        files = []
        for gcs_uri in gcs_uris:
            query = (
                self.db.collection(self.FILES_COLLECTION)
                .where(filter=FieldFilter("user_id", "==", user_id))
                .where(filter=FieldFilter("gcs_uri", "==", gcs_uri))
                .limit(1)
            )
            for doc in query.stream():
                files.append(FileMetadata(**doc.to_dict()))
        return files
    
    def get_gemini_file_names_for_context(
        self,
        user_id: str,
        context_doc_uris: Optional[List[str]] = None,
    ) -> List[str]:
        """
        Get Gemini file names for context documents.
        Used by agents to resolve context_doc_uris to Gemini file references.
        """
        if not context_doc_uris:
            # Return all active files for user
            files = self.list_active_files_for_user(user_id)
        else:
            # Return files matching the URIs
            files = self.get_files_by_gcs_uris(user_id, context_doc_uris)
        
        return [
            f.gemini_file_name 
            for f in files 
            if f.gemini_file_name and f.status == FileStatus.ACTIVE
        ]
    
    # ==================== Store Operations ====================
    
    def create_store(self, store: FileSearchStore) -> FileSearchStore:
        """Create a new file search store."""
        doc_ref = self.db.collection(self.STORES_COLLECTION).document(store.id)
        doc_ref.set(store.model_dump())
        logger.info(f"Created file search store: {store.id} for user: {store.user_id}")
        return store
    
    def get_store(self, store_id: str) -> Optional[FileSearchStore]:
        """Get store by ID."""
        doc_ref = self.db.collection(self.STORES_COLLECTION).document(store_id)
        doc = doc_ref.get()
        if doc.exists:
            return FileSearchStore(**doc.to_dict())
        return None
    
    def get_store_by_gemini_name(self, gemini_store_name: str) -> Optional[FileSearchStore]:
        """Get store by Gemini store name."""
        query = (
            self.db.collection(self.STORES_COLLECTION)
            .where(filter=FieldFilter("gemini_store_name", "==", gemini_store_name))
            .limit(1)
        )
        docs = list(query.stream())
        if docs:
            return FileSearchStore(**docs[0].to_dict())
        return None
    
    def update_store(self, store_id: str, updates: Dict[str, Any]) -> Optional[FileSearchStore]:
        """Update store configuration."""
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        doc_ref = self.db.collection(self.STORES_COLLECTION).document(store_id)
        doc_ref.update(updates)
        return self.get_store(store_id)
    
    def increment_store_file_count(self, store_id: str, delta: int = 1) -> None:
        """Increment or decrement store file count."""
        doc_ref = self.db.collection(self.STORES_COLLECTION).document(store_id)
        doc_ref.update({
            "file_count": firestore.Increment(delta),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    
    def get_or_create_user_store(
        self, 
        user_id: str, 
        property_id: Optional[str] = None,
        store_type: StoreType = StoreType.USER_DOCUMENTS,
    ) -> FileSearchStore:
        """Get existing store or create a new one for user/property."""
        # Query for existing store
        query = (
            self.db.collection(self.STORES_COLLECTION)
            .where(filter=FieldFilter("user_id", "==", user_id))
            .where(filter=FieldFilter("store_type", "==", store_type.value))
            .where(filter=FieldFilter("is_active", "==", True))
        )
        
        if property_id:
            query = query.where(filter=FieldFilter("property_id", "==", property_id))
        
        query = query.limit(1)
        docs = list(query.stream())
        
        if docs:
            return FileSearchStore(**docs[0].to_dict())
        
        # Create new store
        display_name = f"{store_type.value}_{user_id}"
        if property_id:
            display_name = f"{display_name}_{property_id}"
        
        new_store = FileSearchStore(
            user_id=user_id,
            property_id=property_id,
            store_type=store_type,
            display_name=display_name,
        )
        return self.create_store(new_store)
    
    def list_stores_for_user(
        self, 
        user_id: str, 
        property_id: Optional[str] = None,
        active_only: bool = True,
    ) -> List[FileSearchStore]:
        """List all stores for a user."""
        query = (
            self.db.collection(self.STORES_COLLECTION)
            .where(filter=FieldFilter("user_id", "==", user_id))
        )
        
        if property_id:
            query = query.where(filter=FieldFilter("property_id", "==", property_id))
        
        if active_only:
            query = query.where(filter=FieldFilter("is_active", "==", True))
        
        query = query.order_by("created_at", direction=firestore.Query.DESCENDING)
        
        stores = []
        for doc in query.stream():
            stores.append(FileSearchStore(**doc.to_dict()))
        
        return stores
    
    def deactivate_store(self, store_id: str) -> bool:
        """Deactivate a store (soft delete)."""
        try:
            self.update_store(store_id, {"is_active": False})
            return True
        except Exception as e:
            logger.error(f"Failed to deactivate store {store_id}: {e}")
            return False
    
    # ==================== Batch Operations ====================
    
    def batch_create_files(self, files: List[FileMetadata]) -> List[FileMetadata]:
        """Create multiple file metadata records in a batch."""
        batch = self.db.batch()
        for file in files:
            doc_ref = self.db.collection(self.FILES_COLLECTION).document(file.id)
            batch.set(doc_ref, file.model_dump())
        batch.commit()
        logger.info(f"Batch created {len(files)} file records")
        return files
    
    def batch_update_file_status(
        self, 
        file_updates: List[Dict[str, Any]]
    ) -> None:
        """
        Batch update file statuses.
        Each update dict should have: file_id, status, and optional fields.
        """
        batch = self.db.batch()
        now = datetime.now(timezone.utc).isoformat()
        
        for update in file_updates:
            file_id = update.pop("file_id")
            update["updated_at"] = now
            doc_ref = self.db.collection(self.FILES_COLLECTION).document(file_id)
            batch.update(doc_ref, update)
        
        batch.commit()
        logger.info(f"Batch updated {len(file_updates)} files")
    
    # ==================== Cleanup Operations ====================
    
    def cleanup_expired_files(self) -> int:
        """Mark expired files as EXPIRED. Returns count of cleaned files."""
        now = datetime.now(timezone.utc)
        
        query = (
            self.db.collection(self.FILES_COLLECTION)
            .where(filter=FieldFilter("status", "==", FileStatus.ACTIVE.value))
            .where(filter=FieldFilter("expires_at", "<", now.isoformat()))
        )
        
        count = 0
        batch = self.db.batch()
        
        for doc in query.stream():
            batch.update(doc.reference, {
                "status": FileStatus.EXPIRED.value,
                "updated_at": now.isoformat(),
            })
            count += 1
            
            # Firestore batches limited to 500 operations
            if count % 500 == 0:
                batch.commit()
                batch = self.db.batch()
        
        if count % 500 != 0:
            batch.commit()
        
        logger.info(f"Cleaned up {count} expired files")
        return count
    
    def get_files_needing_refresh(self, hours_before_expiry: int = 6) -> List[FileMetadata]:
        """
        Get active files that will expire soon and may need to be refreshed.
        Gemini files expire after 48 hours, so we can proactively re-upload.
        """
        from datetime import timedelta
        
        threshold = datetime.now(timezone.utc) + timedelta(hours=hours_before_expiry)
        
        query = (
            self.db.collection(self.FILES_COLLECTION)
            .where(filter=FieldFilter("status", "==", FileStatus.ACTIVE.value))
            .where(filter=FieldFilter("expires_at", "<", threshold.isoformat()))
            .where(filter=FieldFilter("expires_at", ">", datetime.now(timezone.utc).isoformat()))
        )
        
        files = []
        for doc in query.stream():
            files.append(FileMetadata(**doc.to_dict()))
        
        return files


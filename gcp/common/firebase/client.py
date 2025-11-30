"""
Firebase Admin SDK Client for GCP services.

Provides Firebase Admin initialization and utilities for:
- Authentication (verify ID tokens)
- Firestore access
- Other Firebase Admin operations
"""

import logging
from typing import Optional, Dict, Any
import firebase_admin
from firebase_admin import auth, credentials, firestore

from .config import FirebaseConfig

logger = logging.getLogger(__name__)


class FirebaseError(Exception):
    """Base exception for Firebase client errors."""
    def __init__(
        self, 
        message: str, 
        status_code: Optional[int] = None, 
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class FirebaseClient:
    """
    Firebase Admin SDK client wrapper.
    
    Handles initialization and provides access to Firebase Admin services.
    
    Example:
        config = FirebaseConfig.from_env()
        client = FirebaseClient(config)
        
        # Verify ID token
        decoded_token = client.verify_id_token(token)
        
        # Get Firestore client
        db = client.get_firestore()
    """
    
    def __init__(self, config: Optional[FirebaseConfig] = None):
        """
        Initialize Firebase Admin SDK client.
        
        Args:
            config: FirebaseConfig instance (optional, will use default if not provided)
        """
        self.config = config or FirebaseConfig.from_env()
        self._app = None
        self._firestore_client = None
        self._initialized = False
        
        self._initialize()
    
    def _initialize(self):
        """Initialize Firebase Admin SDK."""
        if self._initialized:
            return
        
        try:
            # Check if Firebase Admin is already initialized
            if firebase_admin._apps:
                logger.info("Firebase Admin SDK already initialized, reusing existing app")
                self._app = firebase_admin.get_app()
                self._initialized = True
                return
            
            # Initialize Firebase Admin
            cred = None
            if self.config.credentials_path:
                logger.info(f"Initializing Firebase Admin with credentials from: {self.config.credentials_path}")
                cred = credentials.Certificate(self.config.credentials_path)
            elif not self.config.use_default_credentials:
                raise ValueError("No credentials provided and use_default_credentials is False")
            else:
                logger.info("Initializing Firebase Admin with default credentials")
                cred = credentials.ApplicationDefault()
            
            # Initialize app
            options = {}
            if self.config.project_id:
                options["project_id"] = self.config.project_id
            
            self._app = firebase_admin.initialize_app(cred, options=options)
            self._initialized = True
            
            project_id = firebase_admin.get_app().project_id
            logger.info(f"Firebase Admin SDK initialized successfully. Project: {project_id}")
            
        except Exception as e:
            logger.error(f"Failed to initialize Firebase Admin SDK: {e}")
            raise FirebaseError(
                message=f"Failed to initialize Firebase Admin SDK: {e}",
                details={"config": self.config.__dict__}
            )
    
    def verify_id_token(self, id_token: str) -> Dict[str, Any]:
        """
        Verify a Firebase ID token.
        
        Args:
            id_token: Firebase ID token string
            
        Returns:
            Dict containing decoded token claims
            
        Raises:
            FirebaseError: If token verification fails
            
        Example:
            decoded_token = client.verify_id_token(token_string)
            user_id = decoded_token['uid']
        """
        try:
            decoded_token = auth.verify_id_token(id_token)
            logger.debug(f"Successfully verified ID token for user: {decoded_token.get('uid')}")
            return decoded_token
        except Exception as e:
            logger.error(f"Failed to verify ID token: {e}")
            raise FirebaseError(
                message=f"Failed to verify ID token: {e}",
                details={"token_length": len(id_token)}
            )
    
    def get_user(self, uid: str) -> Dict[str, Any]:
        """
        Get user information by UID.
        
        Args:
            uid: User UID
            
        Returns:
            Dict containing user information
            
        Raises:
            FirebaseError: If user retrieval fails
        """
        try:
            user = auth.get_user(uid)
            return {
                "uid": user.uid,
                "email": user.email,
                "display_name": user.display_name,
                "disabled": user.disabled,
                "email_verified": user.email_verified,
            }
        except Exception as e:
            logger.error(f"Failed to get user: {e}")
            raise FirebaseError(
                message=f"Failed to get user: {e}",
                details={"uid": uid}
            )
    
    def get_firestore(self):
        """
        Get Firestore client instance.
        
        Returns:
            Firestore client instance
            
        Example:
            db = client.get_firestore()
            doc_ref = db.collection('users').document('user123')
        """
        if self._firestore_client is None:
            self._firestore_client = firestore.client(self._app)
        return self._firestore_client
    
    def get_app(self):
        """
        Get Firebase Admin app instance.
        
        Returns:
            Firebase Admin app instance
        """
        return self._app
    
    @property
    def project_id(self) -> Optional[str]:
        """Get the Firebase project ID."""
        if self._app:
            return self._app.project_id
        return self.config.project_id


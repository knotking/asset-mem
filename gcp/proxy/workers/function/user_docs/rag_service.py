import logging
import mimetypes
from datetime import datetime, timezone
import vertexai
from vertexai import rag
from google.cloud.aiplatform_v1.types.vertex_rag_data_service import ImportRagFilesResponse

from config import Config
from utils import serialize_import_result, is_media_mime_type
from prompts import parsing_prompt_media
from exceptions import ConfigurationError, RagImportError

logger = logging.getLogger(__name__)

class RagService:
    def __init__(self):
        # Validate configuration immediately
        is_valid, error_msg = Config.validate()
        if not is_valid:
            raise ConfigurationError(error_msg)
        
        # Initialize Vertex AI
        vertexai.init(project=Config.PROJECT_ID, location=Config.LOCATION)
        logger.info(f"Initialized Vertex AI with project={Config.PROJECT_ID}, location={Config.LOCATION}")

    def import_files(self, gcs_urls: list, user_id: str):
        """
        Orchestrates the import of files into the RAG corpus.
        Separates documents and media, and imports them accordingly.
        """
        logger.info(f"Importing files to RAG corpus: {gcs_urls}, corpus: {Config.RAG_CORPUS}")
        
        documents_list, media_list = self._classify_files(gcs_urls)
        logger.info(f"Document files: {documents_list}")
        logger.info(f"Media files: {media_list}")

        sink_base_path = self._get_sink_path(user_id)
        
        try:
            documents_result = self._import_documents(documents_list, sink_base_path)
            media_result = self._import_media(media_list, sink_base_path)
            
            logger.info(f"Document Results: {documents_result}, Media Results: {media_result}")

            return {
                "document_import_result": serialize_import_result(documents_result),
                "media_import_result": serialize_import_result(media_result)
            }
        except Exception as e:
            logger.error(f"Failed to import to RAG corpus: {e}")
            raise RagImportError(str(e))

    def _classify_files(self, gcs_urls: list):
        documents_list = []
        media_list = []
        for gcs_url in gcs_urls:
            mime_type, _ = mimetypes.guess_type(gcs_url)
            if is_media_mime_type(mime_type):
                media_list.append(gcs_url)
            else:
                documents_list.append(gcs_url)
        return documents_list, media_list

    def _get_sink_path(self, user_id: str) -> str:
        return f"gs://{Config.GCS_BUCKET}/{Config.USER_UPLOAD_FOLDER}/{user_id}/import-results/{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"

    def _import_documents(self, documents_list: list, sink_base_path: str):
        if not documents_list:
            return None
        
        llmParserConfig = rag.LlmParserConfig(
            model_name="gemini-3.1-flash-lite",
        )
        return rag.import_files(
            corpus_name=Config.RAG_CORPUS,
            paths=documents_list,
            llm_parser=llmParserConfig,
            import_result_sink=f"{sink_base_path}-documents.ndjson"
        )

    def _import_media(self, media_list: list, sink_base_path: str):
        if not media_list:
            return None

        llmParserConfig = rag.LlmParserConfig(
            model_name="gemini-3.1-flash-lite",
            custom_parsing_prompt=parsing_prompt_media()
        )
        return rag.import_files(
            corpus_name=Config.RAG_CORPUS,
            paths=media_list,
            llm_parser=llmParserConfig,
            import_result_sink=f"{sink_base_path}-media.ndjson"
        )

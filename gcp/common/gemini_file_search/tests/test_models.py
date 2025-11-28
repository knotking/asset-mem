"""Tests for Gemini File Search models."""

import pytest
from ..models import (
    FileSearchStore,
    FileSearchDocument,
    Citation,
    GroundingMetadata,
    GenerateContentResponse,
    Operation,
    OperationStatus,
)


class TestFileSearchStore:
    """Test FileSearchStore model."""
    
    def test_store_id_extraction(self):
        """Test store ID extraction from name."""
        store = FileSearchStore(name="fileSearchStores/12345")
        assert store.store_id == "12345"
    
    def test_store_id_without_prefix(self):
        """Test store ID when name doesn't have prefix."""
        store = FileSearchStore(name="12345")
        assert store.store_id == "12345"


class TestFileSearchDocument:
    """Test FileSearchDocument model."""
    
    def test_document_id_extraction(self):
        """Test document ID extraction from name."""
        doc = FileSearchDocument(name="fileSearchStores/123/documents/456")
        assert doc.document_id == "456"


class TestCitation:
    """Test Citation model."""
    
    def test_citation_creation(self):
        """Test creating a citation."""
        citation = Citation(
            uri="https://example.com/doc.pdf",
            title="Example Document",
            start_index=0,
            end_index=100
        )
        
        assert citation.uri == "https://example.com/doc.pdf"
        assert citation.title == "Example Document"
        assert citation.start_index == 0
        assert citation.end_index == 100


class TestGenerateContentResponse:
    """Test GenerateContentResponse model."""
    
    def test_citations_property(self):
        """Test citations property."""
        citation = Citation(uri="https://example.com/doc.pdf")
        metadata = GroundingMetadata(citations=[citation])
        response = GenerateContentResponse(
            text="Test response",
            grounding_metadata=metadata
        )
        
        assert len(response.citations) == 1
        assert response.citations[0].uri == "https://example.com/doc.pdf"
    
    def test_has_citations(self):
        """Test has_citations property."""
        citation = Citation(uri="https://example.com/doc.pdf")
        metadata = GroundingMetadata(citations=[citation])
        response_with_citations = GenerateContentResponse(
            text="Test",
            grounding_metadata=metadata
        )
        response_without_citations = GenerateContentResponse(
            text="Test",
            grounding_metadata=None
        )
        
        assert response_with_citations.has_citations is True
        assert response_without_citations.has_citations is False


class TestOperation:
    """Test Operation model."""
    
    def test_status_pending(self):
        """Test operation status when not done."""
        operation = Operation(name="op/123", done=False)
        assert operation.status == OperationStatus.PENDING
    
    def test_status_done(self):
        """Test operation status when done successfully."""
        operation = Operation(
            name="op/123",
            done=True,
            response={"result": "success"}
        )
        assert operation.status == OperationStatus.DONE
    
    def test_status_failed(self):
        """Test operation status when failed."""
        operation = Operation(
            name="op/123",
            done=True,
            error={"message": "Error occurred"}
        )
        assert operation.status == OperationStatus.FAILED


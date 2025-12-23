"""
Pydantic models for Gemini Google Search Grounding API.

Supports:
- Google Search Grounding tool configuration
- GenerateContent with Google Search Grounding
- Response parsing and grounding metadata with citations
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class WebChunk(BaseModel):
    """Web search result chunk data."""
    uri: Optional[str] = Field(None, description="Web source URI")
    title: Optional[str] = Field(None, description="Web source title")


class GroundingChunk(BaseModel):
    """Grounding chunk containing web search data."""
    web: Optional[WebChunk] = Field(None, description="Web search chunk data")


class GroundingSupport(BaseModel):
    """Grounding support linking text segments to sources."""
    segment: Optional[Dict[str, Any]] = Field(
        None,
        description="Text segment with startIndex, endIndex, and text"
    )
    grounding_chunk_indices: Optional[List[int]] = Field(
        None,
        description="Indices into grounding_chunks array"
    )
    
    @property
    def start_index(self) -> Optional[int]:
        """Get start index of the text segment."""
        if self.segment:
            return self.segment.get("start_index")
        return None
    
    @property
    def end_index(self) -> Optional[int]:
        """Get end index of the text segment."""
        if self.segment:
            return self.segment.get("end_index")
        return None
    
    @property
    def text(self) -> Optional[str]:
        """Get text of the segment."""
        if self.segment:
            return self.segment.get("text")
        return None


class GroundingMetadata(BaseModel):
    """Grounding metadata from Google Search Grounding."""
    web_search_queries: Optional[List[str]] = Field(
        None,
        description="Array of search queries used by the model"
    )
    search_entry_point: Optional[Dict[str, Any]] = Field(
        None,
        description="HTML and CSS for rendering search suggestions widget"
    )
    grounding_chunks: Optional[List[GroundingChunk]] = Field(
        None,
        description="Array of web sources (uri and title)"
    )
    grounding_supports: Optional[List[GroundingSupport]] = Field(
        None,
        description="Array linking response text segments to sources"
    )
    
    @property
    def web_citations(self) -> List[WebChunk]:
        """Get all web citations from grounding chunks."""
        citations = []
        if self.grounding_chunks:
            for chunk in self.grounding_chunks:
                if chunk.web:
                    citations.append(chunk.web)
        return citations
    
    @property
    def has_web_citations(self) -> bool:
        """Check if response has web citations."""
        return len(self.web_citations) > 0
    
    @property
    def citation_count(self) -> int:
        """Get total number of web citations."""
        return len(self.web_citations)


class GenerateContentConfig(BaseModel):
    """Configuration for generateContent with Google Search Grounding."""
    model: str = Field(
        default="gemini-3-flash-preview",
        description="Model to use (must support Google Search Grounding)"
    )
    temperature: Optional[float] = Field(None, ge=0.0, le=2.0, description="Temperature")
    top_p: Optional[float] = Field(None, ge=0.0, le=1.0, description="Top-p sampling")
    top_k: Optional[int] = Field(None, ge=1, description="Top-k sampling")
    max_output_tokens: Optional[int] = Field(None, ge=1, description="Max output tokens")
    enable_google_search: bool = Field(
        default=True,
        description="Enable Google Search Grounding tool"
    )
    enable_url_context: bool = Field(
        default=False,
        description="Enable URL context tool (can be combined with Google Search)"
    )
    response_mime_type: Optional[str] = Field(
        None,
        description="Response MIME type (e.g., 'application/json')"
    )
    response_schema: Optional[Dict[str, Any]] = Field(
        None,
        description="Response schema for structured output"
    )


class GenerateContentResponse(BaseModel):
    """Response from generateContent with Google Search Grounding."""
    text: str = Field(..., description="Generated text content")
    grounding_metadata: Optional[GroundingMetadata] = Field(
        None,
        description="Grounding metadata including web search citations"
    )
    model: Optional[str] = Field(None, description="Model used")
    finish_reason: Optional[str] = Field(None, description="Finish reason")
    usage_metadata: Optional[Dict[str, Any]] = Field(
        None,
        description="Token usage metadata"
    )
    
    @property
    def web_citations(self) -> List[WebChunk]:
        """Get all web citations from grounding metadata."""
        if self.grounding_metadata:
            return self.grounding_metadata.web_citations
        return []
    
    @property
    def has_google_search_grounding(self) -> bool:
        """Check if response used Google Search Grounding."""
        return (
            self.grounding_metadata is not None
            and self.grounding_metadata.has_web_citations
        )
    
    @property
    def search_queries(self) -> List[str]:
        """Get list of search queries used."""
        if self.grounding_metadata and self.grounding_metadata.web_search_queries:
            return self.grounding_metadata.web_search_queries
        return []
    
    @property
    def citation_count(self) -> int:
        """Get total number of citations."""
        if self.grounding_metadata:
            return self.grounding_metadata.citation_count
        return 0
    
    def add_citations_to_text(self, format_markdown: bool = True) -> str:
        """
        Add inline citations to the response text.
        
        Args:
            format_markdown: If True, format citations as markdown links [1](url)
                            If False, format as plain text [1] url
            
        Returns:
            str: Text with inline citations added
        """
        if not self.grounding_metadata or not self.grounding_metadata.grounding_supports:
            return self.text
        
        text = self.text
        chunks = self.grounding_metadata.grounding_chunks or []
        supports = self.grounding_metadata.grounding_supports
        
        # Sort supports by end_index in descending order to avoid shifting issues
        sorted_supports = sorted(
            supports,
            key=lambda s: s.end_index or 0,
            reverse=True
        )
        
        for support in sorted_supports:
            end_index = support.end_index
            if end_index is None or not support.grounding_chunk_indices:
                continue
            
            # Create citation string
            citation_links = []
            for idx in support.grounding_chunk_indices:
                if 0 <= idx < len(chunks) and chunks[idx].web:
                    web_chunk = chunks[idx].web
                    if web_chunk and web_chunk.uri:
                        citation_num = idx + 1
                        if format_markdown:
                            citation_links.append(f"[{citation_num}]({web_chunk.uri})")
                        else:
                            citation_links.append(f"[{citation_num}] {web_chunk.uri}")
            
            if citation_links:
                citation_string = ", ".join(citation_links)
                text = text[:end_index] + citation_string + text[end_index:]
        
        return text
    
    @property
    def prompt_token_count(self) -> Optional[int]:
        """Get prompt token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.get("prompt_token_count")
        return None
    
    @property
    def candidates_token_count(self) -> Optional[int]:
        """Get candidates token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.get("candidates_token_count")
        return None
    
    @property
    def total_token_count(self) -> Optional[int]:
        """Get total token count from usage metadata."""
        if self.usage_metadata:
            return self.usage_metadata.get("total_token_count")
        return None


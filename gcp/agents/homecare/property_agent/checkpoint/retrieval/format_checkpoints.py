"""Format raw Firestore checkpoint dicts for agent / inventory display."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def format_raw_checkpoints(checkpoints: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalize raw checkpoint documents into retrieval display records."""
    formatted_results: list[dict[str, Any]] = []
    for idx, checkpoint in enumerate(checkpoints):
        checkpoint_id = checkpoint.get("id")
        ai_analysis = checkpoint.get("aiAnalysis", {}) or {}

        summary_parts: list[str] = []
        if ai_analysis.get("summary"):
            summary_parts.append(f"Summary: {ai_analysis['summary']}")

        cp_location = checkpoint.get("location") or ai_analysis.get("detectedAsset")
        if cp_location:
            summary_parts.append(f"Location/Asset: {cp_location}")

        analysis_status = checkpoint.get("analysisStatus")
        if analysis_status:
            summary_parts.append(f"Status: {analysis_status}")

        detected_items = ai_analysis.get("detectedItems", []) or []
        if detected_items:
            items_text = ", ".join(str(x) for x in detected_items[:5])
            summary_parts.append(f"Detected items: {items_text}")

        issues = ai_analysis.get("issues", []) or []
        if issues:
            issue_descriptions: list[str] = []
            for issue in issues[:3]:
                if isinstance(issue, dict):
                    issue_descriptions.append(str(issue.get("description") or ""))
                elif isinstance(issue, str):
                    issue_descriptions.append(issue)
            if issue_descriptions:
                summary_parts.append(f"Issues: {'; '.join(issue_descriptions)}")

        conditions = ai_analysis.get("conditions", []) or []
        if conditions:
            conditions_text = ", ".join(str(x) for x in conditions[:3])
            summary_parts.append(f"Conditions: {conditions_text}")

        checkpoint_name = checkpoint.get("name") or cp_location or "Checkpoint"
        if checkpoint_name and checkpoint_name != "Checkpoint":
            summary_parts.insert(0, f"Checkpoint Name: {checkpoint_name}")

        formatted_checkpoint = {
            "checkpointId": checkpoint_id,
            "checkpointName": checkpoint_name,
            "text": "\n".join(summary_parts) if summary_parts else "No summary available",
            "location": cp_location,
            "createdAt": checkpoint.get("createdAt"),
            "summary": ai_analysis.get("summary", ""),
            "detectedItems": detected_items,
            "conditions": conditions,
            "issues": issues[:5] if issues else [],
            "similarity_score": checkpoint.get("similarity_score", 0.0),
        }
        logger.debug(
            "format_raw_checkpoints: idx=%d id=%s text_len=%d",
            idx + 1,
            checkpoint_id,
            len(formatted_checkpoint.get("text") or ""),
        )
        formatted_results.append(formatted_checkpoint)
    return formatted_results

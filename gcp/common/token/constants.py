"""Firestore paths for LLM token accounting."""

# One document per user (rolling totals + current UTC month).
TOKEN_USAGE_COLLECTION = "llm_token_usage"
# Subcollection: closed UTC month snapshots; document id = YYYY-MM.
PERIODS_SUBCOLLECTION = "periods"

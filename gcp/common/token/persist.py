"""Transactional Firestore updates for aggregated token totals."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict

from google.cloud import firestore

from .constants import PERIODS_SUBCOLLECTION, TOKEN_USAGE_COLLECTION

logger = logging.getLogger(__name__)


def _coerce_int_field(value: Any) -> int:
    if value is None:
        return 0
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _period_key_archivable(stored_key: Any, current_key: str) -> bool:
    """True if we have a prior month key to archive when rolling into ``current_key``."""
    if not isinstance(stored_key, str) or stored_key == current_key:
        return False
    # Expect YYYY-MM (UTC month from _current_quota_period_key)
    if len(stored_key) != 7 or stored_key[4] != "-":
        return False
    return True


def _current_quota_period_key() -> str:
    dt = datetime.now(timezone.utc)
    return f"{dt.year:04d}-{dt.month:02d}"


def persist_firestore_token_totals(
    user_id: str,
    sink: Dict[str, int],
    *,
    agent_stream_increment: int = 0,
    worker_llm_call_increment: int = 0,
) -> None:
    """
    Apply aggregated token deltas to ``llm_token_usage/{user_id}``.

    ``sink`` uses keys: prompt, candidates, total_only (and optional gemini_calls ignored here).
    """
    prompt = int(sink.get("prompt") or 0)
    candidates = int(sink.get("candidates") or 0)
    total_only = int(sink.get("total_only") or 0)
    combined = prompt + candidates
    total_delta = combined if combined else total_only

    if not user_id:
        logger.debug(
            "Token usage persist: skipped (no user_id) sink=%s",
            {k: v for k, v in sink.items() if k != "gemini_calls"},
        )
        return
    if total_delta == 0 and agent_stream_increment == 0 and worker_llm_call_increment == 0:
        logger.debug(
            "Token usage persist: skipped (nothing to record) user_id=%s sink=%s",
            user_id,
            sink,
        )
        return

    logger.debug(
        "Token usage persist: Firestore tx user_id=%s collection=%s "
        "+input=%s +output=%s +total=%s agent_stream+= %s worker_llm_calls+= %s",
        user_id,
        TOKEN_USAGE_COLLECTION,
        prompt,
        candidates,
        total_delta,
        agent_stream_increment,
        worker_llm_call_increment,
    )

    try:
        db = firestore.Client()
        ref = db.collection(TOKEN_USAGE_COLLECTION).document(user_id)
        period_key = _current_quota_period_key()

        @firestore.transactional
        def _persist_tx(
            transaction,
            doc_ref,
            p_prompt: int,
            p_candidates: int,
            p_total_delta: int,
            p_agent: int,
            p_worker: int,
            p_period_key: str,
        ) -> None:
            snap = doc_ref.get(transaction=transaction)
            data = snap.to_dict() if snap.exists else {}
            stored_key = data.get("quotaPeriodKey")
            new_period = stored_key != p_period_key or not snap.exists

            # On UTC month rollover, freeze the previous month's period* totals under periods/{YYYY-MM}.
            if (
                snap.exists
                and new_period
                and _period_key_archivable(stored_key, p_period_key)
            ):
                period_ref = doc_ref.collection(PERIODS_SUBCOLLECTION).document(
                    str(stored_key)
                )
                prior = period_ref.get(transaction=transaction)
                if not prior.exists:
                    transaction.set(
                        period_ref,
                        {
                            "quotaPeriodKey": stored_key,
                            "periodInputTokens": _coerce_int_field(
                                data.get("periodInputTokens")
                            ),
                            "periodOutputTokens": _coerce_int_field(
                                data.get("periodOutputTokens")
                            ),
                            "periodTotalTokens": _coerce_int_field(
                                data.get("periodTotalTokens")
                            ),
                            "periodAgentStreamCount": _coerce_int_field(
                                data.get("periodAgentStreamCount")
                            ),
                            "periodWorkerLlmCallCount": _coerce_int_field(
                                data.get("periodWorkerLlmCallCount")
                            ),
                            "archivedAt": firestore.SERVER_TIMESTAMP,
                        },
                    )
                    logger.info(
                        "Archived LLM token period user_id=%s period=%s",
                        doc_ref.id,
                        stored_key,
                    )

            if not snap.exists:
                transaction.set(
                    doc_ref,
                    {
                        "updatedAt": firestore.SERVER_TIMESTAMP,
                        "quotaPeriodKey": p_period_key,
                        "inputTokens": p_prompt,
                        "outputTokens": p_candidates,
                        "totalTokens": p_total_delta,
                        "agentStreamCount": p_agent,
                        "workerLlmCallCount": p_worker,
                        "periodInputTokens": p_prompt,
                        "periodOutputTokens": p_candidates,
                        "periodTotalTokens": p_total_delta,
                        "periodAgentStreamCount": p_agent,
                        "periodWorkerLlmCallCount": p_worker,
                    },
                )
                return

            updates: Dict[str, Any] = {
                "updatedAt": firestore.SERVER_TIMESTAMP,
                "quotaPeriodKey": p_period_key,
            }
            if p_prompt or p_candidates or p_total_delta:
                updates["inputTokens"] = firestore.Increment(p_prompt)
                updates["outputTokens"] = firestore.Increment(p_candidates)
                updates["totalTokens"] = firestore.Increment(p_total_delta)
            if p_agent:
                updates["agentStreamCount"] = firestore.Increment(p_agent)
            if p_worker:
                updates["workerLlmCallCount"] = firestore.Increment(p_worker)

            if new_period:
                updates["periodInputTokens"] = p_prompt
                updates["periodOutputTokens"] = p_candidates
                updates["periodTotalTokens"] = p_total_delta
                updates["periodAgentStreamCount"] = p_agent
                updates["periodWorkerLlmCallCount"] = p_worker
            else:
                if p_prompt or p_candidates or p_total_delta:
                    updates["periodInputTokens"] = firestore.Increment(p_prompt)
                    updates["periodOutputTokens"] = firestore.Increment(p_candidates)
                    updates["periodTotalTokens"] = firestore.Increment(p_total_delta)
                if p_agent:
                    updates["periodAgentStreamCount"] = firestore.Increment(p_agent)
                if p_worker:
                    updates["periodWorkerLlmCallCount"] = firestore.Increment(p_worker)

            transaction.update(doc_ref, updates)

        _persist_tx(
            db.transaction(),
            ref,
            prompt,
            candidates,
            total_delta,
            agent_stream_increment,
            worker_llm_call_increment,
            period_key,
        )
        logger.info(
            "Recorded token usage for user %s: +input=%s +output=%s +total=%s "
            "(agent_stream+=%s worker_llm_calls+=%s period=%s)",
            user_id,
            prompt,
            candidates,
            total_delta,
            agent_stream_increment,
            worker_llm_call_increment,
            period_key,
        )
    except Exception as e:
        logger.warning("Failed to persist token usage for user %s: %s", user_id, e, exc_info=True)

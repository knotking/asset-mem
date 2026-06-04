# Property Health Insights — V2 Spec

**Status:** In progress (P0–P3 implemented in repo; deploy workers + `npm run build` in `@homeapp/common` before release)  
**Audience:** Product, mobile/web, backend (checkpoint analysis + metrics workers)  
**Firestore doc:** `users/{userId}/properties/{propertyId}/metrics/summary`  
**Clients:** `MetricsDashboard` (web), `PropertyMetricsCard` (mapp), `usePropertyCheckpointMetrics`, `CheckpointComparisonDialog` / `CheckpointComparisonModal`, `checkpoint-detail-dialog`

This spec replaces ambiguous v1 behavior (null shown as 0, duplicate metrics publishes, mixed issue sources, broken comparison entry points) with explicit semantics, UI states, and a single write path for scores.

---

## 1. Goals

| Goal | Detail |
|------|--------|
| **Trustworthy headline score** | Users never see `0` when data is missing; scores reflect real analysis output. |
| **Honest labeling** | Copy matches math (what is averaged, over which window, which checkpoint drives “latest”). |
| **One source of truth** | Insights card and issue drill-down use the same backend window and rules. |
| **Predictable updates** | Users understand when the dashboard changes (after analysis; optional debounce when comparison runs). |
| **Parity** | Web and mobile show the same fields and states; footer stats either align or are removed. |
| **Reliable comparison** | Auto-compare matches the same area; “View Comparison” opens cached diffs; manual compare persists consistently. |

## 2. Non-goals (v2)

- Per-room / per-asset dashboards (future: filter by `detectedAsset` or `asset_category`).
- Historical backfill job for old checkpoints (optional follow-up; v2 fixes forward path).
- Replacing checkpoint-level detail UI or chat checkpoint agent.
- ML-based “property value” or insurance scoring.

---

## 3. V1 problems (baseline)

| Issue | Impact |
|-------|--------|
| Gemini often returns empty `condition_scores` | `latest_score` is `null`; UI shows **0**. |
| `latest_score` = last **scored** checkpoint, not property average | Misleading “Property overall” label. |
| Two Pub/Sub metrics runs per analysis+comparison | Redundant work; confusing logs. |
| Mobile issues **modal** scans checkpoints; card uses **summary** | Counts can disagree. |
| Web footer “Good / Needs Attention” is client heuristic | Conflicts with Insights tab. |
| No explicit UI state for “analyzing” / “no score yet” | Looks like catastrophic condition. |
| Web **View Comparison** has no `onClick` | CTA visible when `visualDiff` exists but does nothing. |
| Auto-compare **fallback** picks any recent checkpoint | Cross-room compares (e.g. Basement vs appliance); misleading similarity / changes. |
| Web manual compare may not persist `visualDiff` | Mobile saves; web dialog can re-run Gemini without writing Firestore. |
| One `visualDiff` per checkpoint | New compare overwrites prior pair; only `comparedWithCheckpointId` stored. |

---

## 4. V2 metric semantics

### 4.1 Analysis window

All property-level metrics use the same window:

- **Source:** Up to **60** most recent checkpoints ordered by `createdAt` DESC (unchanged query).
- **Included checkpoint:** `analysisStatus === "completed"` **OR** non-empty `aiAnalysis` (keep v1 filter for compatibility).
- **Excluded:** `pending`, `processing`, `failed` without `aiAnalysis`.

Expose in summary:

```ts
window: {
  checkpoints_considered: number;  // count in window matching filter
  checkpoints_with_score: number; // subset with usable condition score
  trend_points: number;           // len(overall.trend)
  max_checkpoints: 60;            // constant for client copy
}
```

### 4.2 Per-checkpoint condition score (input)

**Canonical field:** `checkpoint.aiAnalysis.condition_scores.overall` (0–100).

**Normalization in analysis worker** (before Firestore update + metrics publish):

1. If `overall` missing but other numeric keys exist → set `overall = mean(components)`.
2. If no numeric keys but `issues` non-empty → set `overall` from severity heuristic (see §4.7).
3. If still no score → set `aiAnalysis.condition_scores = { overall: null }` and `score_status: "unavailable"` (new field on checkpoint).

**Never** write empty `{}` without `score_status` after v2 ships.

### 4.3 Property headline score (`overall.headline`)

Replace ambiguous `latest_score` with explicit fields:

| Field | Semantics |
|-------|-----------|
| `headline.value` | **Weighted mean** of per-checkpoint `overall` over `checkpoints_with_score` in window. Weight = `1` per checkpoint (v2.0); document hook for recency weights in v2.1. |
| `headline.source` | `"weighted_mean"` \| `"latest_checkpoint"` \| `null` |
| `headline.latest_checkpoint_id` | ID of newest scored checkpoint (for “as of last visit” copy). |
| `headline.latest_checkpoint_score` | That checkpoint’s `overall` (for tooltip / detail). |

**Display rule:** UI shows `headline.value` when `source !== null`. Do **not** fall back to `0`.

**Minimum for headline:** `checkpoints_with_score >= 1`. If 0 → `headline` is `null` and `status` (§4.6) drives UI.

### 4.4 Trend (`overall.trend`)

- Array of `{ t: ISO8601, score: number, checkpointId: string }` for every scored checkpoint in window, ascending by `createdAt`, capped at **12** points (newest 12).
- Chart hidden when `trend.length < 2` (optional mini-chart at 2+).

### 4.5 Deterioration (`deterioration`)

Computed only when **≥ 2** scored checkpoints with valid `createdAt`:

- Compare **two most recent** scored checkpoints by time (not arbitrary last two in loop).
- `rate_points_per_day = (prev_score - last_score) / days_between`
- `trend`: `improving` \| `stable` \| `deteriorating` \| `unknown` (thresholds ±0.05 pts/day unchanged).

If `< 2` scored checkpoints: `rate_points_per_day: null`, `trend: "unknown"`, UI shows “Need 2+ scored visits”.

### 4.6 Summary status (`status`) — drives UI

Enum on `metrics/summary`:

| Status | Meaning | UI |
|--------|---------|-----|
| `no_checkpoints` | Zero included checkpoints | Empty state: create first checkpoint |
| `pending_analysis` | Included checkpoints exist but none scored yet (all processing or no scores) | “Analyzing…” / “Waiting for scores” |
| `partial` | Some scored, some not; `checkpoints_with_score >= 1` | Show headline + badge “Partial data” |
| `ready` | `checkpoints_with_score >= 1` and all included have scores OR user accepts partial | Full card |
| `stale` | (optional v2.1) `updatedAt` older than newest checkpoint `createdAt` by > 5 min | “Refreshing…” |

### 4.7 Issue counts (`issues`)

**Single aggregation rule** (metrics worker only):

- Sum `issues_by_severity` on each included checkpoint if present.
- Else infer from `aiAnalysis.issues[]` (same rules as v1).
- **Dedup:** none in v2.0 (counts = total detections). Document in UI: “Total detections across recent checkpoints.”

**Drill-down list** (mobile modal, future web):

- **Do not** re-scan raw checkpoints in the client for counts.
- New optional subcollection or embedded array on summary: `issues.recent[]` (max **50** rows, newest first):

```ts
issues: {
  total_by_severity: { critical, major, moderate, minor };
  total: number;
  recent: Array<{
    severity, description, checkpointId, checkpointName, createdAt
  }>;
}
```

Populated by metrics worker from same 60-checkpoint window. Mobile modal reads `issues.recent` only.

### 4.8 Metrics publish strategy

| Event | v1 | v2 |
|-------|----|----|
| Analysis completed | Publish metrics | Publish metrics |
| Analysis failed | No publish | **Publish metrics** (refresh `status` / counts) |
| Comparison completed | Publish metrics again | **Do not publish**; comparison already updated checkpoint doc — next analysis publish picks it up |

**Always-write summary doc:** On every metrics worker run, `aggregate_property_metrics()` **must** `set()` `metrics/summary` with a full v2 payload—including `status: "no_checkpoints"`, `"pending_analysis"`, `"partial"`, or `"ready"`—never skip the write because scores are missing. Clients use `snap.exists()` (`summaryExists`) to distinguish **doc missing** (show “waiting for sync”) vs **doc present with pending status** (show — / spinner).

**Optional debounce (v2.1):** coalesce publishes per `(userId, propertyId)` within 30s.

---

## 5. Firestore schema (v2)

`PropertyCheckpointMetrics` version **2** (`version: 2`).

```ts
type PropertyCheckpointMetricsV2 = {
  version: 2;
  updatedAt: Timestamp;
  status: "no_checkpoints" | "pending_analysis" | "partial" | "ready" | "stale";
  window: {
    max_checkpoints: 60;
    checkpoints_considered: number;
    checkpoints_with_score: number;
    trend_points: number;
  };
  overall: {
    headline: {
      value: number | null;
      source: "weighted_mean" | "latest_checkpoint" | null;
      latest_checkpoint_id: string | null;
      latest_checkpoint_score: number | null;
    } | null;
    trend: Array<{ t: string; score: number; checkpointId: string }>;
  };
  issues: {
    total_by_severity: { critical: number; major: number; moderate: number; minor: number };
    total: number;
    recent: Array<{
      severity: "critical" | "major" | "moderate" | "minor";
      description: string;
      checkpointId: string;
      checkpointName: string;
      createdAt: string; // ISO
    }>;
  };
  deterioration: {
    rate_points_per_day: number | null;
    trend: "improving" | "stable" | "deteriorating" | "unknown";
  };
};
```

**Backward compatibility:** Clients read `version`; if `version === 1` or missing, map `overall.latest_score` → `headline.value` with `source: "latest_checkpoint"` for one release.

**Checkpoint doc addition:**

```ts
aiAnalysis: {
  // existing fields
  condition_scores: { overall: number | null; [component: string]: number };
  score_status?: "ok" | "derived" | "unavailable";
}
```

---

## 6. Pipeline changes

### 6.1 `checkpoint_analysis` (`checkpoint_service.py` + `main.py`)

1. After Gemini JSON parse, run `normalize_condition_scores(result_json)` (new helper).
2. Persist `score_status` on `aiAnalysis`.
3. Gemini `condition_scores` schema requires `overall`; **one retry** if still empty.
4. Publish metrics on **completed** and **failed** analysis (`checkpoint.analysis.completed` / `checkpoint.analysis.failed`).
5. Drop comparison-triggered metrics publish.

### 6.2 `checkpoint_metrics` (`metrics_aggregator.py`)

1. Implement v2 computation (§4).
2. Build `issues.recent` list.
3. Set `status` from counts.
4. Write full doc with `version: 2` (`set` without merge on v2 fields, or `merge` with explicit `version` bump).

### 6.3 Tests

- Unit: `normalize_condition_scores`, headline weighted mean, deterioration with 2 checkpoints, `status` transitions, empty scores → `pending_analysis`.
- Extend `test_metrics_aggregator.py`; add analysis worker tests for normalization.

---

## 7. UI spec (web + mobile)

### 7.1 Placement (unchanged)

- Sub-tab **Insights** on property checkpoints screen.
- Web: remove duplicate issue counting in footer **or** derive footer from `metrics/summary` only (recommended: **remove** Good/Needs Attention from footer in v2).

### 7.2 Overall condition block

| `status` | Headline | Subcopy |
|----------|----------|---------|
| `no_checkpoints` | — | Empty state CTA |
| `pending_analysis` | `—` or spinner | “Scores appear after AI analysis finishes.” |
| `partial` | `headline.value` | “Based on {checkpoints_with_score} of {checkpoints_considered} recent checkpoints” |
| `ready` | `headline.value` | “Property health index (0–100), avg of recent checkpoints” |

**Never** use `?? 0` for display. Use em dash or skeleton.

**Color bands:** unchanged (80/60/40).

### 7.3 Trend badge

- Show deterioration badge only when `deterioration.trend !== "unknown"` and `checkpoints_with_score >= 2`.
- Hide pts/day when rate is null.

### 7.4 Issues block

- Severity badges from `issues.total_by_severity`.
- Tap “Total issues” → modal lists `issues.recent` (mapp); web: dialog or expandable list (v2 web scope).

### 7.5 Help (re-enable on mobile)

Unhide “How to read this” with v2 copy:

- Headline = average of recent checkpoint scores.
- Issues = total AI detections, not necessarily unique physical problems.
- Trend needs 2+ scored visits.

### 7.6 Loading

- **Loading:** skeleton while Firestore listener is attaching.
- **Missing doc** (`!summaryExists`): card with “insights after analysis syncs”—not skeleton, not `0`.
- **Ready** (`summaryExists`): render from `status` and `headline`.
- If `status === "stale"` or `pending_analysis` after user just created checkpoint, show inline “Updating insights…” without clearing previous `ready` scores (optimistic).

---

## 8. Checkpoint comparison UX (v2)

Comparison is **separate from** the property `metrics/summary` rollup but affects user trust in Insights (deterioration, change narrative). V2 aligns auto-compare, manual compare, and “View Comparison” behavior.

### 8.1 Concepts

| Term | Meaning |
|------|---------|
| **Before** | Older checkpoint in the pair (earlier `createdAt`). |
| **After** | Newer checkpoint; **owns** `visualDiff` on its Firestore doc. |
| **Pair key** | `(beforeCheckpointId, afterCheckpointId)`; cache valid only when `after.visualDiff.comparedWithCheckpointId === before.id`. |

**Storage (unchanged path):** `users/{uid}/properties/{pid}/checkpoints/{afterId}.visualDiff`

```ts
visualDiff: {
  id: string;
  status: "completed" | "processing" | "failed";
  comparedWithCheckpointId: string;  // required when completed
  summary: string;                   // add to shared TypeScript type (used in worker/UI today)
  semanticChanges: string[];
  regions: ChangeRegion[];
  similarityScore: number;           // 0–1, Gemini output
  matchReason?: "same_location" | "same_detected_asset" | "manual"; // v2 optional audit field
  completedAt: Timestamp;
  heatmapUrl?: string;               // optional; not required for v2
}
```

### 8.2 How comparison is created (two paths)

#### A. Automatic (analysis worker)

After analysis + embedding, **before** metrics publish:

1. Read `users/{uid}/preferences/user.checkpointComparison` (`enabled`, `maxAgeDays`, `minAssetConfidence`).
2. Respect checkpoint `skipComparison === true`.
3. `find_previous_checkpoint()` per §8.3.
4. If candidate found → `compare_checkpoints()` (Gemini) → write `visualDiff` on **after** (current) checkpoint.
5. **Do not** publish metrics (§4.8).

#### B. Manual (user selects two)

- Entry: list selection → Compare (web `CheckpointComparisonDialog`, mapp `CheckpointComparisonModal`).
- API: proxy `POST /compare-checkpoints` (sync Gemini).
- Sort by `createdAt` → before / after.
- **v2 requirement:** both clients **persist** `visualDiff` on the **after** checkpoint (same shape as worker), with `matchReason: "manual"`.
- Reuse cache when opening the same pair without re-calling Gemini (mapp already does; web must match).

### 8.3 Auto-match rules (v2 — tighten v1 fallback)

| Step | v1 behavior | v2 behavior |
|------|-------------|-------------|
| Primary | `location ==` search string (user location or `detectedAsset`) within `maxAgeDays` | Same |
| Secondary | If no match → **any** recent checkpoint in window | **Removed** — no cross-area silent compare |
| No match | Still may fallback | Set `visualDiff` **absent**; log `comparison.skipped.no_prior_in_area` |

**Candidate query (unchanged indexes):** `location` equality + `createdAt > min_date`, exclude current id, `limit(1)` DESC.

**Optional v2.1:** also match `detectedAsset` field index when `location` empty.

**User-visible when skipped:** detail/timeline chip “No prior visit in this area for comparison” (not an error).

**Preferences (unchanged defaults):** `enabled: true`, `maxAgeDays: 180`, `minAssetConfidence: 0.3`.

### 8.4 “View Comparison” (web checkpoint detail)

**v1 bug:** `checkpoint-detail-dialog.tsx` renders the button with **no handler**.

**v2 behavior:**

1. When `checkpoint.visualDiff?.comparedWithCheckpointId` is set:
   - Resolve **before** checkpoint from `CheckpointContext` / Firestore.
   - Open `CheckpointComparisonDialog` with `(before, after)` = current checkpoint as **after**.
   - Preload `comparisonResult` from `after.visualDiff` (no Gemini unless user taps “Re-run comparison”).
2. Button label: **View comparison**; subcopy: `Compared with {before.name} · {date}`.
3. If before checkpoint deleted: show “Previous checkpoint unavailable” + offer manual compare from list.

**Mobile v2:** optional equivalent on `CheckpointDetailModal` (link or button); primary compare flow remains select-two.

### 8.5 Comparison UI content

Shared across dialog/modal/detail entry:

| Block | Notes |
|-------|--------|
| Before/after slider + side-by-side | Unchanged |
| Similarity | Show as **0–100%** with tooltip: “AI estimate of visual similarity (same area).” Explain very low scores may mean different angles or mismatched areas. |
| Summary + semantic changes | From `visualDiff.summary` / `semanticChanges` |
| Regions | List severity badges; bboxes optional v2 |
| Re-run | Explicit secondary action; overwrites `visualDiff` on after doc |

**Card badge:** keep “Comparison available” on list cards when `visualDiff.status === "completed"`.

### 8.6 Relationship to Property Health Insights

| Topic | v2 decision |
|-------|-------------|
| Metrics re-aggregation on compare | **No** separate metrics publish (§4.8) |
| Deterioration rate | Still driven by **condition scores** on checkpoints, not `similarityScore` |
| Insights tab snippet (optional P3) | Show latest completed compare: “Last change: {first semanticChange}” with link to after checkpoint — **defer** if scope tight |

### 8.7 Comparison acceptance criteria

1. Auto-compare does **not** run when only prior checkpoint is a different `location` / `detectedAsset`.
2. Web **View comparison** opens dialog with correct before/after and cached `visualDiff`.
3. Manual compare on web **writes** `visualDiff` on after checkpoint (parity with mapp).
4. Re-opening same pair does not call Gemini unless user re-runs.
5. Analysis completion produces **one** metrics Pub/Sub message even when comparison runs.
6. `VisualDiffAnalysis` in `@homeapp/common` includes optional `summary` and `matchReason`.

### 8.8 Comparison implementation notes

| Item | Path |
|------|------|
| Auto compare + find previous | `gcp/proxy/workers/function/checkpoint_analysis/comparison_service.py`, `main.py` |
| Sync API compare | `gcp/proxy/api/routers/checkpoint.py` → `compare_checkpoints` |
| Web detail CTA | `apps/webapp/src/components/checkpoints/checkpoint-detail-dialog.tsx` |
| Web dialog | `apps/webapp/src/components/checkpoints/checkpoint-comparison-dialog.tsx` |
| Mobile modal | `apps/mapp/components/property-details/CheckpointComparisonModal.tsx` |
| Settings | `checkpoint-settings.tsx` / `CheckpointComparisonSettings.tsx` |

---

## 9. Implementation phases

| Phase | Scope | Owner |
|-------|--------|-------|
| **P0** | `normalize_condition_scores` in analysis worker; stop double metrics publish; remove comparison metrics publish | Backend |
| **P0b** | Remove auto-compare location fallback; wire web View comparison + web manual `visualDiff` persist | Backend + web |
| **P1** | `metrics_aggregator` v2 + `version: 2` doc + unit tests | Backend |
| **P2** | `PropertyCheckpointMetrics` + `VisualDiffAnalysis` types in `@homeapp/common`; client mapping v1→v2 | Common + clients |
| **P3** | Insights UI states (no `?? 0`), web footer alignment, mapp modal → `issues.recent` | Web + mapp |
| **P4** | Docs + manual prod verification checklist (scores + comparison) | QA |

**P0 unblocks prod “zero score”** without waiting for full UI polish.

---

## 10. Acceptance criteria

### Insights

1. After a successful analysis with issues, `condition_scores.overall` is non-null OR `score_status === "derived"`.
2. `metrics/summary.status === "ready"` and `headline.value` in 0–100 when ≥1 scored checkpoint exists.
3. With zero scored checkpoints, UI shows **not** numeric zero (dash or pending copy).
4. One metrics aggregation per analysis run (comparison does not trigger second run).
5. Mobile issue modal totals match `issues.total` from summary.
6. Web Insights and mapp Insights show same `headline.value` and `status` for the same property.
7. Unit tests cover normalization + v2 aggregator; CI green.

### Comparison (see §8.7)

8. Web View comparison opens cached pair; manual compare persists `visualDiff` on web.
9. Auto-compare does not pair unrelated locations.

---

## 11. Verification checklist (prod/staging)

1. Create checkpoint → wait for analysis → inspect Firestore checkpoint `aiAnalysis.condition_scores.overall`.
2. Confirm `metrics/summary.version === 2` and `status`.
3. Compare UI headline to `headline.value`.
4. Run analysis with comparison enabled → single metrics log line per checkpoint.
5. Cloud log: no `Gemini did not return condition_scores` without a following `derived` normalization log.
6. Second checkpoint in same **location** gets `visualDiff.comparedWithCheckpointId` pointing to first.
7. New checkpoint in **different** location does **not** get cross-location `visualDiff`.
8. Web checkpoint detail → View comparison → slider + summary without extra API call.
9. Manual compare on web → reload after doc → `visualDiff` present on after checkpoint.

---

## 12. Open questions

| # | Question | Default if unanswered |
|---|----------|------------------------|
| 1 | Headline: weighted mean vs latest-only? | Weighted mean (§4.3) |
| 2 | Derive score from issues when Gemini omits scores? | Yes, coarse table (critical→40, major→55, moderate→70, minor→85, none→90) |
| 3 | Backfill old checkpoints on read? | No; forward-only P0 |
| 4 | Web issue drill-down in v2? | Include if cheap; else P3 mobile-only |
| 5 | Recency-weighted headline? | Defer to v2.1 |
| 6 | Keep multiple historical `visualDiff` versions per checkpoint? | No v2.0; overwrite; history defer v2.2 |
| 7 | Insights tab “latest change” from comparison? | Defer P3 optional |

---

## 13. Related code (v1)

| Layer | Path |
|-------|------|
| Aggregator | `gcp/proxy/workers/function/checkpoint_metrics/metrics_aggregator.py` |
| Metrics worker | `gcp/proxy/workers/function/checkpoint_metrics/main.py` |
| Analysis publish | `gcp/proxy/workers/function/checkpoint_analysis/main.py` |
| Gemini parse | `gcp/proxy/workers/function/checkpoint_analysis/checkpoint_service.py` |
| Types | `apps/common/src/types.ts` (`PropertyCheckpointMetrics`) |
| Web UI | `apps/webapp/src/components/checkpoints/metrics-dashboard.tsx` |
| Mobile UI | `apps/mapp/components/property-details/PropertyCheckpointsTab.tsx` (`PropertyMetricsCard`) |
| Comparison service | `gcp/proxy/workers/function/checkpoint_analysis/comparison_service.py` |
| Web comparison | `checkpoint-comparison-dialog.tsx`, `checkpoint-detail-dialog.tsx` |
| Mobile comparison | `CheckpointComparisonModal.tsx` |

---

## 14. Changelog

| Date | Change |
|------|--------|
| 2026-06-04 | Initial v2 spec drafted from prod log investigation (empty `condition_scores`, duplicate metrics runs). |
| 2026-06-04 | Added §8 Checkpoint comparison UX (auto-match, View comparison, persistence parity, acceptance criteria). |
| 2026-06-04 | Implemented P0–P3 in codebase (see git); deploy `checkpoint_analysis` + `checkpoint_metrics` Cloud Functions for prod. |

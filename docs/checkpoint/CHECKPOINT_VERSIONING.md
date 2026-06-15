# Checkpoint Versioning — Design Spec

**Status:** P0–P3 complete (series, UI, metrics/agent/reports, comparison history)  
**Audience:** Product, mobile/web, backend (analysis + metrics workers), agent/retrieval  
**Related:** [Property Health Insights V2](./PROPERTY_HEALTH_INSIGHTS_V2.md), [Property Reports Plan](../property/PROPERTY_REPORTS_PLAN.md), [Checkpoint Feature Plan](./CHECKPOINT_FEATURE_PLAN.md)

This spec introduces **first-class versioning** for checkpoints: a stable **monitoring point** (series) with ordered **captures** (revisions) over time. Today, temporal lineage is implicit via location string matching and `createdAt`; this design makes that relationship explicit without breaking existing `checkpointId` references.

---

## 1. Goals

| Goal | Detail |
|------|--------|
| **Stable monitoring points** | “Kitchen”, “Roof”, “HVAC unit” are persistent entities users recognize across months. |
| **Ordered capture history** | Each new photo/video at a point is capture v1, v2, v3… with clear latest vs historical. |
| **Reliable comparison chain** | Auto-compare pairs capture N with N−1 in the same series (not arbitrary cross-location matches). |
| **Backward compatibility** | Existing checkpoint docs remain valid; agent, chat, reports, and deletion keep using `checkpointId`. |
| **Incremental rollout** | Schema + backfill first; UI grouping and create flows follow in phases. |

## 2. Non-goals (initial release)

- **In-place media replacement** with audit trail on a single logical ID (see §3.3 — deferred unless product prioritizes “fix bad upload”).
- **Full comparison history UI** (multiple stored diffs per capture — deferred to phase 3; v2 insights spec already deferred this).
- **Per-series permissions** or contractor-scoped series access.
- **Automatic renumbering** when deleting a middle revision (block or series-delete only in v1).

---

## 3. Problem statement

### 3.1 Current model

Each checkpoint is an independent Firestore document:

```
users/{userId}/properties/{propertyId}/checkpoints/{checkpointId}
```

Types: `apps/common/src/types.ts` (`Checkpoint`), mirrored in `apps/webapp/src/lib/types.ts`.

**Temporal relationships today are implicit:**

| Mechanism | Location | Limitation |
|-----------|----------|------------|
| Location grouping | `location` / `detectedAsset` string match | Typos and AI relabeling break chains |
| Auto-comparison | `comparison_service.find_previous_checkpoint` | Queries by location + `createdAt`; one `visualDiff`, overwritten |
| Metrics trends | `checkpoint_metrics` worker | One trend point per flat `checkpointId` (max 60) |
| Reports | `report-resolve.ts` | Earliest vs latest per normalized location in a date range |
| Quota | `check_and_record_monthly_checkpoint_creations` | Each new doc counts |
| Edits | `updateCheckpoint` | Name, `analysisStatus`, `visualDiff` only — no media replacement |

### 3.2 Three “versioning” interpretations

| Model | User story | Recommendation |
|-------|-----------|----------------|
| **A. Series + captures** | Monthly kitchen photos are v1, v2, v3 of “Kitchen” | **Primary — implement first** |
| **B. In-place revisions** | Replace wrong photo on same checkpoint, keep audit trail | Defer unless explicitly required |
| **C. Comparison history** | View all diffs a capture ever had, not just latest | Phase 3 add-on |

### 3.3 Why not in-place revisions (for now)

In-place versioning (`checkpoints/{id}/versions/{n}`) preserves a stable ID for chat links but conflicts with:

- Point-in-time semantics (each capture is a moment in property history).
- Metrics and report snapshots that assume immutable capture payloads.
- Embedding / vector search keyed per capture.

If “replace bad upload” becomes a top user request, add a separate `captureKind: "reanalysis"` revision in the **same series** rather than mutating history in place.

---

## 4. Proposed data model

### 4.1 Checkpoint series (new collection)

Stable monitoring point metadata:

```
users/{userId}/properties/{propertyId}/checkpointSeries/{seriesId}
```

```typescript
export type CheckpointSeries = {
  id: string;
  userId: string;
  propertyId: string;
  name: string;              // display name, e.g. "Kitchen"
  location: string;          // canonical location key (normalized)
  assetType?: "real_estate" | "vehicle" | "appliance" | "other";
  createdAt: Timestamp;
  updatedAt: Timestamp;
  latestCaptureId: string | null;
  captureCount: number;
  baselineCaptureId?: string; // optional move-in / baseline reference
};
```

**Normalization:** Reuse report location normalization (`normalizeReportLocation` in `apps/common/src/lib/report-resolve.ts`) for series keys.

### 4.2 Capture fields (extend existing `Checkpoint` doc)

Each existing checkpoint document becomes a **capture** (revision). Add optional fields:

```typescript
export type Checkpoint = {
  // ... existing fields unchanged ...

  /** Stable monitoring point this capture belongs to. */
  seriesId?: string;
  /** 1-based revision within the series. */
  revisionNumber?: number;
  /** Denormalized flag for queries (newest capture in series). */
  isLatestInSeries?: boolean;
  /** Previous capture in chronological chain within series. */
  supersedesCaptureId?: string | null;
  /** How this capture was created. */
  captureKind?: "scheduled" | "ad_hoc" | "baseline" | "reanalysis";
  /** True when the user picked `location` at create; false when AI will infer it. */
  userProvidedLocation?: boolean;
};
```

**Design choice:** Extend flat `checkpoints` docs rather than nesting `captures` subcollections so that:

- Agent retrieval by `checkpoint_ids` is unchanged.
- Report snapshots, metrics, deletion, and chat context keep using `checkpointId`.
- Vector embeddings stay one-per-capture on the same doc path.

### 4.3 Comparison lineage

Extend `VisualDiffAnalysis` (optional fields):

```typescript
export type VisualDiffAnalysis = {
  // ... existing fields ...
  comparedWithRevisionNumber?: number;
  matchReason?: "series_previous" | "series_baseline" | "same_location" | "same_detected_asset" | "manual";
};
```

**Phase 1:** Keep single `visualDiff` on the capture doc (same as today).  
**Phase 3 (optional):** Append-only subcollection:

```
checkpoints/{captureId}/comparisons/{comparisonId}
```

Denormalize latest auto-comparison onto `visualDiff` for fast UI.

### 4.4 Metrics v3 (future)

When series ship, bump `PropertyCheckpointMetrics.version` to **3**:

- Trend points: configurable — latest capture per series vs all captures (default: **latest per series** for headline).
- Issue rows: include `seriesId`, `revisionNumber`.
- Read path: if `version < 3`, behave as v2 (backward compatible).

---

## 5. End-to-end flows

### 5.1 Architecture overview

```
Client (webapp / mapp)
  ├── Create series + capture v1  OR  Add capture vN to existing series
  ├── Series-grouped timeline UI
  └── Compare vN vs vN−1 (or vs baseline)

Firestore
  ├── checkpointSeries/{seriesId}
  └── checkpoints/{captureId}  (+ optional comparisons/ subcollection)

Workers
  ├── checkpoint_analysis  → analysis, embedding, auto-compare within series
  └── checkpoint_metrics   → trends scoped by series

Agent
  └── run_checkpoint_pipeline / ask_checkpoints_retrieval
        default: latest capture per series; explicit: full history or pinned IDs
```

### 5.2 Create capture (clients)

**Touchpoints:**

- Web: `apps/webapp/src/components/checkpoints/create-checkpoint-dialog.tsx`
- Mobile: `apps/mapp/components/property-details/PropertyCheckpointsTab.tsx`
- Shared: `apps/common/src/contexts/checkpoint-context.tsx` (`createCheckpoint`)

**New create modes:**

1. **New monitoring point** → create `checkpointSeries` + capture with `revisionNumber: 1`, `isLatestInSeries: true`.
2. **New capture for existing point** → user picks series (or auto-match by location) → increment `captureCount`, set prior latest `isLatestInSeries: false`, set `supersedesCaptureId`.

**Auto-match:** Reuse location logic from `gcp/proxy/workers/function/checkpoint_analysis/comparison_service.py` (`find_previous_checkpoint`) scoped to series lookup by normalized location.

**Quota:** Each capture counts toward the monthly checkpoint limit (same as today). Revisions in an existing series are not discounted.

Analysis trigger remains via proxy (`gcp/proxy/api/routers/checkpoint.py`) → Pub/Sub → `checkpoint_analysis` worker.

### 5.3 Analysis worker

**File:** `gcp/proxy/workers/function/checkpoint_analysis/main.py`

**Changes:**

1. After analysis, assign or **reassign** `seriesId` when location was AI-inferred (`userProvidedLocation: false`). User-provided locations keep the series chosen at create.
2. **Previous capture for auto-compare:** same `seriesId`, `revisionNumber - 1` (fallback: location + `createdAt` during migration).
3. Write `visualDiff.matchReason: "series_previous"` (or `"series_baseline"` when comparing to baseline).
4. Publish metrics with series-aware payload when metrics v3 is enabled.

**Create without location:** Client writes `userProvidedLocation: false` and defers series assignment until analysis sets `location`, then the worker calls `resolve_series_after_analysis` → `reassign_capture_to_series`.

**Manual reassignment:** Checkpoint detail → **Merge…** when another capture shares the same location, otherwise **Change**. Opens a merge dialog that explains you only need to move **one** capture, auto-selects the same-location group as **Suggested**, and labels options with capture count + latest photo name. Revisions are renumbered by capture date (oldest = v1) after merge.

### 5.4 Manual comparison

**Web:** `checkpoint-comparison-dialog.tsx`  
**Mobile:** `CheckpointComparisonModal.tsx`

- Default suggestion: previous capture in same series.
- Advanced: any two captures (any series) — `matchReason: "manual"`.
- Persist `visualDiff` on the **after** (newer) capture doc.

### 5.5 Metrics aggregation

**File:** `gcp/proxy/workers/function/checkpoint_metrics/metrics_aggregator.py`

- Incremental updates keyed by `checkpointId` remain valid.
- v3: roll up headline/trend using latest capture per `seriesId`.
- Deleting a capture triggers series metadata recompute (`latestCaptureId`, `captureCount`).

### 5.6 Property reports

**Files:** `apps/common/src/lib/report-resolve.ts`, `gcp/common/report/snapshot_builder.py`

- Comparison pairs: prefer captures within the same series when date range spans multiple revisions.
- Snapshot slices store `{ seriesId, captureId, revisionNumber }` so generated PDFs stay stable if vN+1 is added later.
- Bump `PropertyReportContentSnapshot.schemaVersion` when slice shape changes.

### 5.7 Agent / chat retrieval

**Files:**

- `gcp/agents/homecare/property_agent/checkpoint/retrieval/agent.py`
- `gcp/agents/homecare/property_agent/checkpoint/retrieval/retrieval_scope.py`
- `gcp/agents/homecare/property_agent/checkpoint/tool_guards.py`

| Query intent | Default retrieval |
|--------------|-------------------|
| “What’s wrong with my kitchen?” | Latest capture in Kitchen series |
| “How has my kitchen changed?” | Latest + previous (or last N) in series |
| “List all kitchen checkpoints” | All captures in series, ordered by `revisionNumber` |
| User pinned `checkpoint_ids` | Exact captures only (unchanged) |

Optional future session field: `checkpoint_series_ids` for “analyze this monitoring point” without pinning a specific capture.

### 5.8 Deletion

**Files:** `gcp/proxy/api/services/deletion_service.py`, `apps/common/src/lib/deletion/delete-checkpoint.ts`

| Action | Behavior |
|--------|----------|
| Delete **capture** (latest) | Remove doc + media; update series `latestCaptureId` to previous; re-run metrics incremental |
| Delete **capture** (non-latest) | **Blocked** — user must delete latest capture repeatedly or delete the entire series |
| Delete **series** | Batch delete all captures + series doc + storage |

Saved providers and chat messages referencing `checkpointId` remain valid until that capture is deleted.

### 5.9 UI (phased)

**Today:** Flat list with location filter — `apps/webapp/src/components/checkpoints/checkpoint-list.tsx`.

**Target:**

- Primary view: grouped by series (accordion / timeline rail).
- Series detail: revision strip (v1 → v2 → v3), badge on latest.
- Create flow: “Add to Kitchen” vs “New area”.
- Chat drawer: group by series — `CheckpointsDrawerContent.tsx` (mapp), `checkpoint-drawer.tsx` (web).

---

## 6. Firestore indexes

Add to `apps/webapp/firestore.indexes.json` (and deploy):

| Collection | Fields | Purpose |
|------------|--------|---------|
| `checkpoints` | `seriesId` ASC, `revisionNumber` DESC | Revision history within series |
| `checkpoints` | `seriesId` ASC, `isLatestInSeries` ASC | Latest capture per series |
| `checkpointSeries` | `location` ASC, `updatedAt` DESC | Lookup series by location (if queried at collection group level) |

Existing vector index on `embedding` remains per capture document.

---

## 7. Migration and backfill

One-time job (Cloud Function or admin script):

1. For each property, group checkpoints by `normalizeReportLocation(location)`.
2. Checkpoints with no location → single-capture series named from `name` or `"Untitled"`.
3. For each group ordered by `createdAt` ASC:
   - Create `checkpointSeries`.
   - Assign `seriesId`, `revisionNumber` (1…N), `supersedesCaptureId` chain.
   - Set `isLatestInSeries: true` on newest only.
4. Do **not** rewrite `visualDiff`; optional backfill of `matchReason` is low priority.

**Client compatibility:** Old app versions ignore new fields; list views continue to work flat until upgraded.

---

## 8. Product decisions (accepted defaults)

These defaults are **locked for v1** unless explicitly revisited before implementation.

| # | Decision | Accepted default |
|---|----------|------------------|
| 1 | **Quota** | Each new capture counts toward the monthly checkpoint limit, including revisions in an existing series. |
| 2 | **Series location** | Immutable on the series after creation. Individual captures may still store AI `detectedAsset` overrides. |
| 3 | **Series creation** | Auto-create or match series from normalized location string on capture create; no required “new area vs add to existing” step in v1 (UI may still offer it). |
| 4 | **Delete middle revision** | Blocked. Users delete the latest capture (repeat if needed) or delete the entire series. |
| 5 | **Agent default** | Unpinned location queries (e.g. “kitchen”) resolve to the **latest capture** in that series only. Full history when the query asks for change over time. |
| 6 | **Baseline capture** | Deferred to **phase 2** (`baselineCaptureId` on series). |
| 7 | **Comparison history** | Single `visualDiff` on the capture doc in v1; append-only `comparisons/` subcollection deferred to **phase 3**. |

---

## 9. Phased rollout

| Phase | Scope | Deliverables |
|-------|--------|--------------|
| **P0** | Schema + backfill + series on create (server-side) | Types, Firestore rules/indexes, backfill script, no UI change |
| **P1** | Create “add to series” + comparison scoped to series | ✅ Grouped timeline UI, create hints, detail compare with previous |
| **P2** | Metrics v3, agent defaults, report snapshot fields, baseline capture | ✅ Worker + agent + report builder; `baselineCaptureId` on series |
| **P3** | Comparison history subcollection | ✅ Append-only `comparisons/`; denormalized `visualDiff` unchanged |

---

## 10. Related code (current)

| Layer | Path |
|-------|------|
| Types | `apps/common/src/types.ts`, `apps/webapp/src/lib/types.ts` |
| Client CRUD | `apps/common/src/contexts/checkpoint-context.tsx`, `apps/webapp/src/contexts/checkpoint-context.tsx` |
| Analysis worker | `gcp/proxy/workers/function/checkpoint_analysis/main.py` |
| Comparison | `gcp/proxy/workers/function/checkpoint_analysis/comparison_service.py` |
| Metrics | `gcp/proxy/workers/function/checkpoint_metrics/metrics_aggregator.py` |
| Report resolve | `apps/common/src/lib/report-resolve.ts` |
| Agent retrieval | `gcp/agents/homecare/property_agent/checkpoint/retrieval/` |
| Plan limits | `gcp/common/plan_limits.py` |
| Deletion | `gcp/proxy/api/services/deletion_service.py` |

---

## 11. Testing checklist (when implemented)

1. Create series + v1 → Firestore has `checkpointSeries` and capture with `revisionNumber: 1`.
2. Add v2 to same series → v1 `isLatestInSeries: false`, v2 latest; series `captureCount: 2`.
3. Analysis completes on v2 → auto-compare uses v1 (same series), not a different room.
4. Delete latest capture → series points to v1; metrics summary updates.
5. Backfill on property with 3 “Kitchen” checkpoints → one series, revisions 1–3.
6. Agent query “kitchen” without pinned IDs → returns latest capture only.
7. Report comparison mode → pairs earliest vs latest **within series** in date range.
8. Old mobile/web build without series UI → flat list still loads.

---

## 12. Changelog

| Date | Change |
|------|--------|
| 2026-06-14 | Initial design spec (docs only) |
| 2026-06-14 | Locked product decisions to recommended defaults (§8) |
| 2026-06-14 | P0: types, client create with series, worker assignment, deletion guard, indexes, backfill script |
| 2026-06-14 | P1: grouped timeline (web accordion + mapp sections), revision badges, create hints, compare with previous in detail |
| 2026-06-14 | P2: metrics v3 (latest per series), agent collapse to latest per series, report snapshot schema v2 + series fields, `baselineCaptureId` on series |
| 2026-06-14 | P3: append-only `checkpoints/{id}/comparisons/` history, denormalized `visualDiff`, backfill script, history UI in checkpoint detail |
| 2026-06-14 | P3+: full comparison history explorer (series-scoped timeline, in-explorer diff detail with slider/regions) on web + mapp |

# Plan: Landscape & Irrigation Checkpoint Support

**One-sentence goal:** Add `landscape_irrigation` as a first-class asset type — alongside the existing `real_estate / vehicle / appliance / other` — so auditors can capture, analyze, and compare landscape and irrigation media through the existing checkpoint pipeline without any other behavioral change.

---

## What changes and what does NOT change

**Does NOT change:**
- Firestore collection paths or document structure (`assetType` is already stored as a free string)
- Pub/Sub message schema (worker derives category from location string + AI detection, not from `assetType`)
- Proxy API endpoints or request schemas
- Agent pipeline (retrieval, pipeline, synthesis, optional branches)
- Deletion, comparison, metrics, quota, or embedding flows
- Any existing asset type behavior

**Does change:**
- TypeScript `assetType` union literal (additive)
- UI location taxonomy lists in mapp and webapp (additive)
- `get_asset_category()` keyword list (additive — new category returned)
- `build_analysis_prompt()` and `build_comparison_prompt()` (new `elif` branch)
- `detect_room_area()` Gemini prompt text (additive paragraph)

---

## Files to modify (6 total, no new files)

### [x] 1. `apps/common/src/types.ts`
**What:** Extend the `assetType` literal union.

```typescript
// Before
assetType?: "real_estate" | "vehicle" | "appliance" | "other";

// After
assetType?: "real_estate" | "vehicle" | "appliance" | "landscape_irrigation" | "other";
```

### [x] 2. `apps/webapp/src/lib/types.ts`
**What:** Mirror the same union change (webapp cannot import from `@homeapp/common`).

Same one-line change as above.

### [x] 3. `apps/mapp/components/property-details/CreateCheckpointModal.tsx`
**What:** Add the new option to `ASSET_TYPES` and a full `landscape_irrigation` entry in `LOCATION_OPTIONS`.

```typescript
// ASSET_TYPES — insert before 'other'
{ label: 'Landscape & Irrigation', value: 'landscape_irrigation' as const },

// LOCATION_OPTIONS.landscape_irrigation
landscape_irrigation: [
  // Lawn & Turf
  { label: 'Front Lawn',        value: 'Front Lawn' },
  { label: 'Back Lawn',         value: 'Back Lawn' },
  { label: 'Side Yard',         value: 'Side Yard' },
  { label: 'Lawn Overall',      value: 'Lawn Overall' },
  // Garden & Planting
  { label: 'Garden Beds',       value: 'Garden Beds' },
  { label: 'Raised Beds',       value: 'Raised Beds' },
  { label: 'Vegetable Garden',  value: 'Vegetable Garden' },
  { label: 'Flower Beds',       value: 'Flower Beds' },
  { label: 'Planters',          value: 'Planters' },
  // Trees & Shrubs
  { label: 'Trees',             value: 'Trees' },
  { label: 'Shrubs & Hedges',   value: 'Shrubs & Hedges' },
  { label: 'Ground Cover',      value: 'Ground Cover' },
  // Irrigation Infrastructure
  { label: 'Sprinkler Zone',    value: 'Sprinkler Zone' },
  { label: 'Sprinkler Heads',   value: 'Sprinkler Heads' },
  { label: 'Drip Lines',        value: 'Drip Lines' },
  { label: 'Irrigation Controller', value: 'Irrigation Controller' },
  { label: 'Backflow Preventer', value: 'Backflow Preventer' },
  // Drainage
  { label: 'Drainage System',   value: 'Drainage System' },
  { label: 'French Drain',      value: 'French Drain' },
  { label: 'Swale / Grading',   value: 'Swale / Grading' },
  // Hardscape & Edging
  { label: 'Retaining Wall',    value: 'Retaining Wall' },
  { label: 'Mulch / Rock Beds', value: 'Mulch / Rock Beds' },
  { label: 'Pathway & Edging',  value: 'Pathway & Edging' },
  // Custom
  { label: 'Other',             value: 'Other' },
],
```

Also update the `assetType` state/prop TypeScript literal in `CreateCheckpointModalProps` and the `useState` call to include `'landscape_irrigation'`.

### [x] 4. `apps/webapp/src/components/checkpoints/create-checkpoint-dialog.tsx`
**What:** Same additions to `ASSET_TYPES` and `LOCATION_SUGGESTIONS` (webapp uses plain string arrays, not label/value pairs).

```typescript
// ASSET_TYPES — insert before 'other'
{ label: 'Landscape & Irrigation', value: 'landscape_irrigation' as const },

// LOCATION_SUGGESTIONS.landscape_irrigation
landscape_irrigation: [
  'Front Lawn', 'Back Lawn', 'Side Yard', 'Lawn Overall',
  'Garden Beds', 'Raised Beds', 'Vegetable Garden', 'Flower Beds', 'Planters',
  'Trees', 'Shrubs & Hedges', 'Ground Cover',
  'Sprinkler Zone', 'Sprinkler Heads', 'Drip Lines', 'Irrigation Controller', 'Backflow Preventer',
  'Drainage System', 'French Drain', 'Swale / Grading',
  'Retaining Wall', 'Mulch / Rock Beds', 'Pathway & Edging',
  'Other',
],
```

Also update the `assetType` state type literal.

### [x] 5. `gcp/proxy/workers/function/checkpoint_analysis/prompt_builder.py`
**What:** Three additions.

**a) `get_asset_category()` — add landscape keywords before the default `return "property"` fallback:**
```python
landscape_keywords = [
    "lawn", "turf", "garden", "irrigation", "sprinkler", "drip line", "drip",
    "landscape", "landscaping", "drainage", "french drain", "swale",
    "plant", "shrub", "hedge", "tree", "ground cover", "mulch", "flower bed",
    "raised bed", "vegetable", "planter", "backflow", "irrigation controller",
    "retaining wall", "pathway", "edging",
]
if any(keyword in detected_lower for keyword in landscape_keywords):
    return "landscape_irrigation"
```

**b) `build_analysis_prompt()` — add `elif asset_category == "landscape_irrigation":` branch:**

The prompt should instruct Gemini to identify:
- **Plant health:** yellowing, browning, disease signs, pest damage, drought stress, overwatering, bare patches
- **Irrigation:** broken or misaligned heads, uneven water coverage, leaks, ponding, dry spots visible
- **Drainage:** erosion, standing water, grading problems, washouts
- **Weed presence** and infestation severity
- **Hardscape condition:** retaining walls, edging, mulch coverage

`condition_scores` keys: `plant_health`, `irrigation_coverage`, `drainage`, `overall`
`damage_scores` keys: `drought_stress`, `pest_damage`, `erosion`, `irrigation_failure`, `disease`
`cost_estimates`: same `repairs_immediate` + `maintenance_annual` as other categories

**c) `build_comparison_prompt()` — add matching `elif` branch:**

Focus comparison on:
1. Plant health changes (growth, die-back, disease spread, treatment effects)
2. Irrigation changes (new leaks, repaired heads, coverage shifts)
3. Drainage changes (erosion progression, ponding, grading work)
4. Seasonal/cyclical changes vs. actual damage progression

### [x] 6. `gcp/proxy/workers/function/checkpoint_analysis/area_detection.py`
**What:** Update `detect_room_area()` Gemini prompt to recognise a fourth category.

In the prompt block that currently lists three categories (PROPERTY/ROOM, VEHICLE/ASSET, APPLIANCE), add:
```
- LANDSCAPE/IRRIGATION: Outdoor landscape areas or irrigation infrastructure
  (Front Lawn, Back Lawn, Garden Beds, Sprinkler Heads, Drip Lines,
   Irrigation Controller, Backflow Preventer, Drainage System, French Drain,
   Trees, Shrubs, Flower Beds, Retaining Wall, etc.)
```

And update the `detectedAsset` description to include examples for landscape:
```
* For landscape/irrigation: Area or component name
  (e.g., "Front Lawn", "Garden Beds", "Sprinkler Zone", "Drainage System")
```

Update `compare_room_similarity()` to similarly mention that landscape/irrigation areas are valid comparison targets.

---

## Location taxonomy rationale

| Group | Locations |
|-------|-----------|
| Lawn & Turf | Front Lawn, Back Lawn, Side Yard, Lawn Overall |
| Garden & Planting | Garden Beds, Raised Beds, Vegetable Garden, Flower Beds, Planters |
| Trees & Shrubs | Trees, Shrubs & Hedges, Ground Cover |
| Irrigation Infrastructure | Sprinkler Zone, Sprinkler Heads, Drip Lines, Irrigation Controller, Backflow Preventer |
| Drainage | Drainage System, French Drain, Swale / Grading |
| Hardscape & Edging | Retaining Wall, Mulch / Rock Beds, Pathway & Edging |
| Custom | Other |

---

## Risks & decisions

| Risk | Mitigation |
|------|------------|
| `get_asset_category()` keyword list: a location like "Garden" in an existing `real_estate` checkpoint could now match landscape keywords | Low risk — "Garden" already exists in the `real_estate` location list but has always returned `"property"` prompt, which is still appropriate for a garden-area-within-property view. Keyword "garden" is included because the landscape category is opt-in via assetType; the prompt difference is minor for a garden photo either way. |
| Webapp `assetType` state type | Must be updated in the local `useState` declaration and any prop types in webapp (mirrored from common). |
| Firestore/indexes | No change needed. `assetType` stored as string; existing composite indexes on `(propertyId, createdAt)` and `(location, createdAt)` are unaffected. |
| Agent retrieval | `list_recent_property_checkpoints` filters by `location` string, not `assetType`. Landscape checkpoints will appear in retrieval automatically once stored. |
| Metrics worker | `metrics_aggregator.py` computes scores from `aiAnalysis.condition_scores.overall` regardless of asset type — landscape checkpoints will appear in the per-property trend chart immediately. |

---

## Tests to add

- `gcp/agents/homecare/tests/`: Add a unit test for `get_asset_category()` covering new landscape keywords (e.g., `"Front Lawn"` → `"landscape_irrigation"`, `"Sprinkler Heads"` → `"landscape_irrigation"`)
- `gcp/agents/homecare/tests/`: Add a snapshot/fixture test for `build_analysis_prompt()` with `asset_category="landscape_irrigation"` to guard against prompt regressions
- Manual QA: create a landscape checkpoint in `adk web` on staging; verify `aiAnalysis.condition_scores` contains `plant_health` and `irrigation_coverage` keys

---

## Out of scope (not in this plan)

- Passing `assetType` through the Pub/Sub message (keyword matching in `get_asset_category` is sufficient and consistent with existing pattern)
- New Firestore fields specific to landscape (existing `condition_scores` dynamic keys handle it)
- New agent optional branches for landscape (DIY/service/cost branches already work generically)
- UI changes beyond the dropdowns (detail view, metrics dashboard, comparison — all work with existing dynamic rendering)

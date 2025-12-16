# Automatic Area/Room Detection for Checkpoints

## Overview

The checkpoint system now intelligently detects and groups photos/videos by area/room using Gemini Vision AI. This allows users to simply take random photos or videos around their house, and the system will automatically:

1. **Detect the room/area type** from each image (e.g., "Kitchen", "Master Bedroom", "Bathroom")
2. **Group checkpoints** from the same area together
3. **Suggest location names** when creating new checkpoints
4. **Match new photos** with existing checkpoints from the same area

## How It Works

### 1. Room Detection (Automatic)

When a checkpoint is analyzed (image or video), Gemini Vision AI:

- Identifies the room/area type (Kitchen, Living Room, Bedroom, Bathroom, etc.)
- Detects key features that identify the room (stove, sink, toilet, bed, etc.)
- Provides a confidence score (0.0-1.0)
- Stores this information in Firestore
- **Videos**: Automatically extracts key frames for analysis (Gemini handles this internally)

**Implementation:** `gcp/proxy/workers/function/area_detection.py::detect_room_area()`

### 2. Visual Similarity Comparison

To group checkpoints from the same area, the system:

- Compares new images/videos with existing checkpoint media
- Uses Gemini to determine if media shows the same room/area
- Supports comparing images to images, videos to videos, or mixed comparisons
- Provides similarity scores and reasoning
- Groups checkpoints when similarity is above threshold (75%)

**Implementation:** `gcp/proxy/workers/function/area_detection.py::compare_room_similarity()`

### 3. Matching Algorithm

When a new checkpoint is created:

1. Room/area is detected from the image
2. System searches existing checkpoints for the same property
3. Compares visual similarity with each existing checkpoint
4. If match found (similarity > 75%), suggests grouping or auto-assigns location

**Implementation:** `gcp/proxy/workers/function/area_detection.py::find_matching_checkpoint()`

## Integration with Checkpoint Analysis

Room detection is automatically included in the checkpoint analysis workflow:

```python
# In checkpoint_service.py
def analyze_checkpoint_image(image_url, content_type, location=None):
    # If location not provided, detect it automatically
    if not location:
        detected_room_info = detect_room_area(image_url, content_type)
        location = detected_room_info["detectedRoom"]

    # Continue with analysis...
    # Returns analysis + room detection info
```

## Firestore Schema Updates

Checkpoints now include these fields:

```typescript
{
  location?: string;           // User-provided or auto-detected room name
  detectedRoom?: string;       // Auto-detected room/area name
  roomConfidence?: number;     // 0-1 confidence score
  roomFeatures?: string[];     // Key identifying features
  areaDescription?: string;    // Detailed area description
}
```

## Frontend Integration

### Auto-Detection on Checkpoint Creation

When a user creates a checkpoint without specifying location:

1. Image or video is uploaded
2. Analysis is triggered (via Pub/Sub)
3. Room is automatically detected (for videos, key frames are extracted automatically)
4. Location field is auto-populated with detected room name
5. User can override if needed

### Suggested Matching

When viewing a checkpoint list, the frontend can:

- Group checkpoints by `location` or `detectedRoom`
- Show "Similar to..." suggestions
- Filter by room type
- Display room confidence scores

### Example UI Flow

```
User takes photo of kitchen → Uploads → System detects "Kitchen"
→ Location auto-filled → User can edit if needed → Saved

Later, user takes another kitchen photo → System detects "Kitchen"
→ Finds existing kitchen checkpoint → Suggests grouping
```

## API Endpoints

### Enhanced Analysis Response

The checkpoint analysis now includes room detection:

```json
{
  "summary": "Modern kitchen with island...",
  "conditions": ["good", "clean"],
  "detectedItems": ["stove", "refrigerator", "sink"],
  "issues": [],
  "detectedRoom": "Kitchen",
  "roomConfidence": 0.95,
  "roomFeatures": ["stove", "sink", "refrigerator", "cabinet"],
  "areaDescription": "Kitchen with island and modern appliances"
}
```

## Future Enhancements

### 1. Batch Room Detection

- Detect room for multiple checkpoints at once
- Batch process for efficiency

### 2. Room Learning

- Learn user's room naming conventions
- Improve detection accuracy over time
- Handle custom room names (e.g., "John's Room")

### 3. Multi-Room Detection

- Handle photos that show multiple rooms
- Detect room transitions in videos

### 4. Spatial Mapping

- Build a property map based on checkpoint locations
- Visualize checkpoint distribution by room
- 3D floor plan integration

### 5. Smart Grouping UI

- Automatic grouping of similar checkpoints
- Timeline view grouped by room
- Quick location assignment for multiple checkpoints

## Configuration

### Similarity Threshold

Adjust the similarity threshold in `area_detection.py`:

```python
SIMILARITY_THRESHOLD = 0.75  # Minimum similarity to consider as same area
```

Lower values = more aggressive grouping (may group different rooms)
Higher values = more conservative (may miss same room from different angles)

### Room Detection Confidence

The system uses `roomConfidence` to filter low-confidence detections:

```python
if room_confidence > 0.7:  # Only use if confident
    use_detected_room()
```

## Performance Considerations

### Cost Optimization

- Room detection is done during analysis (already calling Gemini)
- Visual similarity comparison is optional (can be triggered on-demand)
- Results are cached in Firestore (no re-detection needed)

### Accuracy vs Speed

- Room detection: Fast (~1-2 seconds)
- Similarity comparison: Slower (~3-5 seconds for two images)
- Recommendation: Do similarity comparison in background or on-demand

## Example Use Cases

### Use Case 1: Random House Tour

User takes 10 photos randomly around the house:

- Photo 1: Kitchen → Detected as "Kitchen"
- Photo 2: Living Room → Detected as "Living Room"
- Photo 3: Kitchen (different angle) → Detected as "Kitchen", matched with Photo 1
- Result: 2 groups (Kitchen: 2 photos, Living Room: 1 photo)

### Use Case 2: Monthly Inspection

User takes photos of same areas monthly:

- System remembers previous locations
- New photos automatically grouped with previous ones
- Timeline view shows progression per room

### Use Case 3: Damage Documentation

User takes multiple photos of damaged area:

- All photos detected as same room
- Automatically grouped together
- Easy to compare before/after

## Troubleshooting

### Room Detection Issues

If room detection is inaccurate:

1. Check image quality (low quality = lower accuracy)
2. Review confidence scores (low confidence = less reliable)
3. User can always override detected location
4. System learns from user corrections over time

### Grouping Issues

If similar rooms aren't grouped:

1. Check similarity threshold setting
2. Review similarity scores in logs
3. Different lighting/angles may reduce similarity
4. Manual grouping always available as fallback

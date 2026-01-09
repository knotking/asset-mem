/**
 * Zoom Tracker - Captures click events for post-processing zoom effects
 * Similar to Cursorful's approach: track cursor/click events during recording
 */

export interface ClickEvent {
  x: number;
  y: number;
  time: number; // milliseconds since recording start
  timestamp: string; // ISO timestamp for debugging
}

export interface ZoomTrigger {
  startTime: number; // seconds
  endTime: number; // seconds
  centerX: number;
  centerY: number;
  zoomLevel: number;
  panX?: number; // pan x position (for dynamic panning)
  panY?: number; // pan y position (for dynamic panning)
}

export class ZoomTracker {
  private clickEvents: ClickEvent[] = [];
  private recordingStartTime: number;

  constructor() {
    this.recordingStartTime = Date.now();
  }

  /**
   * Track a click event
   */
  trackClick(x: number, y: number): void {
    const time = Date.now() - this.recordingStartTime;
    this.clickEvents.push({
      x,
      y,
      time,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get all click events
   */
  getEvents(): ClickEvent[] {
    return [...this.clickEvents];
  }

  /**
   * Find zoom triggers - each single click triggers a zoom effect
   * The zoom is centered on the click position and lasts for zoomDuration seconds
   */
  findZoomTriggers(
    zoomDuration: number = 1.5,
    zoomLevel: number = 1.8,
    minGapBetweenZooms: number = 2.0 // minimum seconds between zoom triggers
  ): ZoomTrigger[] {
    const triggers: ZoomTrigger[] = [];
    const events = this.getEvents();

    if (events.length === 0) {
      return triggers;
    }

    // Each click triggers a zoom effect
    let lastZoomEndTime = -minGapBetweenZooms; // Allow first click to trigger zoom
    
    for (const event of events) {
      const clickTime = event.time / 1000; // convert to seconds
      
      // Skip if too close to the last zoom (avoid overlapping zooms)
      if (clickTime < lastZoomEndTime + minGapBetweenZooms) {
        continue;
      }

      triggers.push({
        startTime: clickTime,
        endTime: clickTime + zoomDuration,
        centerX: event.x,
        centerY: event.y,
        zoomLevel,
      });

      lastZoomEndTime = clickTime + zoomDuration;
    }

    return triggers;
  }

  /**
   * Save events to JSON file for debugging/analysis
   */
  async saveEvents(outputPath: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    const data = {
      events: this.getEvents(),
      triggers: this.findZoomTriggers(),
      recordingStartTime: new Date(this.recordingStartTime).toISOString(),
    };

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  }
}

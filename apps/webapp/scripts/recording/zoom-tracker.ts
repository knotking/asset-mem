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

  /** Restore clicks from a saved zoom-events JSON (for re-processing). */
  loadRecordedEvents(
    events: Array<{ x: number; y: number; time: number }>
  ): void {
    this.clickEvents = events.map((e) => ({
      x: e.x,
      y: e.y,
      time: e.time,
      timestamp: new Date().toISOString(),
    }));
  }

  /** Keep zoom centered on the click; only clamp so the crop stays on-screen. */
  private clampZoomCenterToViewport(
    x: number,
    y: number,
    viewport: { width: number; height: number },
    zoomLevel: number
  ): { x: number; y: number } {
    const halfW = viewport.width / zoomLevel / 2;
    const halfH = viewport.height / zoomLevel / 2;
    return {
      x: Math.max(halfW, Math.min(x, viewport.width - halfW)),
      y: Math.max(halfH, Math.min(y, viewport.height - halfH)),
    };
  }

  /**
   * Find zoom triggers - each click gets a subtle zoom centered on that click.
   */
  findZoomTriggers(
    zoomDuration: number = 1.0,
    zoomLevel: number = 1.2,
    minGapBetweenZooms: number = 2.0,
    viewport: { width: number; height: number } = { width: 1920, height: 1080 }
  ): ZoomTrigger[] {
    const triggers: ZoomTrigger[] = [];
    const events = this.getEvents();

    if (events.length === 0) {
      return triggers;
    }

    // Each click triggers a zoom effect (min gap measured click-to-click)
    let lastZoomClickTime = -minGapBetweenZooms;
    
    for (const event of events) {
      const clickTime = event.time / 1000; // convert to seconds
      
      if (clickTime < lastZoomClickTime + minGapBetweenZooms) {
        continue;
      }

      const center = this.clampZoomCenterToViewport(
        event.x,
        event.y,
        viewport,
        zoomLevel
      );

      triggers.push({
        startTime: clickTime,
        endTime: clickTime + zoomDuration,
        centerX: center.x,
        centerY: center.y,
        zoomLevel,
      });

      lastZoomClickTime = clickTime;
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

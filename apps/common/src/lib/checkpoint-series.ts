import type { Firestore } from "firebase/firestore";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import type { CheckpointCaptureKind } from "../types";

export type CaptureSeriesAssignment = {
  seriesId: string;
  revisionNumber: number;
  isLatestInSeries: boolean;
  supersedesCaptureId: string | null;
};

/** Align with `normalizeReportLocation` and Python `normalize_series_location`. */
export function normalizeSeriesLocation(location?: string): string {
  const normalized = (location ?? "unspecified").trim().toLowerCase();
  return normalized || "unspecified";
}

export function seriesDisplayName(location?: string, name?: string): string {
  const raw = (location || name || "Untitled").trim();
  return raw || "Untitled";
}

export function makeSeriesId(locationKey: string): string {
  const slug =
    locationKey.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    "unspecified";
  return `series_${slug}`.slice(0, 1500);
}

export function resolveSeriesLocationKey(params: {
  location?: string;
  name?: string;
}): string {
  return normalizeSeriesLocation(params.location || params.name);
}

export async function assignCaptureToSeries(
  db: Firestore,
  params: {
    userId: string;
    propertyId: string;
    checkpointId: string;
    location?: string;
    name?: string;
    assetType?: string;
    captureKind?: CheckpointCaptureKind;
  }
): Promise<CaptureSeriesAssignment> {
  const {
    userId,
    propertyId,
    checkpointId,
    location,
    name,
    assetType,
    captureKind = "ad_hoc",
  } = params;

  const locationKey = resolveSeriesLocationKey({ location, name });
  const seriesId = makeSeriesId(locationKey);
  const display = seriesDisplayName(location, name);

  return runTransaction(db, async (transaction) => {
    const cpRef = doc(
      db,
      `users/${userId}/properties/${propertyId}/checkpoints/${checkpointId}`
    );
    const seriesRef = doc(
      db,
      `users/${userId}/properties/${propertyId}/checkpointSeries/${seriesId}`
    );

    const cpSnap = await transaction.get(cpRef);
    if (!cpSnap.exists()) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    const cpData = cpSnap.data();
    if (cpData?.seriesId) {
      return {
        seriesId: cpData.seriesId as string,
        revisionNumber: (cpData.revisionNumber as number) ?? 0,
        isLatestInSeries: cpData.isLatestInSeries !== false,
        supersedesCaptureId:
          (cpData.supersedesCaptureId as string | null) ?? null,
      };
    }

    const seriesSnap = await transaction.get(seriesRef);
    let revisionNumber: number;
    let supersedesCaptureId: string | null = null;

    if (seriesSnap.exists()) {
      const seriesData = seriesSnap.data() ?? {};
      const prevLatestId =
        (seriesData.latestCaptureId as string | null) ?? null;
      revisionNumber = (seriesData.captureCount as number) + 1;
      supersedesCaptureId = prevLatestId;

      if (prevLatestId) {
        const prevRef = doc(
          db,
          `users/${userId}/properties/${propertyId}/checkpoints/${prevLatestId}`
        );
        transaction.update(prevRef, { isLatestInSeries: false });
      }

      transaction.update(cpRef, {
        seriesId,
        revisionNumber,
        isLatestInSeries: true,
        supersedesCaptureId: prevLatestId,
        captureKind,
      });
      transaction.update(seriesRef, {
        latestCaptureId: checkpointId,
        captureCount: revisionNumber,
        updatedAt: serverTimestamp(),
      });
    } else {
      revisionNumber = 1;
      transaction.update(cpRef, {
        seriesId,
        revisionNumber: 1,
        isLatestInSeries: true,
        supersedesCaptureId: null,
        captureKind,
      });
      transaction.set(seriesRef, {
        userId,
        propertyId,
        name: display,
        location: locationKey,
        assetType: assetType || "real_estate",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        latestCaptureId: checkpointId,
        captureCount: 1,
      });
    }

    return {
      seriesId,
      revisionNumber,
      isLatestInSeries: true,
      supersedesCaptureId,
    };
  });
}

/** Create checkpoint doc + series assignment atomically. */
export async function createCheckpointWithSeries(
  db: Firestore,
  params: {
    userId: string;
    propertyId: string;
    checkpointData: Record<string, unknown>;
    location?: string;
    name?: string;
    assetType?: string;
    captureKind?: CheckpointCaptureKind;
  }
): Promise<{ id: string; series: CaptureSeriesAssignment }> {
  const {
    userId,
    propertyId,
    checkpointData,
    location,
    name,
    assetType,
    captureKind,
  } = params;

  const checkpointRef = doc(
    collection(db, `users/${userId}/properties/${propertyId}/checkpoints`)
  );

  const locationKey = resolveSeriesLocationKey({ location, name });
  const seriesId = makeSeriesId(locationKey);
  const display = seriesDisplayName(location, name);

  const series = await runTransaction(db, async (transaction) => {
    const seriesRef = doc(
      db,
      `users/${userId}/properties/${propertyId}/checkpointSeries/${seriesId}`
    );
    const seriesSnap = await transaction.get(seriesRef);

    let revisionNumber: number;
    let supersedesCaptureId: string | null = null;

    if (seriesSnap.exists()) {
      const seriesData = seriesSnap.data() ?? {};
      const prevLatestId =
        (seriesData.latestCaptureId as string | null) ?? null;
      revisionNumber = (seriesData.captureCount as number) + 1;
      supersedesCaptureId = prevLatestId;

      if (prevLatestId) {
        transaction.update(
          doc(
            db,
            `users/${userId}/properties/${propertyId}/checkpoints/${prevLatestId}`
          ),
          { isLatestInSeries: false }
        );
      }

      transaction.set(checkpointRef, {
        ...checkpointData,
        seriesId,
        revisionNumber,
        isLatestInSeries: true,
        supersedesCaptureId: prevLatestId,
        captureKind: captureKind ?? "ad_hoc",
      });
      transaction.update(seriesRef, {
        latestCaptureId: checkpointRef.id,
        captureCount: revisionNumber,
        updatedAt: serverTimestamp(),
      });
    } else {
      revisionNumber = 1;
      transaction.set(checkpointRef, {
        ...checkpointData,
        seriesId,
        revisionNumber: 1,
        isLatestInSeries: true,
        supersedesCaptureId: null,
        captureKind: captureKind ?? "ad_hoc",
      });
      transaction.set(seriesRef, {
        userId,
        propertyId,
        name: display,
        location: locationKey,
        assetType: assetType || "real_estate",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        latestCaptureId: checkpointRef.id,
        captureCount: 1,
      });
    }

    return {
      seriesId,
      revisionNumber,
      isLatestInSeries: true,
      supersedesCaptureId,
    };
  });

  return { id: checkpointRef.id, series };
}

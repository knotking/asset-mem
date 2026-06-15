import type { Firestore, Transaction } from "firebase/firestore";
import {
  collection,
  doc,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import type { CheckpointCaptureKind, Checkpoint } from "@/lib/types";
import { checkpointEffectiveDate } from "./report-resolve";

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
  allowNameFallback?: boolean;
}): string {
  if (params.location?.trim()) {
    return normalizeSeriesLocation(params.location);
  }
  if (params.allowNameFallback !== false && params.name?.trim()) {
    return normalizeSeriesLocation(params.name);
  }
  return "unspecified";
}

export function targetSeriesIdForLocation(location?: string): string {
  return makeSeriesId(normalizeSeriesLocation(location));
}

export function userProvidedSeriesLocation(checkpoint: {
  userProvidedLocation?: boolean;
  location?: string;
}): boolean {
  if (checkpoint.userProvidedLocation != null) {
    return checkpoint.userProvidedLocation;
  }
  return Boolean(checkpoint.location?.trim());
}

export function shouldReassignSeriesAfterAnalysis(
  checkpoint: {
    userProvidedLocation?: boolean;
    location?: string;
    seriesId?: string;
  },
  finalLocation?: string
): boolean {
  if (!finalLocation?.trim()) {
    return false;
  }
  if (userProvidedSeriesLocation(checkpoint)) {
    return false;
  }
  return checkpoint.seriesId !== targetSeriesIdForLocation(finalLocation);
}

export type SeriesMemberInput = {
  id: string;
  createdAt?: unknown;
  capturedAt?: unknown;
};

export function sortSeriesMembersChronologically<T extends SeriesMemberInput>(
  members: T[]
): T[] {
  return [...members].sort((a, b) => {
    const aMs =
      checkpointEffectiveDate({
        createdAt: a.createdAt as Checkpoint["createdAt"],
        capturedAt: a.capturedAt as Checkpoint["capturedAt"],
      })?.getTime() ?? 0;
    const bMs =
      checkpointEffectiveDate({
        createdAt: b.createdAt as Checkpoint["createdAt"],
        capturedAt: b.capturedAt as Checkpoint["capturedAt"],
      })?.getTime() ?? 0;
    if (aMs !== bMs) {
      return aMs - bMs;
    }
    return a.id.localeCompare(b.id);
  });
}

export function buildChronologicalSeriesFields(sortedIds: string[]): Map<
  string,
  {
    revisionNumber: number;
    supersedesCaptureId: string | null;
    isLatestInSeries: boolean;
  }
> {
  const fields = new Map<
    string,
    {
      revisionNumber: number;
      supersedesCaptureId: string | null;
      isLatestInSeries: boolean;
    }
  >();
  for (let index = 0; index < sortedIds.length; index += 1) {
    const id = sortedIds[index];
    fields.set(id, {
      revisionNumber: index + 1,
      supersedesCaptureId: index > 0 ? sortedIds[index - 1] : null,
      isLatestInSeries: index === sortedIds.length - 1,
    });
  }
  return fields;
}

type SeriesMemberRecord = {
  id: string;
  data: Record<string, unknown>;
};

function checkpointsCollection(db: Firestore, userId: string, propertyId: string) {
  return collection(db, `users/${userId}/properties/${propertyId}/checkpoints`);
}

function seriesDocRef(db: Firestore, userId: string, propertyId: string, seriesId: string) {
  return doc(
    db,
    `users/${userId}/properties/${propertyId}/checkpointSeries/${seriesId}`
  );
}

async function getSeriesMembersInTransaction(
  transaction: Transaction,
  db: Firestore,
  userId: string,
  propertyId: string,
  seriesId: string
): Promise<SeriesMemberRecord[]> {
  const membersQuery = query(
    checkpointsCollection(db, userId, propertyId),
    where("seriesId", "==", seriesId)
  );
  // Firebase runtime supports query reads inside transactions; typings are narrow.
  const snapshot = await (
    transaction as Transaction & {
      get: (queryRef: typeof membersQuery) => Promise<{
        docs: Array<{ id: string; data: () => Record<string, unknown> }>;
      }>;
    }
  ).get(membersQuery);
  return snapshot.docs.map((memberDoc) => ({
    id: memberDoc.id,
    data: memberDoc.data(),
  }));
}

/** Apply revision numbers by capture date (oldest = v1). */
function applyChronologicalSeriesRenumber(
  transaction: Transaction,
  db: Firestore,
  params: {
    userId: string;
    propertyId: string;
    seriesId: string;
    members: SeriesMemberRecord[];
    seriesExists: boolean;
    seriesMeta: {
      locationKey: string;
      display: string;
      assetType?: string;
    };
    perCheckpointExtra?: (checkpointId: string) => Record<string, unknown>;
    focusCheckpointId?: string;
  }
): CaptureSeriesAssignment {
  const {
    userId,
    propertyId,
    seriesId,
    members,
    seriesExists,
    seriesMeta,
    perCheckpointExtra,
    focusCheckpointId,
  } = params;

  const sorted = sortSeriesMembersChronologically(
    members.map((member) => ({
      id: member.id,
      createdAt: member.data.createdAt,
      capturedAt: member.data.capturedAt,
    }))
  );
  const sortedIds = sorted.map((member) => member.id);
  const fields = buildChronologicalSeriesFields(sortedIds);
  const memberById = new Map(members.map((member) => [member.id, member]));

  for (const memberId of sortedIds) {
    const revision = fields.get(memberId)!;
    const extra = perCheckpointExtra?.(memberId) ?? {};
    transaction.update(
      doc(db, `users/${userId}/properties/${propertyId}/checkpoints/${memberId}`),
      {
        seriesId,
        revisionNumber: revision.revisionNumber,
        isLatestInSeries: revision.isLatestInSeries,
        supersedesCaptureId: revision.supersedesCaptureId,
        ...extra,
      }
    );
    void memberById.get(memberId);
  }

  const latestId = sortedIds[sortedIds.length - 1];
  const firstId = sortedIds[0];
  const seriesRef = seriesDocRef(db, userId, propertyId, seriesId);
  const seriesUpdate = {
    latestCaptureId: latestId,
    captureCount: sortedIds.length,
    updatedAt: serverTimestamp(),
    name: seriesMeta.display,
    location: seriesMeta.locationKey,
  };

  if (seriesExists) {
    transaction.update(seriesRef, seriesUpdate);
  } else {
    transaction.set(seriesRef, {
      userId,
      propertyId,
      assetType: seriesMeta.assetType || "real_estate",
      createdAt: serverTimestamp(),
      baselineCaptureId: firstId,
      ...seriesUpdate,
    });
  }

  const focusId = focusCheckpointId ?? latestId;
  const focusFields = fields.get(focusId)!;
  return {
    seriesId,
    revisionNumber: focusFields.revisionNumber,
    isLatestInSeries: focusFields.isLatestInSeries,
    supersedesCaptureId: focusFields.supersedesCaptureId,
  };
}

function syncRemainingSeriesMembersChronologically(
  transaction: Transaction,
  db: Firestore,
  params: {
    userId: string;
    propertyId: string;
    seriesId: string;
    members: SeriesMemberRecord[];
    seriesMeta?: {
      locationKey: string;
      display: string;
      assetType?: string;
    };
  }
): void {
  const { userId, propertyId, seriesId, members, seriesMeta } = params;
  const seriesRef = seriesDocRef(db, userId, propertyId, seriesId);

  if (members.length === 0) {
    transaction.delete(seriesRef);
    return;
  }

  const fallbackMeta = {
    locationKey: String(members[0].data.location ?? "unspecified"),
    display: String(members[0].data.name ?? "Untitled"),
    assetType: members[0].data.assetType as string | undefined,
  };

  applyChronologicalSeriesRenumber(transaction, db, {
    userId,
    propertyId,
    seriesId,
    members,
    seriesExists: true,
    seriesMeta: seriesMeta ?? fallbackMeta,
  });
}

async function attachCaptureToSeries(
  transaction: Transaction,
  db: Firestore,
  params: {
    userId: string;
    propertyId: string;
    checkpointId: string;
    seriesId: string;
    locationKey: string;
    display: string;
    assetType?: string;
    captureKind: CheckpointCaptureKind;
    markUserProvided?: boolean;
    movingCheckpointData: Record<string, unknown>;
    existingMemberDocs: SeriesMemberRecord[];
    seriesExists: boolean;
  }
): Promise<CaptureSeriesAssignment> {
  const {
    userId,
    propertyId,
    checkpointId,
    seriesId,
    locationKey,
    display,
    assetType,
    captureKind,
    markUserProvided,
    movingCheckpointData,
    existingMemberDocs,
    seriesExists,
  } = params;

  const members = [
    ...existingMemberDocs.filter((member) => member.id !== checkpointId),
    { id: checkpointId, data: movingCheckpointData },
  ];

  return applyChronologicalSeriesRenumber(transaction, db, {
    userId,
    propertyId,
    seriesId,
    members,
    seriesExists,
    seriesMeta: {
      locationKey,
      display,
      assetType,
    },
    focusCheckpointId: checkpointId,
    perCheckpointExtra: (memberId) =>
      memberId === checkpointId
        ? {
            captureKind,
            ...(markUserProvided
              ? { location: display, userProvidedLocation: true }
              : {}),
          }
        : {},
  });
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
    const seriesRef = seriesDocRef(db, userId, propertyId, seriesId);

    const cpSnap = await transaction.get(cpRef);
    if (!cpSnap.exists()) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    const cpData = cpSnap.data() ?? {};
    if (cpData.seriesId) {
      return {
        seriesId: cpData.seriesId as string,
        revisionNumber: (cpData.revisionNumber as number) ?? 0,
        isLatestInSeries: cpData.isLatestInSeries !== false,
        supersedesCaptureId:
          (cpData.supersedesCaptureId as string | null) ?? null,
      };
    }

    const seriesSnap = await transaction.get(seriesRef);
    const existingMemberDocs = seriesSnap.exists()
      ? await getSeriesMembersInTransaction(
          transaction,
          db,
          userId,
          propertyId,
          seriesId
        )
      : [];

    return attachCaptureToSeries(transaction, db, {
      userId,
      propertyId,
      checkpointId,
      seriesId,
      locationKey,
      display,
      assetType,
      captureKind,
      movingCheckpointData: cpData,
      existingMemberDocs,
      seriesExists: seriesSnap.exists(),
    });
  });
}

/** Move a capture into the series for the given location (create/join as needed). */
export async function reassignCaptureToSeries(
  db: Firestore,
  params: {
    userId: string;
    propertyId: string;
    checkpointId: string;
    location: string;
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

  if (!location.trim()) {
    throw new Error("location is required to reassign a capture to a series");
  }

  const locationKey = normalizeSeriesLocation(location);
  const seriesId = makeSeriesId(locationKey);
  const display = seriesDisplayName(location, name);

  return runTransaction(db, async (transaction) => {
    const cpRef = doc(
      db,
      `users/${userId}/properties/${propertyId}/checkpoints/${checkpointId}`
    );
    const targetSeriesRef = seriesDocRef(db, userId, propertyId, seriesId);

    const cpSnap = await transaction.get(cpRef);
    if (!cpSnap.exists()) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }

    const cpData = cpSnap.data() ?? {};
    const oldSeriesId = cpData.seriesId as string | undefined;

    if (cpData.isLatestInSeries === false) {
      throw new Error(
        "Cannot reassign a non-latest capture in a series. Reassign the latest capture first."
      );
    }

    const targetSeriesSnap = await transaction.get(targetSeriesRef);
    const targetMemberDocs = targetSeriesSnap.exists()
      ? await getSeriesMembersInTransaction(
          transaction,
          db,
          userId,
          propertyId,
          seriesId
        )
      : [];

    const oldMemberDocs =
      oldSeriesId && oldSeriesId !== seriesId
        ? await getSeriesMembersInTransaction(
            transaction,
            db,
            userId,
            propertyId,
            oldSeriesId
          )
        : [];
    const oldSeriesSnap =
      oldSeriesId && oldSeriesId !== seriesId
        ? await transaction.get(seriesDocRef(db, userId, propertyId, oldSeriesId))
        : null;

    if (oldSeriesId === seriesId) {
      return applyChronologicalSeriesRenumber(transaction, db, {
        userId,
        propertyId,
        seriesId,
        members: targetMemberDocs,
        seriesExists: true,
        seriesMeta: {
          locationKey,
          display,
          assetType: assetType ?? (cpData.assetType as string | undefined),
        },
        focusCheckpointId: checkpointId,
        perCheckpointExtra: (memberId) =>
          memberId === checkpointId
            ? {
                captureKind:
                  captureKind ??
                  (cpData.captureKind as CheckpointCaptureKind) ??
                  "ad_hoc",
                location: display,
                userProvidedLocation: true,
              }
            : {},
      });
    }

    if (oldMemberDocs.length > 0 || (oldSeriesId && oldSeriesId !== seriesId)) {
      const remainingMembers = oldMemberDocs.filter(
        (member) => member.id !== checkpointId
      );
      const oldSeriesData = oldSeriesSnap?.data();
      syncRemainingSeriesMembersChronologically(transaction, db, {
        userId,
        propertyId,
        seriesId: oldSeriesId!,
        members: remainingMembers,
        seriesMeta: oldSeriesData
          ? {
              locationKey: String(oldSeriesData.location ?? "unspecified"),
              display: String(oldSeriesData.name ?? "Untitled"),
              assetType: oldSeriesData.assetType as string | undefined,
            }
          : undefined,
      });
    }

    const existingMemberDocs = targetMemberDocs.filter(
      (member) => member.id !== checkpointId
    );

    return attachCaptureToSeries(transaction, db, {
      userId,
      propertyId,
      checkpointId,
      seriesId,
      locationKey,
      display,
      assetType: assetType ?? (cpData.assetType as string | undefined),
      captureKind:
        captureKind ?? (cpData.captureKind as CheckpointCaptureKind) ?? "ad_hoc",
      markUserProvided: true,
      movingCheckpointData: cpData,
      existingMemberDocs,
      seriesExists: targetSeriesSnap.exists(),
    });
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
): Promise<{ id: string; series: CaptureSeriesAssignment | null }> {
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

  const hasUserLocation = Boolean(location?.trim());

  if (!hasUserLocation) {
    await runTransaction(db, async (transaction) => {
      transaction.set(checkpointRef, {
        ...checkpointData,
        userProvidedLocation: false,
        captureKind: captureKind ?? "ad_hoc",
      });
    });
    return { id: checkpointRef.id, series: null };
  }

  const locationKey = resolveSeriesLocationKey({
    location,
    allowNameFallback: false,
  });
  const seriesId = makeSeriesId(locationKey);
  const display = seriesDisplayName(location, name);

  const series = await runTransaction(db, async (transaction) => {
    const seriesRef = seriesDocRef(db, userId, propertyId, seriesId);
    const seriesSnap = await transaction.get(seriesRef);
    const movingCheckpointData = {
      ...checkpointData,
      userProvidedLocation: true,
      captureKind: captureKind ?? "ad_hoc",
    };

    transaction.set(checkpointRef, movingCheckpointData);

    const existingMemberDocs = seriesSnap.exists()
      ? (
          await getSeriesMembersInTransaction(
            transaction,
            db,
            userId,
            propertyId,
            seriesId
          )
        ).filter((member) => member.id !== checkpointRef.id)
      : [];

    return attachCaptureToSeries(transaction, db, {
      userId,
      propertyId,
      checkpointId: checkpointRef.id,
      seriesId,
      locationKey,
      display,
      assetType,
      captureKind: captureKind ?? "ad_hoc",
      movingCheckpointData,
      existingMemberDocs,
      seriesExists: seriesSnap.exists(),
    });
  });

  return { id: checkpointRef.id, series };
}

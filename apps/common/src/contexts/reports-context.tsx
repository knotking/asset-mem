import * as React from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import type { PropertyReport } from "../types";
import { useAuth } from "./auth-context";
import { useFirebase } from "./firebase-context";
import { useProperty } from "./property-context";

export type ReportsContextValue = {
  reports: PropertyReport[];
  loading: boolean;
};

const ReportsContext = React.createContext<ReportsContextValue | undefined>(
  undefined
);

export function ReportsProvider({ children }: { children: React.ReactNode }) {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { property } = useProperty();
  const [reports, setReports] = React.useState<PropertyReport[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!user || !property?.id) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(
      db,
      `users/${user.uid}/properties/${property.id}/reports`
    );
    const q = query(ref, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setReports(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<PropertyReport, "id">),
          }))
        );
        setLoading(false);
      },
      () => {
        setReports([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [db, user, property?.id]);

  const value = React.useMemo(
    () => ({ reports, loading }),
    [reports, loading]
  );

  return (
    <ReportsContext.Provider value={value}>{children}</ReportsContext.Provider>
  );
}

export function useReports(): ReportsContextValue {
  const ctx = React.useContext(ReportsContext);
  if (!ctx) {
    throw new Error("useReports must be used within ReportsProvider");
  }
  return ctx;
}

export function formatReportDateRange(start?: string, end?: string): string {
  if (!start && !end) return "—";
  if (start === end || !end) return start ?? end ?? "—";
  return `${start} — ${end}`;
}

export function reportStatusLabel(status: PropertyReport["status"]): string {
  switch (status) {
    case "generating":
      return "Generating…";
    case "ready":
      return "Ready";
    case "failed":
      return "Failed";
    case "draft":
      return "Draft";
    default:
      return status;
  }
}

function formatRangeBound(value: unknown): string | undefined {
  if (typeof value === "string") return value.slice(0, 10);
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10);
  }
  return undefined;
}

export function reportDateRangeLabel(report: PropertyReport): string {
  const range = report.snapshotRange;
  if (!range) return "—";
  return formatReportDateRange(
    formatRangeBound(range.start),
    formatRangeBound(range.end)
  );
}

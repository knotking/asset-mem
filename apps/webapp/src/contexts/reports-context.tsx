"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { InspectionReport } from "@/lib/types";
import { useAuth } from "@/contexts/auth-context";
import { useProperty } from "@/contexts/property-context";
import { useFirebase } from "@/contexts/firebase-context";

interface ReportsContextType {
  reports: InspectionReport[];
  loading: boolean;
  selectedReport: InspectionReport | null;
  setSelectedReport: (report: InspectionReport | null) => void;
  uploadReport: (
    file: File,
    reportType: InspectionReport["reportType"]
  ) => Promise<string>;
  chatWithReport: (reportId: string, question: string) => Promise<string>;
}

const ReportsContext = createContext<ReportsContextType | undefined>(
  undefined
);

export const ReportsProvider = ({ children }: { children: ReactNode }) => {
  const { db, storage } = useFirebase();
  const { user } = useAuth();
  const { property } = useProperty();
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] =
    useState<InspectionReport | null>(null);

  // Listen to reports collection
  useEffect(() => {
    if (!user || !property) {
      setReports([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, `users/${user.uid}/properties/${property.id}/reports`),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const reportsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          // Exclude embedding field for performance
          const { embedding, ...rest } = data;
          return {
            id: doc.id,
            ...rest,
          } as InspectionReport;
        });

        setReports(reportsData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching reports:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, user, property]);

  const uploadReport = useCallback(
    async (
      file: File,
      reportType: InspectionReport["reportType"]
    ): Promise<string> => {
      if (!user || !property) {
        throw new Error("User or property not found");
      }

      try {
        // Upload file to Firebase Storage
        const timestamp = Date.now();
        const fileName = `report_${timestamp}_${file.name}`;
        const storagePath = `reports/${user.uid}/${property.id}/${fileName}`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(storageRef);
        const gsURI = `gs://${storage.app.options.storageBucket}/${storagePath}`;

        // Create report document in Firestore
        const reportData = {
          userId: user.uid,
          propertyId: property.id,
          name: file.name,
          url: downloadURL,
          storagePath,
          gsURI,
          contentType: file.type,
          createdAt: serverTimestamp(),
          reportType,
          status: "uploading" as const,
        };

        const docRef = await addDoc(
          collection(db, `users/${user.uid}/properties/${property.id}/reports`),
          reportData
        );

        // Update status to analyzing
        await updateDoc(docRef, { status: "analyzing" });

        // Trigger analysis via API
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const webhookSecret = process.env.NEXT_PUBLIC_FIREBASE_WEBHOOK_SECRET || "";
        
        if (apiUrl && webhookSecret) {
          try {
            await fetch(`${apiUrl}/${webhookSecret}/analyze-report`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                reportUri: gsURI,
                contentType: file.type,
                reportId: docRef.id,
                userId: user.uid,
                propertyId: property.id,
              }),
            });
          } catch (apiError) {
            console.error("Error triggering report analysis:", apiError);
            // Don't throw - the document is created, analysis can be retried
          }
        }

        return docRef.id;
      } catch (error) {
        console.error("Error uploading report:", error);
        throw error;
      }
    },
    [user, property, storage, db]
  );

  const chatWithReport = useCallback(
    async (reportId: string, question: string): Promise<string> => {
      if (!user || !property) {
        throw new Error("User or property not found");
      }

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
        const webhookSecret = process.env.NEXT_PUBLIC_FIREBASE_WEBHOOK_SECRET || "";
        
        if (!apiUrl || !webhookSecret) {
          throw new Error("API configuration missing");
        }

        const response = await fetch(
          `${apiUrl}/${webhookSecret}/chat-with-report`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              userQuery: question,
              reportId,
              userId: user.uid,
              propertyId: property.id,
            }),
          }
        );

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.answer || "No answer received";
      } catch (error) {
        console.error("Error chatting with report:", error);
        throw error;
      }
    },
    [user, property]
  );

  return (
    <ReportsContext.Provider
      value={{
        reports,
        loading,
        selectedReport,
        setSelectedReport,
        uploadReport,
        chatWithReport,
      }}
    >
      {children}
    </ReportsContext.Provider>
  );
};

export const useReports = () => {
  const context = useContext(ReportsContext);
  if (context === undefined) {
    throw new Error("useReports must be used within a ReportsProvider");
  }
  return context;
};


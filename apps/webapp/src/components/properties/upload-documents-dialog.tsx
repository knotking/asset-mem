"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, File as FileIcon, Camera } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { CameraCaptureDialog } from "@/components/chat/camera-capture-dialog";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { extractDocInfo } from "@/ai/flows/extract-doc-info";
import { postFileToAgent } from "@/app/actions";
import { useParams, useRouter } from "next/navigation";
import type { Property } from "@/lib/types";
import { useUploadDialog } from "@/contexts/upload-dialog-context";
import { useAddressConfirmation } from "@/contexts/address-confirmation-context";
import { useSession } from "@/contexts/session-context";
import {
  PROPERTY_TYPES,
  getSubTypesForType,
  type PropertyType,
  type PropertySubType,
} from "@/lib/property-types";

type UploadableFile = {
  file: File;
  id: string;
};

// This component is now controlled by the UploadDialogProvider
export function UploadDocumentsDialog({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [files, setFiles] = useState<UploadableFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [cameraDialogOpen, setCameraDialogOpen] = useState(false);
  const [propertyType, setPropertyType] = useState<PropertyType | null>(null);
  const [propertySubType, setPropertySubType] =
    useState<PropertySubType | null>(null);
  const params = useParams();
  const propertyId = params.propertyId as string;
  const isNewPropertyFlow = propertyId === "new-property";

  const { isOpen: contextIsOpen, onClose: contextOnClose } = useUploadDialog();
  const { createPropertyDraftSession } = useSession();
  const open = controlledOpen ?? contextIsOpen;
  const onOpenChange = controlledOnOpenChange ?? contextOnClose;

  const { confirm: confirmAddressUpdate } = useAddressConfirmation();

  // Effect to handle opening for new property flow
  useEffect(() => {
    if (isNewPropertyFlow && controlledOnOpenChange) {
      controlledOnOpenChange(true);
    }
  }, [isNewPropertyFlow, controlledOnOpenChange]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const MAX_FILE_SIZE = 10485760; // 10MB
      const validFiles: UploadableFile[] = [];
      const oversizedFiles: string[] = [];

      for (const file of acceptedFiles) {
        if (file.size > MAX_FILE_SIZE) {
          oversizedFiles.push(file.name);
        } else {
          validFiles.push({
            file,
            id: `${file.name}-${file.size}-${Date.now()}`,
          });
        }
      }

      if (oversizedFiles.length > 0) {
        toast({
          variant: "destructive",
          title: "Some files are too large",
          description: `Maximum file size is 10MB. Skipped: ${oversizedFiles.join(", ")}`,
        });
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }
    },
    [toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
    },
  });

  const removeFile = (id: string) => {
    setFiles((files) => files.filter((file) => file.id !== id));
  };

  const handleCameraCapture = (file: File) => {
    const MAX_FILE_SIZE = 10485760; // 10MB

    if (file.size > MAX_FILE_SIZE) {
      toast({
        variant: "destructive",
        title: "Image too large",
        description:
          "Maximum file size is 10MB. Please try again with lower resolution.",
      });
      setCameraDialogOpen(false);
      return;
    }

    const newFile: UploadableFile = {
      file,
      id: `${file.name}-${file.size}-${Date.now()}`,
    };
    setFiles((prev) => [...prev, newFile]);
    setCameraDialogOpen(false);
  };

  const handleClose = () => {
    if (isUploading) return;
    setFiles([]);
    setPropertyType(null);
    setPropertySubType(null);
    setCameraDialogOpen(false);
    onOpenChange(false);
    if (isNewPropertyFlow) {
      router.push("/home");
    }
  };

  const handleTypeChange = (type: PropertyType) => {
    setPropertyType(type);
    setPropertySubType(null); // Reset sub-type when type changes
  };

  const handleUploadAndAnalyze = async () => {
    if (!user || files.length === 0) return;

    setIsUploading(true);
    onOpenChange(false); // Close the dialog immediately
    toast({
      title: "Uploading...",
      description: `${files.length} document(s) are being uploaded and analyzed.`,
    });

    const fileList = [...files];
    setFiles([]); // Clear the file list in dialog

    let currentPropertyId = isNewPropertyFlow ? null : propertyId;

    if (isNewPropertyFlow && !currentPropertyId) {
      const tempName = fileList[0].file.name.split(".")[0] || "New Property";
      const propertyData: any = {
        userId: user.uid,
        name: tempName,
        address: "Pending address...",
        createdAt: serverTimestamp(),
      };

      // Add type and sub-type if selected
      if (propertyType) {
        propertyData.propertyType = propertyType;
      }
      if (propertySubType && propertySubType !== "none") {
        propertyData.propertySubType = propertySubType;
      }

      const propRef = await addDoc(
        collection(db, "users", user.uid, "properties"),
        propertyData
      );
      currentPropertyId = propRef.id;

      // Eagerly create the draft session for the new propeπrty
      createPropertyDraftSession(user.uid, currentPropertyId).catch(() => {});

      router.replace(`/home/properties/${currentPropertyId}/details`);
    }

    const docsCollectionRef = collection(db, "users", user.uid, "docs");
    const batch = writeBatch(db);
    const newDocRefs: { docId: string; file: File }[] = [];

    for (const uploadableFile of fileList) {
      const newDocRef = doc(docsCollectionRef);
      batch.set(newDocRef, {
        userId: user.uid,
        name: uploadableFile.file.name,
        contentType: uploadableFile.file.type,
        createdAt: serverTimestamp(),
        status: "uploading",
        propertyId: currentPropertyId,
        url: "",
        storagePath: "",
        summary: "Processing...",
      });
      newDocRefs.push({ docId: newDocRef.id, file: uploadableFile.file });
    }

    try {
      await batch.commit();
    } catch (error) {
      console.error("Error creating placeholder documents:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Could not start the upload process.",
      });
      setIsUploading(false);
      return;
    }

    const analysisPromises = newDocRefs.map(async ({ docId, file }) => {
      try {
        const storageRef = ref(
          storage,
          `documents/${user.uid}/${Date.now()}_${file.name}`
        );
        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type,
        });

        await uploadTask;

        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        const snapshotRef = uploadTask.snapshot.ref;
        const gsURI = `gs://${snapshotRef.bucket}/${snapshotRef.fullPath}`;

        await updateDoc(doc(db, "users", user.uid, "docs", docId), {
          url: downloadURL,
          storagePath: snapshotRef.fullPath,
          gsURI: gsURI,
          status: "analyzing",
        });

        await Promise.all([
          postFileToAgent(gsURI, user.uid),
          extractDocInfo({ docUrl: gsURI, contentType: file.type, userId: user.uid }).then(
            async (result) => {
              const updateData: any = {
                documentType: result.documentType,
                keyEntities: result.keyEntities,
                summary: result.summary,
                status: "complete",
                propertyAddress: result.propertyAddress,
              };

              if (
                currentPropertyId &&
                result.propertyAddress &&
                result.propertyAddress !== "N/A"
              ) {
                const propRef = doc(
                  db,
                  "users",
                  user.uid,
                  "properties",
                  currentPropertyId
                );
                const propSnap = await getDoc(propRef);

                if (isNewPropertyFlow) {
                  // For a new property, just update the address directly.
                  await updateDoc(propRef, {
                    name: result.propertyAddress, // Set name to address for new properties
                    address: result.propertyAddress,
                  });
                } else if (propSnap.exists()) {
                  // For an existing property, confirm before updating if the address is different.
                  const propData = propSnap.data() as Property;
                  if (propData.address !== result.propertyAddress) {
                    const shouldUpdate = await confirmAddressUpdate(
                      result.propertyAddress
                    );
                    if (shouldUpdate) {
                      await updateDoc(propRef, {
                        address: result.propertyAddress,
                      });
                    }
                  }
                }
              }
              return updateDoc(
                doc(db, "users", user.uid, "docs", docId),
                updateData
              );
            }
          ),
        ]);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        await updateDoc(doc(db, "users", user.uid, "docs", docId), {
          status: "failed",
          summary: "Analysis failed for this document.",
        });
      }
    });

    await Promise.all(analysisPromises);

    toast({
      title: "Processing Complete",
      description: "All documents have been analyzed.",
    });
    setIsUploading(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Property Documents</DialogTitle>
            <DialogDescription>
              Upload documents related to your property such as inspection
              reports, floor plans, permits, etc.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {/* Property Type Selection */}
            <div className="mb-4 space-y-2">
              <Label htmlFor="property-type">Property Type</Label>
              <Select
                value={propertyType || ""}
                onValueChange={(value) => {
                  if (value) {
                    handleTypeChange(value as PropertyType);
                  } else {
                    setPropertyType(null);
                  }
                }}
                disabled={isUploading}
              >
                <SelectTrigger id="property-type" className="w-full">
                  <SelectValue placeholder="Select property type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Property Sub-Type Selection */}
            {propertyType && getSubTypesForType(propertyType).length > 0 && (
              <div className="mb-4 space-y-2">
                <Label htmlFor="property-subtype">Sub-Type (Optional)</Label>
                <Select
                  value={propertySubType || ""}
                  onValueChange={(value) => {
                    if (value) {
                      setPropertySubType(value as PropertySubType);
                    } else {
                      setPropertySubType(null);
                    }
                  }}
                  disabled={isUploading}
                >
                  <SelectTrigger id="property-subtype" className="w-full">
                    <SelectValue placeholder="Select sub-type (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {getSubTypesForType(propertyType).map((subType) => (
                      <SelectItem key={subType.value} value={subType.value}>
                        {subType.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {files.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mb-4">
                {files.map((uploadableFile) => (
                  <div
                    key={uploadableFile.id}
                    className="flex items-center gap-4 p-2 border rounded-lg"
                  >
                    <FileIcon className="h-6 w-6 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {uploadableFile.file.name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeFile(uploadableFile.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-3">
              <div
                {...getRootProps()}
                className={`p-10 border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors ${isDragActive ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Upload className="h-8 w-8" />
                  <p className="font-semibold">
                    Drop files here or click to browse
                  </p>
                  <p className="text-xs">
                    Supports PDF, DOC, DOCX, JPG, PNG, XLS, XLSX files
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 pointer-events-none"
                  >
                    Choose Files
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-xs text-muted-foreground">OR</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>
              <Button
                variant="outline"
                onClick={() => setCameraDialogOpen(true)}
                className="w-full"
                disabled={isUploading}
              >
                <Camera className="mr-2 h-4 w-4" />
                Take Photo
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUploadAndAnalyze}
              disabled={files.length === 0 || isUploading}
            >
              {isUploading
                ? "Uploading..."
                : `Upload ${files.length} Document${files.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CameraCaptureDialog
        open={cameraDialogOpen}
        onOpenChange={setCameraDialogOpen}
        onCapture={handleCameraCapture}
      />
    </>
  );
}

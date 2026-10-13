import React, { useCallback, useState, useEffect } from "react";
import { Upload, Camera, X } from "lucide-react";

interface ImageUploadProps {
  onImageSelected: (base64: string, preview: string) => void;
  isLoading: boolean;
  externalPreview?: string | null;
  onClear?: () => void;
}

/** Resize image to max 512×512 maintaining aspect ratio via canvas */
export function preprocessImage(dataUrl: string): Promise<{ base64: string; preview: string }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const MAX = 512;
      let { width, height } = img;

      // Scale down proportionally
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);

      const preview = canvas.toDataURL("image/jpeg", 0.92);
      const base64 = preview.split(",")[1];
      resolve({ base64, preview });
    };
    img.src = dataUrl;
  });
}

/** Helper to convert an image URL to base64 via canvas */
export async function urlToBase64(imageUrl: string): Promise<{ base64: string; preview: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const MAX = 512;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context failed");
        ctx.drawImage(img, 0, 0, width, height);
        const preview = canvas.toDataURL("image/jpeg", 0.92);
        const base64 = preview.split(",")[1];
        resolve({ base64, preview });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(e);
    img.src = imageUrl;
  });
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageSelected,
  isLoading,
  externalPreview,
  onClear,
}) => {
  const [preview, setPreview] = useState<string | null>(externalPreview || null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    if (externalPreview !== undefined) {
      setPreview(externalPreview);
    }
  }, [externalPreview]);

  const processFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = async (e) => {
        const raw = e.target?.result as string;
        const { base64, preview } = await preprocessImage(raw);
        setPreview(preview);
        onImageSelected(base64, preview);
      };
      reader.readAsDataURL(file);
    },
    [onImageSelected]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const clear = () => {
    setPreview(null);
    if (onClear) onClear();
  };

  return (
    <div className="w-full">
      {preview ? (
        <div className="relative rounded-lg border border-border bg-muted shadow-sm overflow-hidden">
          <div className="w-full h-64 flex items-center justify-center p-2">
            <img src={preview} alt="Uploaded dish" className="max-h-full max-w-full object-contain rounded-md" />
          </div>
          {!isLoading && (
            <button
              onClick={clear}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-foreground/70 text-background hover:bg-foreground/90 transition-colors shadow-sm"
              title="Remove image"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      ) : (
        <label
          className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
            dragActive
              ? "border-primary bg-accent"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <div className="p-4 rounded-full bg-accent">
              <Camera className="w-8 h-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium text-foreground">Upload a dish photo</p>
              <p className="text-sm">Drag & drop or click to browse</p>
            </div>
            <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-primary/10 text-primary">
              <Upload className="w-3 h-3" />
              JPG, PNG, WEBP
            </div>
          </div>
          <input type="file" className="hidden" accept="image/*" onChange={handleChange} />
        </label>
      )}
    </div>
  );
};

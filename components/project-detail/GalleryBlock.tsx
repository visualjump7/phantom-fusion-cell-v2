"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Upload, Trash2, Pencil, Loader2, X, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectImage } from "@/lib/project-detail-service";
import {
  uploadImage,
  deleteImage,
  updateImageCaption,
} from "@/lib/project-detail-service";
import { ImageLightbox } from "./ImageLightbox";

interface GalleryBlockProps {
  blockId: string;
  orgId: string;
  assetId: string;
  images: ProjectImage[];
  onUpdate: () => void;
}

export function GalleryBlock({
  blockId,
  orgId,
  assetId,
  images,
  onUpdate,
}: GalleryBlockProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState("");

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) continue; // 10MB max
      await uploadImage(blockId, orgId, assetId, file);
    }
    setUploading(false);
    onUpdate();
  };

  const handleDelete = async (imageId: string) => {
    await deleteImage(imageId);
    onUpdate();
  };

  const handleSaveCaption = async (imageId: string) => {
    await updateImageCaption(imageId, captionText);
    setEditingCaption(null);
    onUpdate();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleUpload(e.dataTransfer.files);
  };

  if (images.length === 0) {
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border py-16 transition-colors hover:border-primary/50 hover:bg-muted/20"
      >
        <Camera className="h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">
          Upload project photos, site images, or documents
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Click or drag and drop
        </p>
        {uploading && (
          <Loader2 className="mt-3 h-5 w-5 animate-spin text-primary" />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="group relative overflow-hidden rounded-lg border border-border bg-card"
            >
              <div
                className="aspect-[4/3] cursor-pointer overflow-hidden"
                onClick={() => setLightboxIndex(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={image.caption || image.file_name || "Image"}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              </div>

              {/* Hover overlay */}
              <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingCaption(image.id);
                    setCaptionText(image.caption || "");
                  }}
                  className="rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(image.id);
                  }}
                  className="rounded-md bg-black/60 p-1.5 text-red-400 hover:bg-black/80"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Caption area */}
              <div className="p-2">
                {editingCaption === image.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={captionText}
                      onChange={(e) => setCaptionText(e.target.value)}
                      placeholder="Add caption..."
                      className="flex-1 rounded border border-border bg-card px-2 py-1 text-xs text-foreground"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveCaption(image.id);
                        if (e.key === "Escape") setEditingCaption(null);
                      }}
                    />
                    <button
                      onClick={() => handleSaveCaption(image.id)}
                      className="rounded p-1 text-green-400 hover:bg-muted"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingCaption(null)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="truncate text-xs text-muted-foreground">
                    {image.caption || image.file_name || "No caption"}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Upload zone */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border transition-colors hover:border-primary/50 hover:bg-muted/20"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          ) : (
            <>
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="mt-2 text-xs text-muted-foreground">Add photos</p>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleUpload(e.target.files)}
      />

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <ImageLightbox
          images={images}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}

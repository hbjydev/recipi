"use client";

import { useState } from "react";
import { MAX_IMAGE_BYTES } from "@/lib/image-policy";

type Props = {
  value: string;
  onChange: (url: string) => void;
  onUploadingChange: (uploading: boolean) => void;
};

export default function RecipeImageField({ value, onChange, onUploadingChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Choose an image under 5 MB.");
      return;
    }
    setUploading(true);
    onUploadingChange(true);
    setError("");
    try {
      const form = new FormData();
      form.set("image", file);
      const response = await fetch("/api/images", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Image upload failed");
      onChange(result.url);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  }

  return (
    <div className="image-upload-field">
      <span className="image-upload-label">Recipe image</span>
      {value && (
        <div
          className="image-upload-preview"
          style={{ backgroundImage: `url("${value.replaceAll('"', "%22")}")` }}
          role="img"
          aria-label="Recipe image preview"
        />
      )}
      <div className="image-upload-controls">
        <label className="button button-secondary image-upload-button">
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            className="text-button danger"
            disabled={uploading}
            onClick={() => onChange("")}
          >
            Remove image
          </button>
        )}
        <span>JPEG, PNG, or WebP · up to 5 MB</span>
      </div>
      {error && (
        <p className="image-upload-error" role="alert">
          {error}
        </p>
      )}
      <label className="field full">
        <span>Or use an image URL</span>
        <input
          type="url"
          placeholder="https://..."
          disabled={uploading}
          value={value.startsWith("/api/images/") ? "" : value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}

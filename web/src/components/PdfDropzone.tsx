"use client";

import { useRef, useState } from "react";
import { Icon } from "./ui";

export type UploadResult = {
  title: string;
  text: string;
  truncated: boolean;
  totalPages: number;
};

export function PdfDropzone({ onExtracted }: { onExtracted: (r: UploadResult) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      onExtracted(data as UploadResult);
    } catch {
      setError("Network error while uploading. Is the server still running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a PDF"
        aria-busy={busy}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) handleFile(f);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`group relative cursor-pointer rounded-2xl border bg-surface p-10 text-center transition-all duration-200 ${
          dragOver
            ? "border-accent bg-accent-soft/60 shadow-[0_8px_24px_oklch(0_0_0/0.07)]"
            : busy
              ? "border-line"
              : "border-line hover:border-line-strong hover:shadow-[0_6px_20px_oklch(0_0_0/0.06)] hover:-translate-y-0.5"
        }`}
      >
        {/* dashed inner frame reads as "drop target" without dominating */}
        <div
          className={`pointer-events-none absolute inset-2.5 rounded-xl border border-dashed transition-colors duration-200 ${
            dragOver ? "border-accent" : "border-line group-hover:border-line-strong"
          }`}
        />

        <div className="relative flex flex-col items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors duration-200 ${
              dragOver ? "bg-accent text-on-accent" : "bg-accent-soft text-accent"
            }`}
          >
            {busy ? Icon.doc("h-5 w-5 animate-pulse-soft") : Icon.upload("h-5 w-5")}
          </div>

          {busy ? (
            <>
              <p className="font-medium">
                Reading <span className="text-accent">{fileName}</span>
              </p>
              <div className="h-1 w-44 overflow-hidden rounded-full bg-raised">
                <div className="h-full w-2/5 rounded-full bg-accent animate-crawl" />
              </div>
              <p className="text-xs text-faint">Extracting text server-side</p>
            </>
          ) : (
            <>
              <p className="text-[15px] font-medium">
                {dragOver ? "Drop it" : "Drop a PDF here, or click to browse"}
              </p>
              <p className="text-xs text-faint">Text-based PDFs · up to 15 MB</p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="animate-fade-up mt-3 flex items-start gap-2 rounded-lg border border-err/30 bg-err-soft p-3 text-sm text-err-ink"
        >
          {Icon.x("mt-0.5 text-err")}
          <div>
            {error}
            <button
              onClick={() => {
                setError(null);
                inputRef.current?.click();
              }}
              className="ml-2 font-medium underline underline-offset-2 hover:no-underline"
            >
              Try another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

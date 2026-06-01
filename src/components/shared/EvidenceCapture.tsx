"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CameraOff,
  FlipHorizontal2,
  ImageIcon,
  Film,
  RefreshCw,
  UploadCloud,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type NoiseReport,
  analyzeAudioFile,
  WaveformGraph,
  NoiseReportCard,
  NoisePrivacyDisclaimer,
  BilingualNoiseDraft,
} from "@/components/shared/NoiseAnalysis";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EvidenceCaptureProps {
  maxFiles?: number;
  onFilesChange: (files: File[]) => void;
  onNoiseReport?: (report: NoiseReport | null) => void;
  locationBlock?: string;  // e.g. "C1" — used in bilingual draft
  accept?: string[];
  disabled?: boolean;
}

interface CapturedFile {
  id: string;
  file: File;
  previewUrl: string;
  isVideo: boolean;
}

// ─── Image Compression Utility ────────────────────────────────────────────────

async function compressImage(
  file: File,
  maxDimension = 1280,
  initialQuality = 0.82
): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);

      const tryBlob = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size > 10 * 1024 * 1024 && quality > 0.4) {
              tryBlob(quality - 0.15);
            } else {
              resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
            }
          },
          "image/jpeg",
          quality
        );
      };
      tryBlob(initialQuality);
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EvidenceCapture({
  maxFiles = 3,
  onFilesChange,
  onNoiseReport,
  locationBlock = "",
  accept = ["image/jpeg", "image/png", "video/mp4"],
  disabled = false,
}: EvidenceCaptureProps) {
  // After mount, detect if we should use camera mode
  const [isMobileCamera, setIsMobileCamera] = useState(false);
  const [hasCheckedCapability, setHasCheckedCapability] = useState(false);

  useEffect(() => {
    const mobile = typeof window !== "undefined" && window.innerWidth < 1024 &&
      !!navigator.mediaDevices?.getUserMedia;
    setIsMobileCamera(mobile);
    setHasCheckedCapability(true);
  }, []);

  const [captured, setCaptured] = useState<CapturedFile[]>([]);
  const [fileError, setFileError] = useState("");
  const [noiseReport, setNoiseReport] = useState<NoiseReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);

  // Run audio analysis whenever a video file is added
  const runNoiseAnalysis = useCallback(async (file: File) => {
    if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) return;
    setIsAnalyzing(true);
    try {
      const report = await analyzeAudioFile(file);
      setNoiseReport(report);
      onNoiseReport?.(report);
    } catch {
      // Audio track may be absent; silently skip
    } finally {
      setIsAnalyzing(false);
    }
  }, [onNoiseReport]);

  const onFilesChangeRef = useRef(onFilesChange);
  const onNoiseReportRef = useRef(onNoiseReport);

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  useEffect(() => {
    onNoiseReportRef.current = onNoiseReport;
  }, [onNoiseReport]);

  useEffect(() => {
    // Defer the parent state synchronization execution to the next tick
    onFilesChangeRef.current(captured.map((c) => c.file));

    // Clear noise report if no more videos exist in the captured files
    if (!captured.some((c) => c.isVideo)) {
      setNoiseReport(null);
      onNoiseReportRef.current?.(null);
    }
  }, [captured]);

  const addFiles = useCallback(async (incoming: File[]) => {
    setFileError("");
    const remaining = maxFiles - captured.length;
    if (remaining <= 0) {
      setFileError(`Maximum ${maxFiles} files allowed.`);
      return;
    }
    const toAdd = incoming.slice(0, remaining);
    const validated: CapturedFile[] = [];
    for (const raw of toAdd) {
      if (!accept.includes(raw.type)) {
        setFileError("Only JPEG, PNG, or MP4 files are accepted.");
        continue;
      }
      const MAX = 10 * 1024 * 1024;
      if (!raw.type.startsWith("image/") && raw.size > MAX) {
        setFileError("Video files must be under 10 MB.");
        continue;
      }
      const file = raw.type.startsWith("image/") ? await compressImage(raw) : raw;
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      validated.push({ id, file, previewUrl, isVideo: file.type.startsWith("video/") });
    }
    if (validated.length === 0) return;
    // Trigger noise analysis for first video in batch
    const firstVideo = validated.find((c) => c.isVideo);
    if (firstVideo) runNoiseAnalysis(firstVideo.file);
    setCaptured((prev) => {
      const next = [...prev, ...validated].slice(0, maxFiles);
      return next;
    });
  }, [accept, captured.length, maxFiles]);

  const removeFile = useCallback((id: string) => {
    setCaptured((prev) => {
      const next = prev.filter((c) => c.id !== id);
      const removed = prev.find((c) => c.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }, []);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      captured.forEach((c) => URL.revokeObjectURL(c.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!hasCheckedCapability) return null;

  return (
    <div className="space-y-4">
      {/* ── Camera or Drop Zone ─────────────────────────── */}
      {isMobileCamera ? (
        captured.length < maxFiles && <MobileCameraView onCapture={addFiles} disabled={disabled} />
      ) : (
        <DesktopDropZone 
          files={captured} 
          onRemove={removeFile} 
          onFiles={addFiles} 
          accept={accept} 
          disabled={disabled} 
          maxFiles={maxFiles} 
        />
      )}

      {/* ── File Error ───────────────────────────────────── */}
      {fileError && (
        <p className="flex items-center gap-1.5 text-xs text-red-700">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
          {fileError}
        </p>
      )}

      {/* ── Preview Grid ─────────────────────────────────── */}
      {captured.length > 0 && isMobileCamera && (
        <CapturedPreview
          files={captured}
          onRemove={removeFile}
          isMobile={isMobileCamera}
        />
      )}

      {/* ── Count indicator ──────────────────────────────── */}
      {captured.length > 0 && (
        <p className="text-xs text-slate-500 text-right">
          {captured.length} / {maxFiles} file{captured.length !== 1 ? "s" : ""} added
        </p>
      )}

      {/* ── Privacy Disclaimer (shown when video present) ─ */}
      {captured.some((c) => c.isVideo) && <NoisePrivacyDisclaimer />}

      {/* ── Audio Analysis Loading ────────────────────────── */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
          <Loader2 className="h-4 w-4 animate-spin text-sky-600 flex-shrink-0" />
          <p className="text-xs font-medium text-sky-700">
            Analyzing audio waveform…
          </p>
        </div>
      )}

      {/* ── Waveform + Noise Report ───────────────────────── */}
      {noiseReport && !isAnalyzing && (
        <div className="space-y-3">
          <WaveformGraph
            samples={noiseReport.waveform_samples}
            peakIndex={noiseReport.waveform_samples.indexOf(
              Math.max(...noiseReport.waveform_samples)
            )}
          />
          <NoiseReportCard report={noiseReport} />
          {/* Bilingual draft only when threshold exceeded */}
          {noiseReport.threshold_violation && (
            <BilingualNoiseDraft
              block={locationBlock.split("-")[0] ?? locationBlock}
              onCopy={() => {
                setDraftCopied(true);
                setTimeout(() => setDraftCopied(false), 2000);
              }}
            />
          )}
          {draftCopied && (
            <p className="text-center text-xs font-medium text-emerald-700">✓ Copied to clipboard</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mobile Camera View ───────────────────────────────────────────────────────

function MobileCameraView({
  onCapture,
  disabled,
}: {
  onCapture: (files: File[]) => void;
  disabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);

  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isStreaming, setIsStreaming] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashActive, setFlashActive] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(async (mode: "environment" | "user") => {
    stopStream();
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsStreaming(true);
    } catch {
      setCameraError("Camera access denied. Use the file picker below.");
      setIsStreaming(false);
    }
  }, [stopStream]);

  useEffect(() => {
    startStream(facingMode);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const handleFlip = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    setIsCapturing(true);
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setIsCapturing(false); return; }
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (blob) {
        const raw = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
        const compressed = await compressImage(raw);
        onCapture([compressed]);
      }
      setIsCapturing(false);
    }, "image/jpeg", 0.9);
  }, [isCapturing, onCapture]);

  return (
    <>
      <style>{`
        .ec-btn {
          position: relative; overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .ec-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
          pointer-events: none;
        }
        .ec-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,48,135,0.30);
        }
        .ec-btn:active:not(:disabled) { transform: translateY(0); }
        .ec-capture-btn:hover:not(:disabled) {
          box-shadow: 0 0 0 6px rgba(29,78,216,0.18), 0 8px 24px rgba(0,48,135,0.3);
        }
        @keyframes cameraFlash {
          0% { opacity: 0.7; } 100% { opacity: 0; }
        }
        .camera-flash { animation: cameraFlash 0.2s ease forwards; }
      `}</style>

      <div className="rounded-2xl border border-slate-200 bg-slate-900 overflow-hidden shadow-lg ring-1 ring-slate-700">
        {/* Video viewport */}
        <div className="relative w-full aspect-[4/3] bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Flash overlay */}
          {flashActive && (
            <div className="camera-flash absolute inset-0 bg-white pointer-events-none z-20" />
          )}

          {/* Corner guides */}
          {isStreaming && (
            <>
              <div className="absolute top-3 left-3 h-7 w-7 border-t-2 border-l-2 border-white/60 rounded-tl-md pointer-events-none" />
              <div className="absolute top-3 right-3 h-7 w-7 border-t-2 border-r-2 border-white/60 rounded-tr-md pointer-events-none" />
              <div className="absolute bottom-3 left-3 h-7 w-7 border-b-2 border-l-2 border-white/60 rounded-bl-md pointer-events-none" />
              <div className="absolute bottom-3 right-3 h-7 w-7 border-b-2 border-r-2 border-white/60 rounded-br-md pointer-events-none" />
            </>
          )}

          {/* Camera off state */}
          {!isStreaming && !cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Starting camera…</p>
            </div>
          )}

          {cameraError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900 px-6 text-center">
              <CameraOff className="h-10 w-10 text-slate-400" />
              <p className="text-sm text-slate-300">{cameraError}</p>
            </div>
          )}

          {/* Flip Camera — top-right overlay */}
          {isStreaming && (
            <button
              type="button"
              onClick={handleFlip}
              disabled={disabled}
              aria-label="Flip camera"
              className="ec-btn absolute top-3 right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 disabled:opacity-40"
            >
              <FlipHorizontal2 className="h-5 w-5" />
            </button>
          )}

          {/* LIVE badge */}
          {isStreaming && (
            <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-black/50 px-2 py-1 backdrop-blur-sm">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-white">Live</span>
            </div>
          )}
        </div>

        {/* Controls bar */}
        <div className="flex items-center justify-center gap-4 bg-slate-900 px-4 py-5">
          {/* Retake hint — shows when streaming */}
          <div className="w-16 text-center">
            {isStreaming && (
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Rear cam</p>
            )}
          </div>

          {/* Main capture button */}
          <button
            type="button"
            id="ec-capture-btn"
            onClick={handleCapture}
            disabled={!isStreaming || disabled || isCapturing}
            aria-label="Capture photo"
            className="ec-btn ec-capture-btn relative flex h-18 w-18 items-center justify-center rounded-full border-4 border-white/20 bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-xl transition disabled:opacity-40"
            style={{ height: 72, width: 72 }}
          >
            {isCapturing ? (
              <Loader2 className="h-7 w-7 animate-spin" />
            ) : (
              <Camera className="h-7 w-7" />
            )}
          </button>

          {/* Spacer */}
          <div className="w-16" />
        </div>
      </div>

      {/* Fallback file input (always available) */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">or pick from gallery</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <button
        type="button"
        onClick={() => fallbackInputRef.current?.click()}
        disabled={disabled}
        className="ec-btn flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 transition disabled:opacity-40"
      >
        <ImageIcon className="h-4 w-4" />
        Choose from Gallery / Files
      </button>
      <input
        ref={fallbackInputRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) onCapture(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
    </>
  );
}

// ─── Desktop Drop Zone ────────────────────────────────────────────────────────

function DesktopDropZone({
  files,
  onRemove,
  onFiles,
  accept,
  disabled,
  maxFiles,
}: {
  files: CapturedFile[];
  onRemove: (id: string) => void;
  onFiles: (files: File[]) => void;
  accept: string[];
  disabled: boolean;
  maxFiles: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    onFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <>
      <style>{`
        .ec-btn {
          position: relative; overflow: hidden;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .ec-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%);
          pointer-events: none;
        }
        .ec-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,48,135,0.30);
        }
        .ec-btn:active:not(:disabled) { transform: translateY(0); }
      `}</style>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled && files.length < maxFiles) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={(e) => {
          if (!disabled && files.length < maxFiles) inputRef.current?.click();
        }}
        className={cn(
          "group relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200",
          isDragging
            ? "border-blue-400 bg-blue-50 shadow-lg shadow-blue-200/60"
            : "border-slate-300 bg-slate-50 hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md hover:shadow-blue-100/50",
          disabled && "pointer-events-none opacity-50",
          files.length > 0 && "py-6",
          files.length >= maxFiles && "cursor-default hover:border-slate-300 hover:bg-slate-50 hover:shadow-none"
        )}
      >
        {files.length === 0 ? (
          <>
            <div className={cn(
              "mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-200",
              isDragging
                ? "bg-blue-100 shadow-lg shadow-blue-300/40 ring-4 ring-blue-200/50"
                : "bg-slate-100 group-hover:bg-blue-100 group-hover:shadow-md group-hover:shadow-blue-200/40"
            )}>
              <UploadCloud className={cn(
                "h-8 w-8 transition-colors",
                isDragging ? "text-blue-600" : "text-slate-400 group-hover:text-blue-600"
              )} />
            </div>

            <p className={cn(
              "text-base font-semibold transition-colors",
              isDragging ? "text-blue-700" : "text-slate-700 group-hover:text-blue-700"
            )}>
              {isDragging ? "Drop files here" : "Drag & drop evidence files"}
            </p>
            <p className="mt-1 text-sm text-slate-500">or click to browse your files</p>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {[
                { icon: ImageIcon, label: "JPEG" },
                { icon: ImageIcon, label: "PNG" },
                { icon: Film, label: "MP4" },
              ].map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </span>
              ))}
            </div>

            <p className="mt-3 text-xs text-slate-400">Max {maxFiles} files · 10 MB each</p>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-center gap-4">
            {files.map((cf) => (
              <div
                key={cf.id}
                className="group/thumb relative h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition hover:shadow-md cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                {cf.isVideo ? (
                  <div className="flex h-full w-full items-center justify-center bg-slate-800">
                    <Film className="h-8 w-8 text-slate-400" />
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                      Video
                    </span>
                  </div>
                ) : (
                  <img
                    src={cf.previewUrl}
                    alt={cf.file.name}
                    className="h-full w-full object-cover transition group-hover/thumb:scale-105"
                  />
                )}
                
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(cf.id);
                  }}
                  aria-label={`Remove ${cf.file.name}`}
                  className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white shadow-lg transition-all hover:bg-red-700 hover:scale-110 opacity-0 group-hover/thumb:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            
            {files.length < maxFiles && (
              <div 
                className="flex h-28 w-28 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Plus className="h-6 w-6 mb-1" />
                <span className="text-xs font-medium">Add more</span>
              </div>
            )}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={accept.map((t) => `.${t.split("/")[1]}`).join(",")}
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />
      </div>
    </>
  );
}

// ─── Captured Preview Grid ────────────────────────────────────────────────────

function CapturedPreview({
  files,
  onRemove,
  isMobile,
}: {
  files: CapturedFile[];
  onRemove: (id: string) => void;
  isMobile: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          {isMobile ? "Captured Evidence" : "Selected Evidence"}
        </p>
        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {files.map((cf) => (
          <div
            key={cf.id}
            className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition hover:shadow-md"
          >
            {cf.isVideo ? (
              <div className="flex h-full w-full items-center justify-center bg-slate-800">
                <Film className="h-8 w-8 text-slate-400" />
                <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                  Video
                </span>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cf.previewUrl}
                alt={cf.file.name}
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
            )}

            {/* File size badge */}
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
              {(cf.file.size / 1024 / 1024).toFixed(1)} MB
            </span>

            {/* Remove button */}
            <button
              type="button"
              onClick={() => onRemove(cf.id)}
              aria-label={`Remove ${cf.file.name}`}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white opacity-0 shadow-lg transition-all hover:bg-red-700 hover:scale-110 group-hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {/* Retake button (mobile only) */}
            {isMobile && !cf.isVideo && (
              <button
                type="button"
                onClick={() => onRemove(cf.id)}
                aria-label="Retake photo"
                className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow-lg backdrop-blur-sm transition-all hover:bg-black/70 group-hover:opacity-100"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

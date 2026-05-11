"use client";

// ─── NoiseReport Type ─────────────────────────────────────────────────────────

export interface NoiseReport {
  peak_volume: number;          // highest dB value (mapped 0–100)
  average_volume: number;       // mean dB across all samples
  threshold_violation: boolean; // true when peak_volume > 60 dB
  waveform_samples: number[];   // ~100 normalised amplitude values (0–1)
  analyzed_at: string;          // ISO timestamp
}

// ─── Audio Analysis Utility ──────────────────────────────────────────────────
// Decodes the audio track from a video/audio File using the Web Audio API.
// All processing is fully in-browser — no audio is stored or transmitted.

export async function analyzeAudioFile(file: File): Promise<NoiseReport> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext();

  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  // Use the first channel (mono or L-channel of stereo)
  const channelData = audioBuffer.getChannelData(0);
  const totalSamples = channelData.length;
  const NUM_BUCKETS = 100;
  const bucketSize = Math.floor(totalSamples / NUM_BUCKETS);

  const waveform_samples: number[] = [];
  const dbValues: number[] = [];

  for (let i = 0; i < NUM_BUCKETS; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, totalSamples);
    let sumSquares = 0;
    for (let j = start; j < end; j++) {
      sumSquares += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sumSquares / (end - start));
    // Normalised 0–1 amplitude for waveform display
    waveform_samples.push(Math.min(1, rms * 4)); // scale up quiet recordings

    // Convert RMS to dB (reference: full-scale digital 0 dBFS = 100 on our scale)
    const db = rms > 0 ? 20 * Math.log10(rms) : -100;
    // Map –60..0 dBFS → 0..100 display scale
    const displayDb = Math.max(0, Math.min(100, (db + 60) * (100 / 60)));
    dbValues.push(displayDb);
  }

  const peak_volume = Math.max(...dbValues);
  const average_volume = dbValues.reduce((a, b) => a + b, 0) / dbValues.length;

  return {
    peak_volume: Math.round(peak_volume * 10) / 10,
    average_volume: Math.round(average_volume * 10) / 10,
    threshold_violation: peak_volume > 60,
    waveform_samples,
    analyzed_at: new Date().toISOString(),
  };
}

// ─── WaveformGraph Component ──────────────────────────────────────────────────

export function WaveformGraph({ samples, peakIndex }: { samples: number[]; peakIndex: number }) {
  const W = 200;
  const H = 48;
  const barW = W / samples.length;

  const getColor = (amplitude: number) => {
    if (amplitude < 0.4) return "#22c55e";   // green
    if (amplitude < 0.7) return "#f59e0b";   // amber
    return "#ef4444";                         // red
  };

  return (
    <div className="rounded-xl bg-slate-900 p-2 ring-1 ring-slate-700">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        aria-label="Audio waveform"
        role="img"
      >
        <defs>
          <linearGradient id="wf-grad" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        {samples.map((amp, i) => {
          const barH = Math.max(2, amp * H);
          const x = i * barW;
          const y = H - barH;
          const isPeak = i === peakIndex;
          return (
            <g key={i}>
              <rect
                x={x + 0.5}
                y={y}
                width={Math.max(1, barW - 1)}
                height={barH}
                rx={1}
                fill={isPeak ? "#ef4444" : getColor(amp)}
                opacity={isPeak ? 1 : 0.85}
              />
              {isPeak && (
                <circle
                  cx={x + barW / 2}
                  cy={y - 2}
                  r={2}
                  fill="white"
                  opacity={0.9}
                />
              )}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-widest text-slate-500">
        Audio Waveform — dB Amplitude Over Time
      </p>
    </div>
  );
}

// ─── NoiseReportCard Component ────────────────────────────────────────────────

export function NoiseReportCard({ report }: { report: NoiseReport }) {
  const { peak_volume, average_volume, threshold_violation } = report;
  return (
    <div className={`rounded-xl border p-4 ${threshold_violation
      ? "border-red-200 bg-gradient-to-r from-red-50 via-white to-rose-50"
      : "border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-green-50"
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔊</span>
          <div>
            <p className="text-sm font-bold text-slate-800">Noise Analysis Report</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Web Audio API · In-browser processing</p>
          </div>
        </div>
        {threshold_violation ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700 ring-1 ring-red-200">
            ⚠ THRESHOLD EXCEEDED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
            ✓ Within Safe Level
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className={`rounded-lg p-3 text-center ${threshold_violation ? "bg-red-100/60" : "bg-slate-100"}`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Peak Volume</p>
          <p className={`text-2xl font-black tabular-nums ${threshold_violation ? "text-red-700" : "text-slate-700"}`}>
            {peak_volume.toFixed(1)}
            <span className="text-sm font-semibold"> dB</span>
          </p>
        </div>
        <div className="rounded-lg bg-slate-100 p-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Avg Volume</p>
          <p className="text-2xl font-black tabular-nums text-slate-700">
            {average_volume.toFixed(1)}
            <span className="text-sm font-semibold"> dB</span>
          </p>
        </div>
      </div>
      <div className="mt-2 text-[10px] text-slate-400 text-right">
        Analyzed {new Date(report.analyzed_at).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ─── Privacy Disclaimer ───────────────────────────────────────────────────────

export function NoisePrivacyDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <span className="mt-0.5 text-base flex-shrink-0">🔒</span>
      <p className="text-xs leading-relaxed text-amber-800">
        <span className="font-semibold">Privacy Notice: </span>
        Only ambient noise levels are recorded for evidence. Voices are processed
        for decibel analysis and not stored as recognizable speech.
      </p>
    </div>
  );
}

// ─── Bilingual Draft Message ──────────────────────────────────────────────────

export function BilingualNoiseDraft({
  block,
  onCopy,
}: {
  block: string;
  onCopy?: () => void;
}) {
  const blockLabel = block || "[Block]";
  const en = `Security Notice: A high noise level has been detected in your vicinity (Block ${blockLabel}). Please keep volume levels low to maintain a conducive environment. Repeated violations may result in a fine according to the Student Handbook.`;
  const ms = `Notis Keselamatan: Tahap bunyi bising yang tinggi telah dikesan di kawasan anda (Blok ${blockLabel}). Sila pastikan tahap bunyi rendah bagi menjaga ketenteraman bersama. Pelanggaran berulang boleh mengakibatkan denda mengikut Buku Panduan Pelajar.`;

  const copyAll = () => {
    navigator.clipboard?.writeText(`${en}\n\n${ms}`).catch(() => {});
    onCopy?.();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-sm">📋</span>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Automated Notice Draft
          </p>
        </div>
        <button
          type="button"
          onClick={copyAll}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
        >
          Copy All
        </button>
      </div>
      <div className="p-4 space-y-3">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-blue-600">English</p>
          <p className="text-xs leading-relaxed text-slate-700 bg-blue-50 rounded-lg p-2.5 border border-blue-100">{en}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-purple-600">Bahasa Melayu</p>
          <p className="text-xs leading-relaxed text-slate-700 bg-purple-50 rounded-lg p-2.5 border border-purple-100">{ms}</p>
        </div>
      </div>
    </div>
  );
}

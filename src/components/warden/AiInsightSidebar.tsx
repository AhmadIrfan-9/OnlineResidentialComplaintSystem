"use client";

/**
 * src/components/warden/AiInsightSidebar.tsx
 *
 * Collapsible AI Intelligence Drawer — slides in from the right.
 * Triggered externally via the `isOpen` prop; calls `onClose` to dismiss.
 *
 * Features:
 * - Slide-in / slide-out CSS transition (no layout shift)
 * - Resizable width via drag handle (280 – 520 px)
 * - Priority badge (EMERGENCY / URGENT / ROUTINE) with semantic colours
 * - Arc-style "High Confidence" gauge replacing the flat bar
 * - One-click "Apply Action" + "Save Category" CTA row
 * - Collapsible policy reference with exact citation
 * - Shimmer skeleton while loading
 * - Graceful error + fallback states
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiInsightData {
  priority: "ROUTINE" | "URGENT" | "EMERGENCY";
  confidence: number;
  reason: string;
  suggestedAction: string;
  policyReference: string | null;
  similarCaseCount: number;
  generatedAt: string;
  latencyMs: number;
  error?: string;
  fallback?: boolean;
}

type FetchState = "idle" | "loading" | "success" | "error";

interface Props {
  complaintId: string;
  /** Controls visibility — parent toggles this */
  isOpen: boolean;
  /** Called when the user clicks the close / backdrop */
  onClose: () => void;
  /** Optional: wired up to quickly save category from AI suggestion */
  onApplySuggestedAction?: (action: string) => void;
}

// ─── Priority Config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  EMERGENCY: {
    label: "EMERGENCY",
    colour: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    glyph: "🔴",
    trackColor: "rgba(239,68,68,0.15)",
    arcColor: "#ef4444",
  },
  URGENT: {
    label: "URGENT",
    colour: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.35)",
    glyph: "🟠",
    trackColor: "rgba(249,115,22,0.15)",
    arcColor: "#f97316",
  },
  ROUTINE: {
    label: "ROUTINE",
    colour: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
    glyph: "🟢",
    trackColor: "rgba(34,197,94,0.15)",
    arcColor: "#22c55e",
  },
} as const;

// ─── Arc Gauge ────────────────────────────────────────────────────────────────

function ArcGauge({ value, color }: { value: number; color: string }) {
  const pct = Math.round(value * 100);
  const radius = 42;
  const stroke = 8;
  const cx = 56;
  const cy = 56;
  // half-circle arc from 180° to 0° (left to right)
  const circumference = Math.PI * radius; // half circle
  const filled = (pct / 100) * circumference;
  const gap = circumference - filled;

  const label =
    pct >= 80 ? "High Confidence" : pct >= 55 ? "Moderate" : "Low Confidence";
  const labelColor = pct >= 80 ? "#22c55e" : pct >= 55 ? "#f97316" : "#ef4444";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        marginBottom: "14px",
      }}
    >
      <svg width="112" height="68" viewBox="0 0 112 68">
        {/* track */}
        <path
          d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0 1 ${cx + radius},${cy}`}
          fill="none"
          stroke="rgba(148,163,184,0.12)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* filled arc */}
        <path
          d={`M ${cx - radius},${cy} A ${radius},${radius} 0 0 1 ${cx + radius},${cy}`}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${gap}`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)", filter: `drop-shadow(0 0 6px ${color}88)` }}
        />
        {/* centre value */}
        <text x={cx} y={cy - 4} textAnchor="middle" fill={color} fontSize="18" fontWeight="800">
          {pct}%
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#64748b" fontSize="9" letterSpacing="0.05em">
          AI CONFIDENCE
        </text>
      </svg>
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color: labelColor,
          letterSpacing: "0.04em",
          background: `${labelColor}18`,
          border: `1px solid ${labelColor}40`,
          borderRadius: "999px",
          padding: "2px 10px",
          marginTop: "-2px",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Similar Cases Chip ───────────────────────────────────────────────────────

function SimilarCasesChip({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          fontSize: "11px",
          padding: "2px 8px",
          borderRadius: "999px",
          background: "rgba(148,163,184,0.1)",
          color: "#94a3b8",
          border: "1px solid rgba(148,163,184,0.2)",
          fontWeight: 600,
        }}
      >
        No similar cases found
      </span>
    );
  }
  const urgency = count >= 5 ? "#ef4444" : count >= 3 ? "#f97316" : "#6366f1";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        padding: "2px 10px",
        borderRadius: "999px",
        background: `${urgency}18`,
        color: urgency,
        border: `1px solid ${urgency}40`,
        fontWeight: 700,
      }}
    >
      ⚠ {count} similar case{count !== 1 ? "s" : ""}
    </span>
  );
}

// ─── Shimmer Row ──────────────────────────────────────────────────────────────

function ShimmerRow({ width = "100%", height = 14 }: { width?: string; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: "6px",
        background:
          "linear-gradient(90deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.14) 50%, rgba(99,102,241,0.06) 100%)",
        backgroundSize: "200% 100%",
        animation: "ai-shimmer 1.5s infinite",
        marginBottom: "8px",
      }}
    />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "rgba(99,102,241,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            animation: "brain-pulse 1.5s ease-in-out infinite",
            fontSize: "18px",
          }}
        >
          🧠
        </div>
        <div>
          <div style={{ fontSize: "13px", color: "#a5b4fc", fontWeight: 600 }}>
            Analysing complaint...
          </div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>
            Searching{" "}
            <span style={{ color: "#6366f1" }}>policy database</span> &{" "}
            <span style={{ color: "#8b5cf6" }}>past cases</span>
          </div>
        </div>
      </div>
      <ShimmerRow width="60%" height={10} />
      <ShimmerRow width="100%" height={70} />
      <ShimmerRow width="80%" height={10} />
      <ShimmerRow width="100%" height={55} />
      <ShimmerRow width="70%" height={10} />
      <ShimmerRow width="90%" height={30} />
    </div>
  );
}

// ─── Policy Block ─────────────────────────────────────────────────────────────

function PolicyBlock({ reference }: { reference: string }) {
  const [expanded, setExpanded] = useState(false);
  const [sectionRef, ...rest] = reference.split(":");
  const sectionText = rest.join(":").trim();

  return (
    <div
      style={{
        marginTop: "10px",
        background: "rgba(99,102,241,0.06)",
        border: "1px solid rgba(99,102,241,0.2)",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "10px 12px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#a5b4fc",
          fontSize: "12px",
          fontWeight: 700,
          letterSpacing: "0.04em",
        }}
      >
        <span>📋 {sectionRef.trim()}</span>
        <span style={{ fontSize: "10px", color: "#6366f1" }}>
          {expanded ? "▲ Collapse" : "▼ View Policy"}
        </span>
      </button>
      {expanded && (
        <div
          style={{
            padding: "0 12px 12px",
            fontSize: "12px",
            color: "#94a3b8",
            lineHeight: 1.6,
            fontStyle: "italic",
            borderTop: "1px solid rgba(99,102,241,0.1)",
            paddingTop: "10px",
          }}
        >
          &ldquo;{sectionText}&rdquo;
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AiInsightSidebar({ complaintId, isOpen, onClose, onApplySuggestedAction }: Props) {
  const [state, setState]       = useState<FetchState>("idle");
  const [data, setData]         = useState<AiInsightData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [actionApplied, setActionApplied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Draggable resize
  const [drawerWidth, setDrawerWidth] = useState(380);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(380);

  const fetchInsight = useCallback(async () => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setState("loading");
    setData(null);
    setErrorMsg("");
    setActionApplied(false);

    try {
      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId }),
        signal: abortRef.current.signal,
      });
      const json: AiInsightData = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Unknown error");
      setData(json);
      setState("success");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg((err as Error).message ?? "Failed to fetch AI insight.");
      setState("error");
    }
  }, [complaintId]);

  // Auto-fetch when drawer opens for the first time
  useEffect(() => {
    if (isOpen && state === "idle") fetchInsight();
    return () => abortRef.current?.abort();
  }, [isOpen, state, fetchInsight]);

  // ── Resize drag handlers ──
  const onMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    startX.current = e.clientX;
    startW.current = drawerWidth;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "ew-resize";
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX.current - e.clientX; // dragging left = wider
      const next = Math.min(520, Math.max(280, startW.current + delta));
      setDrawerWidth(next);
    };
    const onUp = () => {
      isDragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const priorityCfg = data?.priority ? PRIORITY_CONFIG[data.priority] : null;
  const confidenceColor =
    data && data.confidence >= 0.8
      ? "#22c55e"
      : data && data.confidence >= 0.55
      ? "#f97316"
      : "#ef4444";

  return (
    <>
      {/* ── CSS Keyframes ── */}
      <style>{`
        @keyframes ai-shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes brain-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.8; }
          50%       { transform: scale(1.18); opacity: 1;   }
        }
        @keyframes ai-glow-pulse {
          0%, 100% { box-shadow: 0 0 24px rgba(99,102,241,0.3), inset 0 0 0 1px rgba(99,102,241,0.12); }
          50%       { box-shadow: 0 0 40px rgba(99,102,241,0.5), inset 0 0 0 1px rgba(99,102,241,0.22); }
        }
        @keyframes ai-fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes ai-priority-pop {
          0%   { transform: scale(0.88); opacity: 0; }
          60%  { transform: scale(1.06);             }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes ai-slide-in {
          from { transform: translateX(100%); opacity: 0.6; }
          to   { transform: translateX(0);    opacity: 1;   }
        }
        @keyframes ai-slide-out {
          from { transform: translateX(0);    opacity: 1;   }
          to   { transform: translateX(100%); opacity: 0.6; }
        }
        .ai-cta-btn {
          flex: 1;
          padding: 9px 10px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          border: none;
          transition: transform 0.15s, opacity 0.15s, box-shadow 0.2s;
          letter-spacing: 0.03em;
        }
        .ai-cta-btn:hover:not(:disabled) { transform: translateY(-1px); opacity: 0.92; }
        .ai-cta-btn:active:not(:disabled) { transform: translateY(0); }
        .ai-cta-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .ai-resize-handle {
          position: absolute;
          left: 0;
          top: 0;
          width: 5px;
          height: 100%;
          cursor: ew-resize;
          z-index: 10;
          background: transparent;
          transition: background 0.2s;
        }
        .ai-resize-handle:hover {
          background: rgba(99,102,241,0.25);
        }
      `}</style>

      {/* ── Backdrop (mobile / overlay feel) ── */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.25)",
            backdropFilter: "blur(2px)",
            zIndex: 39,
            animation: "ai-fade-up 0.2s ease forwards",
          }}
        />
      )}

      {/* ── Drawer Panel ── */}
      <div
        id="ai-insight-drawer"
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: `${drawerWidth}px`,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(160deg, rgba(10,12,30,0.98) 0%, rgba(20,18,58,0.98) 100%)",
          borderLeft: "1px solid rgba(99,102,241,0.3)",
          boxShadow: "-8px 0 48px rgba(0,0,0,0.55), -2px 0 0 rgba(99,102,241,0.1)",
          animation: isOpen
            ? "ai-slide-in 0.3s cubic-bezier(0.22,1,0.36,1) forwards"
            : "ai-slide-out 0.25s cubic-bezier(0.4,0,0.2,1) forwards",
          // keep in DOM but off-screen when closed so animation works
          pointerEvents: isOpen ? "auto" : "none",
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1), opacity 0.3s",
          opacity: isOpen ? 1 : 0,
          willChange: "transform",
          overflowY: "auto",
          overflowX: "hidden",
        }}
        aria-hidden={!isOpen}
      >
        {/* Drag handle */}
        <div className="ai-resize-handle" onMouseDown={onMouseDown} title="Drag to resize" />

        {/* ── Header ── */}
        <div
          style={{
            background: "linear-gradient(135deg, #3730a3 0%, #6d28d9 50%, #5b21b6 100%)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                fontSize: "20px",
                animation: state === "loading" ? "brain-pulse 1.2s ease-in-out infinite" : "none",
                filter: "drop-shadow(0 0 6px rgba(255,255,255,0.5))",
              }}
            >
              🧠
            </div>
            <div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "0.02em",
                  lineHeight: 1.2,
                }}
              >
                AI Complaint Intelligence
              </div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.55)", letterSpacing: "0.07em" }}>
                POWERED BY RAG + GPT-4O
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {/* Refresh */}
            <button
              onClick={fetchInsight}
              disabled={state === "loading"}
              title="Re-run AI analysis"
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.22)",
                borderRadius: "8px",
                color: "#fff",
                fontSize: "11px",
                fontWeight: 600,
                padding: "4px 10px",
                cursor: state === "loading" ? "not-allowed" : "pointer",
                opacity: state === "loading" ? 0.5 : 1,
                transition: "all 0.2s",
              }}
            >
              {state === "loading" ? "⟳ Analysing..." : "↻ Refresh"}
            </button>
            {/* Close */}
            <button
              onClick={onClose}
              title="Close AI panel"
              aria-label="Close AI panel"
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "8px",
                color: "#e2e8f0",
                fontSize: "15px",
                lineHeight: 1,
                width: "28px",
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background 0.2s",
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(239,68,68,0.3)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "16px", flex: 1 }}>

          {/* Loading */}
          {state === "loading" && <LoadingSkeleton />}

          {/* Error */}
          {state === "error" && (
            <div
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: "10px",
                padding: "14px",
                animation: "ai-fade-up 0.3s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <span style={{ fontSize: "13px", color: "#fcd34d", fontWeight: 700 }}>
                  AI Insight Unavailable
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0, lineHeight: 1.5 }}>
                {errorMsg || "Unable to connect to AI service. Manual review required."}
              </p>
              <button
                onClick={fetchInsight}
                style={{
                  marginTop: "10px",
                  background: "rgba(245,158,11,0.15)",
                  border: "1px solid rgba(245,158,11,0.3)",
                  borderRadius: "6px",
                  color: "#fcd34d",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "5px 12px",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Success */}
          {state === "success" && data && (
            <div style={{ animation: "ai-fade-up 0.4s ease" }}>

              {/* Fallback banner */}
              {data.fallback && (
                <div
                  style={{
                    background: "rgba(100,116,139,0.1)",
                    border: "1px solid rgba(100,116,139,0.25)",
                    borderRadius: "8px",
                    padding: "8px 12px",
                    marginBottom: "14px",
                    fontSize: "11px",
                    color: "#94a3b8",
                  }}
                >
                  ℹ️ Limited data available — showing fallback analysis.
                </div>
              )}

              {/* Priority Badge */}
              {priorityCfg && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: priorityCfg.bg,
                    border: `1px solid ${priorityCfg.border}`,
                    borderRadius: "12px",
                    padding: "12px 14px",
                    marginBottom: "14px",
                    animation: "ai-priority-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "10px",
                        color: priorityCfg.colour,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        marginBottom: "2px",
                      }}
                    >
                      Recommended Priority
                    </div>
                    <div
                      style={{
                        fontSize: "22px",
                        fontWeight: 900,
                        color: priorityCfg.colour,
                        letterSpacing: "0.06em",
                        textShadow: `0 0 20px ${priorityCfg.colour}60`,
                      }}
                    >
                      {priorityCfg.glyph} {priorityCfg.label}
                    </div>
                  </div>
                  <SimilarCasesChip count={data.similarCaseCount} />
                </div>
              )}

              {/* Arc Confidence Gauge */}
              <ArcGauge value={data.confidence} color={confidenceColor} />

              {/* Reason */}
              <div style={{ marginBottom: "14px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#6366f1",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  📊 Analysis Reason
                </div>
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "#cbd5e1",
                    lineHeight: 1.65,
                    margin: 0,
                    background: "rgba(99,102,241,0.05)",
                    border: "1px solid rgba(99,102,241,0.1)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  {data.reason}
                </p>
              </div>

              {/* Suggested Action */}
              <div style={{ marginBottom: "14px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#7c3aed",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  ⚡ Suggested Action
                </div>
                <p
                  style={{
                    fontSize: "12.5px",
                    color: "#e2e8f0",
                    lineHeight: 1.65,
                    margin: 0,
                    fontWeight: 500,
                    background: "rgba(124,58,237,0.07)",
                    border: "1px solid rgba(124,58,237,0.18)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  {data.suggestedAction}
                </p>
              </div>

              {/* ── One-click CTA Row ── */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginBottom: "16px",
                }}
              >
                <button
                  className="ai-cta-btn"
                  disabled={actionApplied}
                  onClick={() => {
                    if (onApplySuggestedAction) onApplySuggestedAction(data.suggestedAction);
                    setActionApplied(true);
                  }}
                  style={{
                    background: actionApplied
                      ? "rgba(34,197,94,0.15)"
                      : "linear-gradient(135deg, #6d28d9 0%, #4f46e5 100%)",
                    color: actionApplied ? "#22c55e" : "#fff",
                    border: actionApplied ? "1px solid rgba(34,197,94,0.3)" : "none",
                    boxShadow: actionApplied ? "none" : "0 4px 16px rgba(79,70,229,0.4)",
                  }}
                >
                  {actionApplied ? "✓ Action Logged" : "⚡ Apply Action"}
                </button>
                <button
                  className="ai-cta-btn"
                  onClick={fetchInsight}
                  style={{
                    background: "rgba(99,102,241,0.1)",
                    color: "#a5b4fc",
                    border: "1px solid rgba(99,102,241,0.25)",
                  }}
                >
                  ↻ Re-analyse
                </button>
              </div>

              {/* Policy Reference */}
              {data.policyReference ? (
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#a5b4fc",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      marginBottom: "4px",
                    }}
                  >
                    📋 Policy Grounding
                  </div>
                  <PolicyBlock reference={data.policyReference} />
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#475569",
                    fontStyle: "italic",
                    padding: "8px 10px",
                    background: "rgba(71,85,105,0.08)",
                    borderRadius: "8px",
                    border: "1px solid rgba(71,85,105,0.15)",
                  }}
                >
                  No specific policy section retrieved — standard SOP applies.
                </div>
              )}

              {/* Footer */}
              <div
                style={{
                  marginTop: "16px",
                  paddingTop: "10px",
                  borderTop: "1px solid rgba(99,102,241,0.1)",
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "10px",
                  color: "#475569",
                }}
              >
                <span>
                  Generated{" "}
                  {new Date(data.generatedAt).toLocaleTimeString("en-MY", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>{data.latencyMs > 0 ? `${(data.latencyMs / 1000).toFixed(1)}s` : "cached"}</span>
              </div>
            </div>
          )}

          {/* Idle State (before first open) */}
          {state === "idle" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "120px",
                color: "#64748b",
                fontSize: "13px",
                textAlign: "center",
                gap: "8px",
              }}
            >
              <span style={{ fontSize: "28px" }}>🧠</span>
              <span>Click Refresh to start analysis</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

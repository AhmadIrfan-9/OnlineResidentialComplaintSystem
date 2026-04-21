"use client";

/**
 * src/components/warden/AiInsightSidebar.tsx
 *
 * Premium "AI Insight" panel that fetches RAG-generated analysis for a complaint
 * and displays it in a glassmorphism sidebar with animated loading states.
 *
 * Features:
 * - Animated brain icon with pulsing glow during fetch
 * - Priority badge (EMERGENCY/URGENT/ROUTINE) with semantic colours
 * - Confidence meter with animated fill
 * - Collapsible policy reference with exact citation
 * - Similar case count chip
 * - Graceful error + fallback states (never crashes)
 * - "Refresh Insight" button to re-run the pipeline
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

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
}

// ─── Priority Config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  EMERGENCY: {
    label: "EMERGENCY",
    colour: "#ef4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.35)",
    glyph: "🔴",
    pulse: "#ef4444",
  },
  URGENT: {
    label: "URGENT",
    colour: "#f97316",
    bg: "rgba(249,115,22,0.12)",
    border: "rgba(249,115,22,0.35)",
    glyph: "🟠",
    pulse: "#f97316",
  },
  ROUTINE: {
    label: "ROUTINE",
    colour: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
    border: "rgba(34,197,94,0.35)",
    glyph: "🟢",
    pulse: "#22c55e",
  },
} as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "#22c55e" : pct >= 55 ? "#f97316" : "#ef4444";

  return (
    <div style={{ marginBottom: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "4px",
        }}
      >
        <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          AI Confidence
        </span>
        <span style={{ fontSize: "13px", fontWeight: 700, color }}>
          {pct}%
        </span>
      </div>
      <div
        style={{
          height: "5px",
          background: "rgba(148,163,184,0.15)",
          borderRadius: "999px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}99, ${color})`,
            borderRadius: "999px",
            transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
            boxShadow: `0 0 8px ${color}80`,
          }}
        />
      </div>
    </div>
  );
}

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
      ⚠ {count} similar report{count !== 1 ? "s" : ""} found
    </span>
  );
}

function ShimmerRow({ width = "100%", height = 14 }: { width?: string; height?: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: "6px",
        background: "linear-gradient(90deg, rgba(99,102,241,0.06) 0%, rgba(139,92,246,0.12) 50%, rgba(99,102,241,0.06) 100%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.5s infinite",
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
          }}
        >
          🧠
        </div>
        <div>
          <div style={{ fontSize: "13px", color: "#a5b4fc", fontWeight: 600 }}>
            Analysing complaint...
          </div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>
            Searching 
            <span style={{ color: "#6366f1" }}> policy database</span> & 
            <span style={{ color: "#8b5cf6" }}> past cases</span>
          </div>
        </div>
      </div>
      <ShimmerRow width="60%" height={10} />
      <ShimmerRow width="100%" height={40} />
      <ShimmerRow width="80%" height={10} />
      <ShimmerRow width="100%" height={55} />
      <ShimmerRow width="70%" height={10} />
      <ShimmerRow width="90%" height={30} />
    </div>
  );
}

function PolicyBlock({ reference }: { reference: string }) {
  const [expanded, setExpanded] = useState(false);
  const [sectionRef, ...rest] = reference.split(":");
  const sectionText = rest.join(":").trim();

  return (
    <div
      style={{
        marginTop: "12px",
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

export function AiInsightSidebar({ complaintId }: Props) {
  const [state, setState]   = useState<FetchState>("idle");
  const [data, setData]     = useState<AiInsightData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const fetchInsight = useCallback(async () => {
    // Cancel in-flight request if any
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setState("loading");
    setData(null);
    setErrorMsg("");

    try {
      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId }),
        signal: abortRef.current.signal,
      });

      const json: AiInsightData = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Unknown error");
      }

      setData(json);
      setState("success");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setErrorMsg((err as Error).message ?? "Failed to fetch AI insight.");
      setState("error");
    }
  }, [complaintId]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchInsight();
    return () => abortRef.current?.abort();
  }, [fetchInsight]);

  const priorityCfg = data?.priority ? PRIORITY_CONFIG[data.priority] : null;

  return (
    <>
      {/* ── Injected global keyframe animations ── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes brain-pulse {
          0%, 100% { transform: scale(1);    opacity: 0.8; }
          50%       { transform: scale(1.18); opacity: 1;   }
        }
        @keyframes glow-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(99,102,241,0.3), 0 0 40px rgba(139,92,246,0.15); }
          50%       { box-shadow: 0 0 30px rgba(99,102,241,0.5), 0 0 60px rgba(139,92,246,0.25); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes priority-pop {
          0%   { transform: scale(0.88); opacity: 0; }
          60%  { transform: scale(1.06);             }
          100% { transform: scale(1);    opacity: 1; }
        }
      `}</style>

      <div
        style={{
          background: "linear-gradient(145deg, rgba(15,23,42,0.95) 0%, rgba(30,27,75,0.95) 100%)",
          border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: "16px",
          padding: "0",
          overflow: "hidden",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(99,102,241,0.1) inset",
          animation: "glow-pulse 4s ease-in-out infinite",
          position: "relative",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #6d28d9 100%)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)", letterSpacing: "0.06em" }}>
                POWERED BY RAG + GPT-4O
              </div>
            </div>
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchInsight}
            disabled={state === "loading"}
            title="Refresh insight"
            style={{
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "8px",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 600,
              padding: "4px 10px",
              cursor: state === "loading" ? "not-allowed" : "pointer",
              opacity: state === "loading" ? 0.5 : 1,
              transition: "all 0.2s",
              letterSpacing: "0.04em",
            }}
          >
            {state === "loading" ? "⟳ Analysing..." : "↻ Refresh"}
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div style={{ padding: "16px" }}>

          {/* Loading state */}
          {state === "loading" && <LoadingSkeleton />}

          {/* Error state */}
          {state === "error" && (
            <div
              style={{
                background: "rgba(245,158,11,0.08)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: "10px",
                padding: "14px",
                animation: "fade-up 0.3s ease",
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

          {/* Success state */}
          {state === "success" && data && (
            <div style={{ animation: "fade-up 0.4s ease" }}>

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
                    animation: "priority-pop 0.5s cubic-bezier(0.34,1.56,0.64,1)",
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

              {/* Confidence meter */}
              <ConfidenceMeter value={data.confidence} />

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
                    fontSize: "13px",
                    color: "#cbd5e1",
                    lineHeight: 1.6,
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
                    fontSize: "13px",
                    color: "#e2e8f0",
                    lineHeight: 1.6,
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
                  marginTop: "14px",
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
        </div>
      </div>
    </>
  );
}

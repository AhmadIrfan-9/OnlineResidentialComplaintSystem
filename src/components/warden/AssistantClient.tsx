"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Upload,
  FileText,
  Send,
  Trash2,
  ChevronRight,
  Database,
  Search,
  Sparkles,
  MessageSquare,
  FolderOpen,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Info,
  Activity,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type MessageSource = { docTitle: string; docFilename: string; similarity: number };

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: MessageSource[];
  usedLiveData?: boolean;
  loading?: boolean;
};

type VaultDoc = {
  id: string;
  title: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  status: "PROCESSING" | "READY" | "ERROR";
  errorMessage?: string | null;
  chunkCount: number;
  pageCount?: number | null;
  createdAt: string;
};

// ─── Pipeline steps for "How It Works" ───────────────────────────────────────

const PIPELINE_STEPS = [
  { icon: Upload,   label: "Upload",        desc: "PDF / DOCX / TXT",   color: "text-blue-600",    bg: "bg-blue-50",    border: "border-blue-200"    },
  { icon: FileText, label: "Chunk & Embed", desc: "Split into segments", color: "text-violet-600",  bg: "bg-violet-50",  border: "border-violet-200"  },
  { icon: Database, label: "Vector Store",  desc: "Store embeddings",    color: "text-amber-600",   bg: "bg-amber-50",   border: "border-amber-200"   },
  { icon: Search,   label: "Retrieve",      desc: "Semantic search",     color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
  { icon: Sparkles, label: "AI Response",   desc: "Grounded answer",     color: "text-red-600",     bg: "bg-red-50",     border: "border-red-200"     },
];

const SUGGESTIONS = [
  "Summarize the hostel regulations",
  "What is the complaint escalation policy?",
  "How many complaints were resolved yesterday?",
  "What are the emergency procedures?",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocStatusIcon({ status }: { status: VaultDoc["status"] }) {
  if (status === "READY")
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />;
  if (status === "PROCESSING")
    return <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin flex-shrink-0" />;
  return <AlertCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />;
}

function ChatBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isUser
            ? "bg-[#dc2626] text-white"
            : "bg-gradient-to-br from-[#1e3a8a] to-[#2563eb] text-white"
        }`}
      >
        {isUser ? "You" : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[#dc2626] text-white rounded-tr-sm"
            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
        }`}
      >
        {msg.loading ? (
          <span className="flex items-center gap-2 text-slate-400 italic">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </span>
        ) : (
          <>
            <p className="whitespace-pre-wrap">{msg.text}</p>

            {/* Live data badge */}
            {msg.usedLiveData && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                <Activity className="h-2.5 w-2.5" /> Live database
              </span>
            )}

            {/* Sources */}
            {msg.sources && msg.sources.length > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200">
                <p className="text-[11px] font-semibold text-slate-400 mb-1">Sources</p>
                <div className="flex flex-wrap gap-1">
                  {msg.sources.map((src) => (
                    <span
                      key={src.docFilename}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-medium text-blue-700"
                      title={`${src.docFilename} — ${(src.similarity * 100).toFixed(0)}% match`}
                    >
                      <FileText className="h-2.5 w-2.5" /> {src.docTitle}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AssistantClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [docs, setDocs] = useState<VaultDoc[]>([]);
  const [input, setInput] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [activePanel, setActivePanel] = useState<"chat" | "docs">("chat");
  const [showInfo, setShowInfo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load documents on mount ───────────────────────────────────────────────
  const loadDocs = useCallback(async () => {
    try {
      const res = await fetch("/api/rag/documents", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setDocs(data.documents ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // ── Poll PROCESSING docs until they become READY / ERROR ─────────────────
  useEffect(() => {
    const hasProcessing = docs.some((d) => d.status === "PROCESSING");

    if (hasProcessing && !pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        const processing = docs.filter((d) => d.status === "PROCESSING");
        const updated = await Promise.all(
          processing.map((d) =>
            fetch(`/api/rag/documents/${d.id}`)
              .then((r) => r.json())
              .catch(() => null)
          )
        );
        setDocs((prev) =>
          prev.map((doc) => {
            const fresh = updated.find((u) => u?.id === doc.id);
            return fresh ? { ...doc, ...fresh } : doc;
          })
        );
      }, 3000);
    }

    if (!hasProcessing && pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [docs]);

  // ── Upload handler ────────────────────────────────────────────────────────
  const handleFilePick = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setActivePanel("docs");

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name.replace(/\.[^.]+$/, ""));

      try {
        const res = await fetch("/api/rag/documents", { method: "POST", body: form });
        const data = await res.json();
        if (res.ok) {
          setDocs((prev) => [data, ...prev]);
        } else {
          alert(`Upload failed: ${data.error ?? "Unknown error"}`);
        }
      } catch {
        alert("Upload failed — network error");
      }
    }

    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleRemoveDoc = async (id: string) => {
    setDocs((prev) => prev.filter((d) => d.id !== id));
    try {
      await fetch(`/api/rag/documents/${id}`, { method: "DELETE" });
    } catch {}
  };

  // ── Send chat message ─────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || chatLoading) return;

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", text };
    const loadingMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInput("");
    setChatLoading(true);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    try {
      const res = await fetch("/api/rag/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();

      const assistantMsg: Message = {
        id: loadingMsg.id,
        role: "assistant",
        text: data.answer ?? "No response received.",
        sources: data.sources ?? [],
        usedLiveData: data.usedLiveData ?? false,
        loading: false,
      };

      setMessages((prev) =>
        prev.map((m) => (m.id === loadingMsg.id ? assistantMsg : m))
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingMsg.id
            ? { ...m, text: "Network error — please try again.", loading: false }
            : m
        )
      );
    } finally {
      setChatLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const readyCount = docs.filter((d) => d.status === "READY").length;

  return (
    <div className="flex flex-col gap-6 pb-10">

      {/* ── Hero Banner ──────────────────────────────────────────────────── */}
      <div className="surface-hero px-6 py-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-blue-200 mb-1">
            Management Portal · AI Tools
          </p>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Bot className="h-6 w-6 text-blue-200" /> AI Assistant
          </h1>
          <p className="text-sm text-blue-200 mt-0.5">
            Upload hostel documents and ask questions — powered by RAG
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowInfo(true)}
          className="flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-semibold text-white transition-colors"
        >
          <Info className="h-4 w-4" /> How it works
        </button>
      </div>

      {/* ── How It Works Dialog ──────────────────────────────────────────── */}
      <Dialog open={showInfo} onOpenChange={setShowInfo}>
        <DialogContent className="w-[960px] max-w-[95vw] sm:max-w-[90vw] p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
          <div className="surface-hero px-7 py-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-white leading-tight flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-200" /> How It Works
              </DialogTitle>
              <DialogDescription className="text-sm text-blue-200 mt-1">
                Retrieval-Augmented Generation (RAG)
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="bg-slate-50 px-7 py-6 space-y-5">
            <p className="text-sm text-slate-600 leading-relaxed">
              The assistant only answers based on documents you provide — no hallucination from external knowledge.
              Each question triggers a semantic search across your uploaded files before a response is generated.
            </p>
            <div className="grid gap-2" style={{ gridTemplateColumns: "1fr auto 1fr auto 1fr auto 1fr auto 1fr" }}>
              {PIPELINE_STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <>
                    <div key={step.label} className={`flex flex-col items-center gap-2 rounded-xl border ${step.border} ${step.bg} px-3 py-4`}>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white shadow-sm flex-shrink-0">
                        <Icon className={`h-4 w-4 ${step.color}`} />
                      </div>
                      <p className={`text-xs font-bold whitespace-nowrap ${step.color}`}>{step.label}</p>
                      <p className="text-[10px] text-slate-500 text-center leading-snug whitespace-nowrap">{step.desc}</p>
                    </div>
                    {idx < PIPELINE_STEPS.length - 1 && (
                      <div key={`arrow-${idx}`} className="flex items-center justify-center">
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    )}
                  </>
                );
              })}
            </div>
            <div className="border-t border-slate-200 pt-4 flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Answers are grounded in your documents + live complaint database — not external internet knowledge.
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Mobile Tab Toggle ─────────────────────────────────────────────── */}
      <div className="flex lg:hidden gap-1 p-1 bg-slate-100 rounded-xl">
        <button
          type="button"
          onClick={() => setActivePanel("chat")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activePanel === "chat" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Chat
        </button>
        <button
          type="button"
          onClick={() => setActivePanel("docs")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activePanel === "docs" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Database className="h-4 w-4" /> Knowledge Base
          {docs.length > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
              {docs.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Knowledge Base */}
        <div className={`lg:col-span-1 ${activePanel === "docs" ? "block" : "hidden lg:block"}`}>
          <div className="surface-card flex flex-col h-[600px] overflow-hidden">

            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-bold text-slate-900">Knowledge Base</h2>
              </div>
              <div className="flex items-center gap-2">
                {docs.length > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-black text-white">
                    {docs.length}
                  </span>
                )}
                <button
                  type="button"
                  onClick={loadDocs}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Upload area */}
            <div className="p-4 border-b border-slate-100">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFilePick(e.dataTransfer.files); }}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:border-blue-400 hover:bg-blue-50/50"
                }`}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="h-7 w-7 text-blue-500 animate-spin" />
                ) : (
                  <Upload className={`h-7 w-7 ${isDragging ? "text-blue-500" : "text-slate-400"}`} />
                )}
                <div>
                  <p className="text-sm font-semibold text-slate-700">
                    {uploading ? "Uploading…" : isDragging ? "Drop files here" : "Upload documents"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">PDF, DOCX, TXT, PNG, JPEG · max 20 MB</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => handleFilePick(e.target.files)}
                  disabled={uploading}
                />
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="btn-primary mt-3 w-full flex items-center justify-center gap-2 py-2 text-sm disabled:opacity-50"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading…" : "Choose Files"}
              </button>
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto">
              {docs.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <FolderOpen className="h-6 w-6 text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-600">No documents yet</p>
                  <p className="text-xs text-slate-400 max-w-[180px]">
                    Upload hostel rulebooks, SOPs, or policy documents to get started.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-50 px-2 py-2">
                  {docs.map((doc) => (
                    <li
                      key={doc.id}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <FileText className="h-4 w-4 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-800">{doc.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <DocStatusIcon status={doc.status} />
                          <span className="text-[10px] text-slate-400">
                            {doc.status === "PROCESSING"
                              ? "Embedding…"
                              : doc.status === "READY"
                              ? `${doc.chunkCount} chunks · ${formatBytes(doc.fileSize)}`
                              : `Error: ${doc.errorMessage ?? "Failed"}`}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(doc.id)}
                        disabled={doc.status === "PROCESSING"}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all disabled:pointer-events-none"
                        aria-label="Remove document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {docs.length > 0 && (
              <div className="border-t border-slate-100 px-4 py-2.5 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {readyCount} of {docs.length} ready
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Chat Interface */}
        <div className={`lg:col-span-2 ${activePanel === "chat" ? "block" : "hidden lg:block"}`}>
          <div className="surface-card flex flex-col h-[600px] overflow-hidden">

            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-gradient-to-r from-[#1e3a8a]/5 to-[#2563eb]/5">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#1e3a8a] to-[#2563eb]">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">ORCS Assistant</p>
                  <div className="flex items-center gap-1">
                    <span className={`h-1.5 w-1.5 rounded-full ${readyCount > 0 ? "bg-emerald-400" : "bg-slate-300"}`} />
                    <span className="text-[10px] text-slate-400">
                      {readyCount > 0
                        ? `${readyCount} doc${readyCount > 1 ? "s" : ""} in vault · live DB enabled`
                        : "No documents — live DB only"}
                    </span>
                  </div>
                </div>
              </div>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  Clear chat
                </button>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1e3a8a]/10 to-[#2563eb]/10">
                    <Bot className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-slate-800">Ask me anything</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-[300px]">
                      Ask policy questions from uploaded documents or query live complaint statistics.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 max-w-sm">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setInput(s)}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors shadow-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-medium text-blue-700">
                    <Activity className="h-4 w-4 flex-shrink-0" />
                    Live database always available — upload docs for policy questions
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatBubble key={msg.id} msg={msg} />
                  ))}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 p-3">
              <div className="flex gap-2 items-end">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={chatLoading}
                  placeholder="Ask about hostel policy or complaint statistics…"
                  className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-colors max-h-32 disabled:opacity-50"
                  style={{ minHeight: "46px" }}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || chatLoading}
                  className="flex h-[46px] w-[46px] flex-shrink-0 items-center justify-center rounded-xl bg-[#dc2626] text-white shadow-sm transition-all hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                >
                  {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-center text-[10px] text-slate-400">
                <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px]">Enter</kbd> to send ·{" "}
                <kbd className="rounded bg-slate-100 px-1 font-mono text-[10px]">Shift+Enter</kbd> for new line
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AnalysisResult, RedFlag } from "@/types";
import { analyzePolicy } from "@/lib/api";
import { classifyFlag } from "@/lib/flagCatalog";
import type { FlagAction, FlagProfile } from "@/lib/flagCatalog";
import { readDealbreakers, writeDealbreakers } from "@/lib/dealbreakers";
import { SAMPLE_AUDIT, SAMPLE_TEXT } from "@/lib/sample";

import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import MainPanel from "@/components/MainPanel";
import ActionCenter from "@/components/ActionCenter";
import DiffTracker from "@/components/DiffTracker";
import AuditHistory from "@/components/AuditHistory";
import SettingsPanel from "@/components/SettingsPanel";

export default function Home() {
  const [view, setView] = useState("analyzer");
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [editorText, setEditorText] = useState(SAMPLE_TEXT);
  const [result, setResult] = useState<AnalysisResult>(SAMPLE_AUDIT);
  const [analyzing, setAnalyzing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runCount, setRunCount] = useState(0);

  const [dealbreakers, setDealbreakers] = useState<string[]>(() => readDealbreakers());
  const [flaggedKeys, setFlaggedKeys] = useState<Set<string>>(new Set());

  const [prefill, setPrefill] = useState<{ key: number; company: string; items: string[] }>({
    key: 0,
    company: "",
    items: [],
  });

  useEffect(() => writeDealbreakers(dealbreakers), [dealbreakers]);

  const handleRun = useCallback(async () => {
    if (analyzing || !editorText.trim()) return;
    setAnalyzing(true);
    setError(null);
    const started = performance.now();
    try {
      const data = await analyzePolicy({ text: editorText });
      setResult(data);
      setElapsedMs(Math.round(performance.now() - started));
      setRunCount((c) => c + 1);
      setPrefill((p) => ({
        ...p,
        company: data.platform_name,
        items: data.red_flags.slice(0, 4).map((f) => classifyFlag(f, 0).title),
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? `Backend unavailable at localhost:8000 — ${err.message}. Showing sample audit while offline.`
          : "Analysis failed.",
      );
    } finally {
      setAnalyzing(false);
    }
  }, [analyzing, editorText]);

  const handleFlagAction = useCallback(
    (action: FlagAction, flag: RedFlag, profile: FlagProfile) => {
      switch (action) {
        case "export": {
          const blob = new Blob([JSON.stringify({ flag, profile }, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `evidence-${profile.code}.json`;
          a.click();
          URL.revokeObjectURL(url);
          break;
        }
        case "optout":
          setPrefill((p) => ({
            key: p.key + 1,
            company: result.platform_name,
            items: [profile.title, flag.clause.slice(0, 90)],
          }));
          setView("action-center");
          break;
        case "baseline":
        case "watcher":
          setView("diff-tracker");
          break;
        case "counsel":
          setFlaggedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(profile.code)) next.delete(profile.code);
            else next.add(profile.code);
            return next;
          });
          break;
      }
    },
    [result.platform_name],
  );

  const handleExport = useCallback(() => {
    const payload = {
      app: "Privacy Lens v2.4 Enterprise",
      exported_at: new Date().toISOString(),
      result,
      rules: dealbreakers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `privacy-lens-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, dealbreakers]);

  const handleNewAudit = useCallback(() => {
    setView("analyzer");
    setEditorText("");
    setError(null);
    setElapsedMs(null);
  }, []);

  const actionBadge = useMemo(
    () => Math.max(result.data_shared_or_sold.length + result.red_flags.length, 4),
    [result],
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--canvas)]">
      <Sidebar
        activeView={view}
        onNavigate={setView}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        actionBadge={actionBadge}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          exportTarget={handleExport}
          onNewAudit={handleNewAudit}
        />

        <main className="flex-1 overflow-y-auto">
          {view === "analyzer" && (
            <MainPanel
              value={editorText}
              onValueChange={setEditorText}
              result={result}
              analyzing={analyzing}
              elapsedMs={elapsedMs}
              error={error}
              onRun={handleRun}
              searchQuery={searchQuery}
              flaggedKeys={flaggedKeys}
              onFlagAction={handleFlagAction}
            />
          )}
          {view === "action-center" && (
            <ActionCenter
              prefillCompany={prefill.company}
              prefillItems={prefill.items}
              prefillKey={prefill.key}
            />
          )}
          {view === "diff-tracker" && (
            <DiffTracker
              seededBase={{
                id: runCount + 900,
                text: editorText,
                url: result.source,
              }}
            />
          )}
          {view === "audit-history" && (
            <AuditHistory
              liveEvent={
                runCount > 0
                  ? {
                      id: `RUN-${runCount}`,
                      ts: new Date().toISOString(),
                      target: result.platform_name,
                      score: result.trust_score,
                      flags: result.red_flags.length,
                      engine: result.model_used,
                    }
                  : null
              }
              liveId={runCount}
            />
          )}
          {view === "settings" && (
            <SettingsPanel dealbreakers={dealbreakers} onChange={setDealbreakers} />
          )}
        </main>
      </div>
    </div>
  );
}
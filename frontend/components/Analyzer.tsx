"use client";

import { useCallback, useState } from "react";

import DataSections from "@/components/DataSections";
import RedFlags from "@/components/RedFlags";
import TrustScoreGauge from "@/components/TrustScoreGauge";
import { analyzePolicy } from "@/lib/api";
import type { AnalysisResult, AnalysisStage } from "@/types";

type InputMode = "text" | "url";

export default function Analyzer() {
  const [mode, setMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<AnalysisStage>("idle");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = mode === "text" ? text.trim().length > 0 : url.trim().length > 0;
  const isBusy = stage === "analyzing";

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || isBusy) return;

    setError(null);
    setResult(null);
    setStage("analyzing");

    try {
      const payload = mode === "text" ? { text: text.trim() } : { url: url.trim() };
      const data = await analyzePolicy(payload);
      setResult(data);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setStage("error");
    }
  }, [canSubmit, isBusy, mode, text, url]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium">
          {(["text", "url"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 rounded-md px-3 py-2 transition ${
                mode === m ? "bg-white text-indigo-600 shadow" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {m === "text" ? "Paste Policy Text" : "Analyze a URL"}
            </button>
          ))}
        </div>

        {mode === "text" ? (
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Paste the privacy policy or Terms of Service text here…"
            rows={10}
            className="mt-4 w-full resize-y rounded-lg border border-slate-300 p-3 font-mono text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        ) : (
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            type="url"
            placeholder="https://example.com/privacy-policy"
            className="mt-4 w-full rounded-lg border border-slate-300 p-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit || isBusy}
          className="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {isBusy ? "Analyzing…" : "Analyze Policy"}
        </button>

        {error && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </div>

      {stage === "done" && result && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
            <div className="flex justify-center rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <TrustScoreGauge score={result.trust_score} />
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">{result.platform_name}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {result.model_used}
                {result.source ? ` · ${result.source}` : ""} ·{" "}
                {new Date(result.analyzed_at).toLocaleString()}
              </p>
              <p className="mt-4 leading-relaxed text-slate-700">{result.summary}</p>
            </div>
          </div>
          <RedFlags flags={result.red_flags} />
          <DataSections
            dataCollected={result.data_collected}
            dataShared={result.data_shared_or_sold}
            rightsForfeited={result.rights_forfeited}
          />
        </div>
      )}
    </div>
  );
}
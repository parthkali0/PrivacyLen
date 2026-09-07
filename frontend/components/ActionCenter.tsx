"use client";

import { useCallback, useEffect, useState } from "react";

import { generateOptOut } from "@/lib/api";
import type { OptOutResult } from "@/types";

export default function ActionCenter({
  prefillCompany = "",
  prefillItems = [],
  prefillKey = 0,
}: {
  prefillCompany?: string;
  prefillItems?: string[];
  prefillKey?: number;
}) {
  const [companyName, setCompanyName] = useState("");
  const [flaggedItems, setFlaggedItems] = useState("");
  const [stage, setStage] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [result, setResult] = useState<OptOutResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!prefillKey) return;
    if (prefillCompany) setCompanyName(prefillCompany);
    if (prefillItems.length) setFlaggedItems(prefillItems.join(", "));
  }, [prefillKey, prefillCompany, prefillItems]);

  const canSubmit = companyName.trim().length > 0 && stage !== "busy";

  const handleGenerate = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    setCopied(false);
    setResult(null);
    setStage("busy");

    const items = flaggedItems
      .split(/[\n,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);

    try {
      const data = await generateOptOut({
        company_name: companyName.trim(),
        flagged_items: items,
      });
      setResult(data);
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the opt-out email.");
      setStage("error");
    }
  }, [canSubmit, companyName, flaggedItems]);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${result.subject}\n\n${result.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Clipboard access was blocked — copy manually below.");
    }
  }, [result]);

  const handleMailto = useCallback(() => {
    if (!result) return;
    const subject = encodeURIComponent(result.subject);
    const body = encodeURIComponent(result.body);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }, [result]);

  return (
    <div className="mx-auto max-w-[960px] space-y-4 px-6 py-5">
      <nav className="mono flex items-center gap-2 text-[11px] text-[#64748b]">
        <span>Sentinel Audit Suite</span>
        <span className="text-[#334155]">/</span>
        <span>Action Center</span>
      </nav>

      <div className="flex items-center gap-2.5 border-b border-[var(--edge)] pb-4">
        <h1 className="text-[22px] font-bold tracking-tight text-slate-50">Action Center</h1>
        <span className="tag tag-green mono">CCPA / CPRA / GDPR</span>
      </div>
      <p className="text-[13px] text-[#94a3b8]">
        Generate a pre-formulated legal opt-out email against a flagged platform — copy it or
        launch directly in your email client.
      </p>

      <div className="panel p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="hud" htmlFor="optout-company">Company / platform</label>
            <input
              id="optout-company"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="e.g. Acquired Inc."
              className="input mt-1.5 w-full"
            />
          </div>
          <div>
            <label className="hud" htmlFor="optout-items">Flagged concerns</label>
            <textarea
              id="optout-items"
              value={flaggedItems}
              onChange={(event) => setFlaggedItems(event.target.value)}
              rows={1}
              placeholder="Biometric data sale, Location selling, Class-action waiver"
              className="input mt-1.5 min-h-[38px] w-full resize-y"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={!canSubmit}
          className="btn-cta mt-4 w-full justify-center"
        >
          {stage === "busy" ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          ) : (
            "Generate opt-out email"
          )}
        </button>

        {error && (
          <p className="mono mt-3 rounded-lg border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[12px] text-[#fca5a5]">
            ⚠ {error}
          </p>
        )}

        {stage === "done" && result && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void handleCopy()} className="btn-cta mono h-8 px-3 text-[11px]">
                {copied ? "✓ Copied!" : "Copy email"}
              </button>
              <button type="button" onClick={handleMailto} className="btn-ghost mono h-8 px-3 text-[11px]">
                Open in email client
              </button>
            </div>

            <div className="code-view px-4 py-3">
              <p className="hud text-[#94a3b8]">Subject</p>
              <p className="mt-1 font-medium text-slate-100">{result.subject}</p>
            </div>

            <div className="code-view px-4 py-3">
              <p className="hud text-[#94a3b8]">Body</p>
              <pre className="mt-2 max-h-96 overflow-auto mono whitespace-pre-wrap text-[12.5px] leading-relaxed text-[#c7d3e2]">
                {result.body}
              </pre>
            </div>

            <div>
              <p className="hud text-[#94a3b8]">Legal references</p>
              <ul className="mt-2 space-y-1">
                {result.references.map((ref) => (
                  <li key={ref} className="mono flex items-start gap-2 text-[12px] text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#10b981]" />
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
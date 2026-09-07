"use client";

interface NavItem {
  key: string;
  label: string;
  icon: (props: { size?: number }) => React.ReactNode;
  badge?: number;
}

const ICONS: Record<string, (props: { size?: number }) => React.ReactNode> = {
  analyzer: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M12 3v6l4 2-4 2v6" />
      <path d="m17 3 2 2-2 2 2 2-2 2" />
    </svg>
  ),
  actions: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  ),
  diff: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m16 18 6-6-6-6" />
      <path d="M8 6l-6 6 6 6" />
      <path d="m13 18 4-12" />
    </svg>
  ),
  audit: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 9h1" />
      <path d="M9 13h1" />
      <path d="M14 9h1" />
      <path d="M14 13h1" />
    </svg>
  ),
  settings: ({ size = 15 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

export default function Sidebar({
  activeView,
  onNavigate,
  collapsed,
  onToggleCollapse,
  actionBadge,
}: {
  activeView: string;
  onNavigate: (view: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  actionBadge: number;
}) {
  const items: NavItem[] = [
    { key: "analyzer", label: "Policy Analyzer", icon: ICONS.analyzer },
    { key: "action-center", label: "Action Center", icon: ICONS.actions, badge: actionBadge },
    { key: "diff-tracker", label: "Diff Tracker", icon: ICONS.diff },
    { key: "audit-history", label: "Audit History", icon: ICONS.audit },
    { key: "settings", label: "Settings & Rules", icon: ICONS.settings },
  ];

  return (
    <aside
      className={`flex h-full shrink-0 flex-col border-r border-[var(--edge)] bg-[#0d1420] transition-all duration-200 ${
        collapsed ? "w-[64px]" : "w-[236px]"
      }`}
    >
      {/* Brand */}
      <div className={`flex items-center gap-2.5 border-b border-[var(--edge)] px-4 py-3.5 ${collapsed ? "justify-center" : ""}`}>
        {!collapsed && (
          <>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M12 2 4 5v6c0 5.25 3.4 10.1 8 11 4.6-.9 8-5.75 8-11V5z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold tracking-tight text-slate-100">
                Privacy Lens
              </p>
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-[#38bdf8]">
                v2.4 Enterprise
              </p>
            </div>
          </>
        )}
        {collapsed && (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2 4 5v6c0 5.25 3.4 10.1 8 11 4.6-.9 8-5.75 8-11V5z" />
          </svg>
        )}
      </div>

      {/* Status strip */}
      {!collapsed && (
        <div className="flex items-center gap-2 border-b border-[var(--edge)] px-4 py-2">
          <span className="live-dot h-2 w-2 rounded-full bg-[#10b981]" />
          <span className="hud">Active</span>
          <span className="mono ml-auto text-[10px] text-[#94a3b8]">PL-8942-X</span>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {!collapsed && <p className="hud px-2 pb-1">Navigation Modules</p>}
        {items.map((item) => {
          const active = activeView === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavigate(item.key)}
              title={collapsed ? item.label : undefined}
              className={`nav-item ${active ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`}
            >
              {item.icon({})}
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && typeof item.badge === "number" && item.badge > 0 && (
                <span className="ml-auto rounded-full bg-[#ef4444] px-1.5 py-px text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Telemetry box */}
      {!collapsed && (
        <div className="border-t border-[var(--edge)] p-3">
          <div className="panel-inset h-40 bg-[#0b1220] p-3">
            <div className="flex items-center gap-1.5">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              <span className="hud text-[#10b981]">Local SLM Node • Optimal</span>
            </div>
            <div className="mono mt-3 space-y-1.5 text-[11px] text-[#94a3b8]">
              <p className="flex justify-between">
                <span>CPU Load</span>
                <span className="text-[#38bdf8]">2% · 12ms</span>
              </p>
              <p className="flex justify-between">
                <span>Memory</span>
                <span className="text-[#38bdf8]">218 MB</span>
              </p>
              <p className="flex justify-between">
                <span>Inference Core</span>
                <span className="text-[#10b981]">Ready</span>
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <div className="mono h-1 flex-1 overflow-hidden rounded-full bg-[#1e293b]">
                <div className="h-full w-[12%] rounded-full bg-[#10b981]" />
              </div>
              <span className="mono text-[10px] text-[#64748b]">12/100</span>
            </div>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={onToggleCollapse}
        className="flex h-9 shrink-0 items-center justify-center gap-1.5 border-t border-[var(--edge)] text-[#64748b] transition hover:bg-white/5 hover:text-slate-300"
      >
        {collapsed ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        )}
        {!collapsed && <span className="text-[11px] font-medium">Collapse</span>}
      </button>
    </aside>
  );
}
import { useState } from "react";
import { saveWorldIntent, saveWorldPolicy, ApiError } from "../lib/api";
import { useWorld, useWorldStatus, useReminders, useWorldKey } from "../lib/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Loader2, AlertCircle, Globe, Zap, Shield, GitBranch, Calendar,
  FileText, Cloud, Mail, Users, Bell, ChevronRight, Plus, X,
} from "../lib/icons";

const CAPABILITY_ICONS: Record<string, typeof GitBranch> = {
  source_control: GitBranch, calendar: Calendar, notes: FileText,
  weather: Cloud, mail: Mail, contacts: Users, notifications: Bell,
};

function WorldScreen() {
  const world = useWorld();
  const worldStatus = useWorldStatus();
  const reminders = useReminders();
  const bumpWorld = useWorldKey();
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [expandedCap, setExpandedCap] = useState<string | null>(null);

  if (world.isLoading || worldStatus.isLoading) {
    return <div className="flex flex-col items-center justify-center gap-4 p-8"><Loader2 className="h-8 w-8 loader-static text-[var(--pw-color-accent-primary)]" aria-hidden={true} /><p className="text-[var(--pw-color-text-muted)]">Loading your world…</p></div>;
  }

  if (world.isError || worldStatus.isError) {
    return <div className="flex flex-col items-center justify-center gap-4 p-8"><AlertCircle className="h-8 w-8 text-[var(--pw-color-text-primary)]" aria-hidden={true} /><p className="text-[var(--pw-color-text-muted)]">Could not load your world.</p></div>;
  }

  const capabilities = worldStatus.data?.capabilities || {};
  const capabilitiesList = Object.entries(capabilities);
  const healthyCount = capabilitiesList.filter(([, c]) => c.ok).length;
  const notConfiguredCount = capabilitiesList.filter(([, c]) => c.status === "not_configured").length;
  const intents = world.data?.intents || {};
  const policies = world.data?.policies || {};
  const activeReminders = (reminders.data || []).filter((r) => r.enabled);

  const refreshAll = () => {
    bumpWorld();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <section aria-labelledby="world-heading">
        <h1 id="world-heading" className="text-3xl font-bold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Your World</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-[var(--pw-color-text-muted)]">
          <span>{capabilitiesList.length} capabilities</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--pw-color-accent-secondary)]"></span>{healthyCount} healthy</span>
          {notConfiguredCount > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--pw-color-text-muted)]"></span>{notConfiguredCount} not configured</span>}
        </div>
      </section>

      {/* Summary Grid — Facts, Intents, Policies, Reminders */}
      <section aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="sr-only">Summary</h2>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Globe className="h-4 w-4 text-[var(--pw-color-accent-primary)]" aria-hidden={true} />Facts</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(worldStatus.data?.facts || {}).length === 0 ? (
                <p className="text-xs text-[var(--pw-color-text-muted)]">No facts yet.</p>
              ) : (
                <ul className="space-y-1" role="list">
                  {Object.entries(worldStatus.data?.facts || {}).slice(0, 4).map(([key, value]) => (
                    <li key={key} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--pw-color-text-muted)] truncate capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-[var(--pw-color-text-primary)] truncate ml-2">{String(value)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button className="mt-2 flex items-center gap-1 text-xs text-[var(--pw-color-accent-primary)] hover:underline"><Plus className="h-3 w-3" aria-hidden={true} />Add</button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-[var(--pw-color-accent-secondary)]" aria-hidden={true} />Intents</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(intents).length === 0 ? (
                <p className="text-xs text-[var(--pw-color-text-muted)]">No active intents.</p>
              ) : (
                <ul className="space-y-1" role="list">
                  {Object.entries(intents).map(([key, intent]) => (
                    <li key={key} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--pw-color-text-muted)] truncate capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-[var(--pw-color-text-primary)] truncate ml-2">{intent.value}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setShowIntentModal(true)} className="mt-2 flex items-center gap-1 text-xs text-[var(--pw-color-accent-primary)] hover:underline"><Plus className="h-3 w-3" aria-hidden={true} />Add</button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4 text-[var(--pw-color-text-secondary)]" aria-hidden={true} />Policies</CardTitle></CardHeader>
            <CardContent>
              {Object.keys(policies).length === 0 ? (
                <p className="text-xs text-[var(--pw-color-text-muted)]">No policies.</p>
              ) : (
                <ul className="space-y-1" role="list">
                  {Object.entries(policies).map(([key, policy]) => (
                    <li key={key} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--pw-color-text-muted)] truncate capitalize">{key.replace(/_/g, " ")}</span>
                      <span className="text-[var(--pw-color-text-primary)] truncate ml-2">{String(policy)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => setShowPolicyModal(true)} className="mt-2 flex items-center gap-1 text-xs text-[var(--pw-color-accent-primary)] hover:underline"><Plus className="h-3 w-3" aria-hidden={true} />Add</button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4 text-[var(--pw-color-accent-primary)]" aria-hidden={true} />Reminders</CardTitle></CardHeader>
            <CardContent>
              {activeReminders.length === 0 ? (
                <p className="text-xs text-[var(--pw-color-text-muted)]">No active reminders.</p>
              ) : (
                <ul className="space-y-1" role="list">
                  {activeReminders.slice(0, 4).map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--pw-color-text-muted)] truncate">{r.text}</span>
                      <Badge variant="healthy" className="shrink-0 ml-2">Active</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Capabilities */}
      <section aria-labelledby="capabilities-heading">
        <h2 id="capabilities-heading" className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--pw-color-text-muted)]">Capabilities</h2>
        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {capabilitiesList.map(([name, cap]) => {
            const Icon = CAPABILITY_ICONS[name] || Globe;
            const warnings = cap.warnings || [];
            const isExpanded = expandedCap === name;
            return (
              <Card key={name} className={isExpanded ? "ring-1 ring-[var(--pw-color-accent-primary)]" : ""}>
                <button onClick={() => setExpandedCap(isExpanded ? null : name)} className="w-full text-left">
                  <CardContent className="flex items-center gap-3 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--pw-color-surface-elevated)]">
                      <Icon className="h-4 w-4 text-[var(--pw-color-text-muted)]" aria-hidden={true} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-medium text-[var(--pw-color-text-primary)] truncate">{name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</h3>
                        <Badge variant={cap.status === "healthy" ? "healthy" : cap.status === "warning" ? "warning" : cap.status === "needs_attention" ? "attention" : "unknown"} className="shrink-0">{cap.status.replace(/_/g, " ")}</Badge>
                      </div>
                      {warnings.length > 0 && <p className="mt-0.5 text-[10px] text-[var(--pw-color-text-muted)] truncate">{warnings[0]}</p>}
                    </div>
                    <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-[var(--pw-color-text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`} aria-hidden={true} />
                  </CardContent>
                </button>
                {isExpanded && (
                  <CardContent className="border-t border-[var(--pw-color-border-subtle)] pt-3 pb-3">
                    <dl className="space-y-1.5 text-xs">
                      <div className="flex justify-between"><dt className="text-[var(--pw-color-text-muted)]">Status</dt><dd className="text-[var(--pw-color-text-primary)]">{cap.status.replace(/_/g, " ")}</dd></div>
                      <div className="flex justify-between"><dt className="text-[var(--pw-color-text-muted)]">Healthy</dt><dd className="text-[var(--pw-color-text-primary)]">{cap.ok ? "Yes" : "No"}</dd></div>
                      {cap.last_observed && <div className="flex justify-between"><dt className="text-[var(--pw-color-text-muted)]">Last seen</dt><dd className="text-[var(--pw-color-text-primary)]">{new Date(cap.last_observed).toLocaleString()}</dd></div>}
                      {warnings.length > 0 && <div><dt className="text-[var(--pw-color-text-muted)]">Warnings</dt><dd className="mt-0.5 text-[var(--pw-color-text-primary)]">{warnings.join(", ")}</dd></div>}
                    </dl>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </section>

      {/* Add Intent Modal */}
      {showIntentModal && <AddIntentModal onClose={() => setShowIntentModal(false)} onSaved={refreshAll} />}
      {/* Add Policy Modal */}
      {showPolicyModal && <AddPolicyModal onClose={() => setShowPolicyModal(false)} onSaved={refreshAll} />}
    </div>
  );
}

function AddIntentModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !value.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveWorldIntent(key.trim(), value.trim());
      setSuccess(true);
      setTimeout(() => { onSaved(); }, 1500);
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "Failed to save.");
    } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pw-color-surface-canvas)]/60 p-4">
      <Card className="w-full max-w-xl">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Add Intent</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)]" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3">
            <div><label className="mb-1 block text-xs text-[var(--pw-color-text-muted)]">Key</label><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. focus" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" /></div>
            <div><label className="mb-1 block text-xs text-[var(--pw-color-text-muted)]">Value</label><input value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Build frontend v2" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" /></div>
            {error && <p className="text-xs text-[var(--pw-color-text-primary)]">{error}</p>}
          </CardContent>
          <div className="flex justify-end gap-2 p-4 pt-0"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!key.trim() || !value.trim() || isSaving || success}>{isSaving ? <Loader2 className="h-4 w-4 loader-static" /> : success ? "✓ Saved" : "Save"}</Button></div>
        </form>
      </Card>
    </div>
  );
}

function AddPolicyModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [key, setKey] = useState("");
  const [effect, setEffect] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !effect.trim() || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveWorldPolicy(key.trim(), effect.trim());
      setSuccess(true);
      setTimeout(() => { onSaved(); }, 1500);
    } catch (e) {
      setError(e instanceof ApiError && e.detail ? e.detail : "Failed to save.");
    } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pw-color-surface-canvas)]/60 p-4">
      <Card className="w-full max-w-xl">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Add Policy</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)]" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-3">
            <div><label className="mb-1 block text-xs text-[var(--pw-color-text-muted)]">Key</label><input value={key} onChange={(e) => setKey(e.target.value)} placeholder="e.g. privacy" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" /></div>
            <div><label className="mb-1 block text-xs text-[var(--pw-color-text-muted)]">Effect</label><input value={effect} onChange={(e) => setEffect(e.target.value)} placeholder="e.g. minimum-necessary" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" /></div>
            {error && <p className="text-xs text-[var(--pw-color-text-primary)]">{error}</p>}
          </CardContent>
          <div className="flex justify-end gap-2 p-4 pt-0"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" disabled={!key.trim() || !effect.trim() || isSaving || success}>{isSaving ? <Loader2 className="h-4 w-4 loader-static" /> : success ? "✓ Saved" : "Save"}</Button></div>
        </form>
      </Card>
    </div>
  );
}

export default WorldScreen;

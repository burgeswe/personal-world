import { useState, useEffect } from "react";
import {
  fetchConnections,
  fetchPrincipal,
  fetchPrefs,
  savePrefs,
  savePrincipalDisplayName,
  saveConnection,
  validateConnection,
  ApiError,
} from "../lib/api";
import { useVaultStatus, useSourceControlStatus, useBackup } from "../lib/hooks";
import { useCompanion } from "../lib/companion-context";
import { usePrefs } from "../lib/prefs-context";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Settings, User, Globe, Palette, Monitor, Eye, Hand, Zap,
  Shield, Wrench, X, Key, Link, Loader2, Check, ChevronDown, Plus,
} from "../lib/icons";

interface Prefs {
  motion: string;
  contrast: string;
  text_scale: number;
  density: string;
  target_size: number;
  companion: string;
  accent: string;
}

interface Provider {
  id: string;
  name: string;
  status: string;
  type: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
  docs: string;
}

const DEFAULT_PROVIDERS: Provider[] = [
  { id: "nous", name: "Nous Portal", status: "connected", type: "cloud", fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "••••••••" }], docs: "portal.nousresearch.com" },
  { id: "opencode-go", name: "OpenCode Go", status: "configured", type: "cloud", fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "••••••••" }, { key: "base_url", label: "Base URL", type: "text", placeholder: "https://..." }], docs: "opencode.ai/auth" },
  { id: "xiaomi", name: "Xiaomi MiMo", status: "configured", type: "cloud", fields: [{ key: "api_key", label: "API Key", type: "password", placeholder: "••••••••" }, { key: "base_url", label: "Base URL", type: "text", placeholder: "https://..." }], docs: "platform.xiaomimimo.com" },
  { id: "ollama", name: "Ollama (Local)", status: "not configured", type: "local", fields: [{ key: "base_url", label: "Base URL", type: "text", placeholder: "http://localhost:11434" }], docs: "ollama.com" },
];

const COMPANIONS = [
  { id: "personal-world", name: "Personal World", icon: "/companions/personal-world.svg", desc: "Default system companion" },
  { id: "mermaid", name: "Mermaid", icon: "/companions/mermaid.svg", desc: "Personal companion (the operator theme)" },
  { id: "robot", name: "Little Helper Robot", icon: "/companions/robot.svg", desc: "Lab / development / AI helper" },
  { id: "squirrel", name: "World-tree Squirrel", icon: "/companions/world-tree-squirrel.svg", desc: "Worlds / lore / memory keeper" },
  { id: "tacos", name: "Tacos & the Morning Paper", icon: "/companions/taco-news-truck.svg", desc: "Journalism / stories / city life" },
];

function SettingsScreen() {
  const vaultStatus = useVaultStatus();
  const scStatus = useSourceControlStatus();
  const backup = useBackup();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [providers, setProviders] = useState<Provider[]>(DEFAULT_PROVIDERS);

  // Fetch saved connections on mount
  useEffect(() => {
    fetchConnections()
      .then((saved) => {
        if (saved.length > 0) {
          setProviders((prev) => {
            const merged = [...prev];
            for (const conn of saved as Array<Record<string, unknown>>) {
              const existing = merged.find((p) => p.id === conn.id);
              if (existing) {
                existing.status = 'saved';
              } else {
                // New custom provider from API
                const fields: { key: string; label: string; type: string; placeholder: string }[] = [];
                if (conn.api_key) fields.push({ key: 'api_key', label: 'API Key', type: 'password', placeholder: '••••••••' });
                if (conn.base_url) fields.push({ key: 'base_url', label: 'Base URL', type: 'text', placeholder: 'https://...' });
                merged.push({
                  id: String(conn.id),
                  name: (conn.name as string) || String(conn.id),
                  status: 'saved',
                  type: (conn.type as string) || 'custom',
                  fields,
                  docs: '',
                });
              }
            }
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [addingProvider, setAddingProvider] = useState(false);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('Primary person');

  useEffect(() => {
    fetchPrincipal()
      .then((d) => { if (d.display_name) setDisplayName(d.display_name); })
      .catch(() => {});
  }, []);
  const { setCompanion } = useCompanion();
  const { motion, contrast, density, textScale, targetSize, setPref } = usePrefs();

  useEffect(() => {
    fetchPrefs()
      .then((d) => {
        setPrefs(d);
        if (d?.motion) setPref("motion", d.motion);
        if (d?.contrast) setPref("contrast", d.contrast);
        if (d?.density) setPref("density", d.density);
        if (d?.target_size) setPref("targetSize", d.target_size);
        if (d?.text_scale) setPref("textScale", d.text_scale);
      })
      .catch(() => {});
  }, []);

  const p = prefs || { motion: "reduced", contrast: "comfortable", text_scale: 1.0, density: "comfortable", target_size: 44, companion: "personal-world", accent: "world-keeper" };

  const savePrefsAndSync = async (updates: Partial<Prefs>) => {
    const newPrefs = { ...p, ...updates };
    setPrefs(newPrefs);
    setSaving(true);
    try {
      await savePrefs(newPrefs);
    } catch {}
    setSaving(false);
  };

  const configuringProvider = providers.find((pr) => pr.id === configuring);

  return (
    <div className="space-y-4 p-4 overflow-y-auto h-full">
      <section aria-labelledby="settings-heading">
        <div className="flex items-start justify-between">
          <div>
            <h1 id="settings-heading" className="text-3xl font-bold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>System Settings</h1>
            <p className="mt-1 text-[var(--pw-color-text-muted)]">Configure your personal digital appliance preferences and capabilities</p>
          </div>
          {saving && <Badge variant="secondary" className="flex items-center gap-1"><Loader2 className="h-3 w-3 loader-static" /> Saving…</Badge>}
        </div>
      </section>

      {/* General */}
      <CollapsibleSection id="general" title="General" icon={User} defaultOpen>
        <Card><CardContent className="divide-y divide-[var(--pw-color-border-subtle)]">
          <EditableRow icon={User} label="Display Name" value={displayName} onSave={(v) => {
        setDisplayName(v);
        savePrincipalDisplayName(v)
          .then(() => window.dispatchEvent(new Event('principal-updated')))
          .catch(() => {});
      }} />
        </CardContent></Card>
      </CollapsibleSection>

      {/* Accessibility */}
      <CollapsibleSection id="accessibility" title="Accessibility" icon={Eye}>
        <p className="mb-3 text-xs text-[var(--pw-color-text-muted)]">These preferences apply everywhere. No separate accessibility mode — this is how your world works.</p>
        <Card><CardContent className="divide-y divide-[var(--pw-color-border-subtle)]">
          <SelectRow icon={Zap} label="Motion & Transitions" value={motion} options={["off", "reduced", "subtle"]} onChange={(v) => { setPref("motion", v); savePrefsAndSync({ motion: v }); }} />
          <SelectRow icon={Eye} label="Contrast" value={contrast} options={["comfortable", "high"]} onChange={(v) => { setPref("contrast", v); savePrefsAndSync({ contrast: v }); }} />
          <SelectRow icon={Monitor} label="Information Density" value={density} options={["compact", "comfortable", "spacious"]} onChange={(v) => { setPref("density", v); savePrefsAndSync({ density: v }); }} />
          <SelectRow icon={Hand} label="Target Size" value={`${targetSize}px`} options={["44px", "48px", "56px"]} onChange={(v) => { setPref("targetSize", parseInt(v)); savePrefsAndSync({ target_size: parseInt(v) }); }} />
          <SelectRow icon={Palette} label="Text Scale" value={`${textScale}x`} options={["0.875x", "1x", "1.125x", "1.25x", "1.5x"]} onChange={(v) => { setPref("textScale", parseFloat(v)); savePrefsAndSync({ text_scale: parseFloat(v) }); }} />
        </CardContent></Card>
      </CollapsibleSection>

      {/* Companion */}
      <CollapsibleSection id="companion" title="Companion" icon={Settings}>
        <Card><CardContent className="space-y-2">
          {COMPANIONS.map((c) => (
            <button key={c.id} onClick={() => { savePrefsAndSync({ companion: c.id }); setCompanion(c.id); }} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors ${p.companion === c.id ? "border border-[var(--pw-color-accent-primary)] bg-[var(--pw-color-accent-primary)]/5" : "border border-transparent hover:bg-[var(--pw-color-surface-elevated)]"}`}>
              <img src={c.icon} alt="" className="h-7 w-7" aria-hidden={true} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--pw-color-text-primary)]">{c.name}</p>
                <p className="text-xs text-[var(--pw-color-text-muted)] truncate">{c.desc}</p>
              </div>
              {p.companion === c.id && <Badge variant="default" className="shrink-0">Active</Badge>}
            </button>
          ))}
        </CardContent></Card>
      </CollapsibleSection>

      {/* Providers */}
      <CollapsibleSection id="providers" title="Providers" icon={Wrench} badge={`${providers.filter((pr) => pr.status !== "not configured").length}/${providers.length}`}>
        <Card>
          <CardContent className="divide-y divide-[var(--pw-color-border-subtle)]">
            {providers.map((pr) => (
              <div key={pr.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <Settings className="h-4 w-4 text-[var(--pw-color-text-muted)]" aria-hidden={true} />
                  <div>
                    <span className="text-sm text-[var(--pw-color-text-primary)]">{pr.name}</span>
                    <Badge variant={pr.status === "connected" ? "healthy" : pr.status === "configured" ? "secondary" : "unknown"} className="ml-2">{pr.status}</Badge>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setConfiguring(pr.id)}>
                  <Wrench className="h-4 w-4 mr-1" aria-hidden={true} />Configure
                </Button>
              </div>
            ))}
          </CardContent>
          <div className="border-t border-[var(--pw-color-border-subtle)] p-3">
            <Button variant="ghost" className="w-full" onClick={() => setAddingProvider(true)}>
              <Plus className="h-4 w-4 mr-2" aria-hidden={true} />Add Provider
            </Button>
          </div>
        </Card>
      </CollapsibleSection>

      
      {/* Icon reference (read-only; the sprite is the icon system) */}
      <CollapsibleSection id="icons" title="Icons" icon={Palette}>
        <Card><CardContent>
          <p className="mb-3 text-xs text-[var(--pw-color-text-muted)]">The icons used throughout the interface, served from the instance's sprite.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { cat: "navigation", icons: ["today", "chat", "worlds", "journal", "settings", "projects"] },
              { cat: "actions", icons: ["add", "delete", "edit", "search", "filter", "refresh"] },
              { cat: "status-feedback", icons: ["success", "warning", "error", "info", "loading", "offline"] },
              { cat: "chat-ai", icons: ["send", "agent", "tools", "voice", "attach", "context"] },
              { cat: "companion", icons: ["personal-world", "rylee-mermaid", "little-helper", "world-tree-squirrel", "tacos-morning-paper"] },
              { cat: "system-device", icons: ["desktop", "mobile", "lock", "accessibility", "theme", "keyboard"] },
              { cat: "time-organization", icons: ["calendar", "clock", "history", "archive", "pin", "sort"] },
              { cat: "world-content", icons: ["world", "memory", "lore", "story", "bookmark", "tag"] },
            ].map((group) => (
              <div key={group.cat} className="rounded-lg border border-[var(--pw-color-border-subtle)] p-2">
                <p className="mb-1.5 text-xs font-medium text-[var(--pw-color-text-muted)]">{group.cat}</p>
                <div className="flex flex-wrap gap-1">
                  {group.icons.map((icon) => (
                    <img key={icon} src={`/icons/${group.cat.toLowerCase()}--${icon}.svg`} alt={icon} className="h-5 w-5 text-[var(--pw-color-text-secondary)]" title={icon} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent></Card>
      </CollapsibleSection>

      {/* About */}
      <CollapsibleSection id="about" title="About" icon={Shield}>
        <Card><CardContent className="divide-y divide-[var(--pw-color-border-subtle)]">
          <StaticRow icon={Settings} label="Auth" value="Configured" />
        </CardContent></Card>
      </CollapsibleSection>

      {configuringProvider && <ConfigureModal provider={configuringProvider} onClose={() => setConfiguring(null)} onSaved={(id) => {
        setProviders((prev) => {
          const updated = prev.map((pr) => pr.id === id ? { ...pr, status: 'saved' } : pr);
          return updated;
        });
      }} />}
{addingProvider && <AddProviderModal onClose={() => setAddingProvider(false)} onAdd={(pr) => { setProviders((prev) => [...prev, pr]); setAddingProvider(false); }} />}
      {/* ── Vault Section ── */}
      <CollapsibleSection id="vault" title="Vault" icon={Shield} badge={vaultStatus.data?.locked ? "locked" : "unlocked"}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--pw-color-text-secondary)]">
              {vaultStatus.data?.locked ? "🔒 Locked" : "🔓 Unlocked"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => {}}>
              {vaultStatus.data?.locked ? "Unlock" : "Lock"}
            </Button>
          </div>
          <div className="text-xs text-[var(--pw-color-text-muted)]">
            Encrypted at rest: {vaultStatus.data?.encrypted ? "Yes" : "No"}
          </div>
        </div>
      </CollapsibleSection>

      {/* ── Source Control Section ── */}
      <CollapsibleSection id="source-control" title="Source Control" icon={Globe} defaultOpen={false}>
        <div className="space-y-3">
          {scStatus.data?.repos ? (
            scStatus.data.repos.map((repo) => (
              <div key={repo.name} className="flex items-center justify-between rounded-xl border border-[var(--pw-color-border-subtle)] p-3">
                <div>
                  <div className="text-sm font-medium text-[var(--pw-color-text-primary)]">{repo.name}</div>
                  <div className="text-xs text-[var(--pw-color-text-muted)]">{repo.branch || "no branch"}</div>
                </div>
                <Badge variant={repo.dirty ? "attention" : "healthy"}>
                  {repo.dirty ? "dirty" : "clean"}
                </Badge>
              </div>
            ))
          ) : (
            <div className="text-sm text-[var(--pw-color-text-muted)]">
              {(!scStatus.data?.repos || scStatus.data.repos.length === 0) ? "No repositories configured" : "Loading..."}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* ── Backup Section ── */}
      <CollapsibleSection id="backup" title="Backup" icon={Shield} defaultOpen={false}>
        <div className="space-y-3">
          {backup.data ? (
            <>
              <div className="text-sm text-[var(--pw-color-text-secondary)]">
                Schema: {backup.data.schema}
              </div>
              <div className="text-xs text-[var(--pw-color-text-muted)]">
                {backup.data.world?.facts ? Object.keys(backup.data.world.facts).length : 0} facts stored
              </div>
            </>
          ) : (
            <div className="text-sm text-[var(--pw-color-text-muted)]">Loading...</div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// ── Collapsible Section ──
function CollapsibleSection({ id, title, icon: Icon, children, defaultOpen = false, badge }: {
  id: string; title: string; icon: typeof User; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section aria-labelledby={`${id}-heading`}>
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left" aria-expanded={open} aria-controls={`${id}-content`}>
        <ChevronDown className={`h-4 w-4 text-[var(--pw-color-text-muted)] transition-transform ${open ? "rotate-180" : ""}`} aria-hidden={true} />
        <Icon className="h-4 w-4 text-[var(--pw-color-text-muted)]" aria-hidden={true} />
        <h2 id={`${id}-heading`} className="text-sm font-semibold uppercase tracking-wider text-[var(--pw-color-text-muted)]">{title}</h2>
        {badge && <Badge variant="secondary" className="ml-auto">{badge}</Badge>}
      </button>
      {open && <div id={`${id}-content`} className="mt-3">{children}</div>}
    </section>
  );
}

// ── Configure Modal ──
function ConfigureModal({ provider, onClose, onSaved }: { provider: Provider; onClose: () => void; onSaved?: (id: string) => void }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<{status: string; message: string} | null>(null);

  const validateCredentials = async () => {
    setValidating(true);
    setValidation(null);
    try {
      const data = await validateConnection({
        provider_id: provider.id,
        base_url: values.base_url || '',
        api_key: values.api_key || '',
      });
      setValidation(data as { status: string; message: string });
    } catch (e) {
      setValidation({ status: 'error', message: e instanceof ApiError ? e.message : 'Validation request failed' });
    }
    setValidating(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveConnection({
        provider_id: provider.id,
        name: provider.name,
        type: provider.type,
        fields: values,
      });
    } catch {}
    setIsSaving(false);
    setSaved(true);
    onSaved?.(provider.id);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pw-color-surface-canvas)]/60 p-4">
      <Card className="w-full max-w-xl">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--pw-color-surface-elevated)]"><Settings className="h-5 w-5 text-[var(--pw-color-text-muted)]" aria-hidden={true} /></div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>{provider.name}</h2>
              <Badge variant={provider.status === "connected" ? "healthy" : provider.status === "configured" ? "secondary" : "unknown"}>{provider.status}</Badge>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)]" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <CardContent className="space-y-4">
          {provider.fields.map((field) => (
            <div key={field.key}>
              <label className="mb-1 flex items-center gap-1.5 text-sm text-[var(--pw-color-text-muted)]">
                {field.type === "password" ? <Key className="h-3.5 w-3.5" aria-hidden={true} /> : <Link className="h-3.5 w-3.5" aria-hidden={true} />}
                {field.label}
              </label>
              <input type={field.type} value={values[field.key] || ""} onChange={(e) => setValues({ ...values, [field.key]: e.target.value })} placeholder={field.placeholder} className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-4 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" />
            </div>
          ))}
          <p className="text-xs text-[var(--pw-color-text-muted)]">Get credentials at: {provider.docs}</p>
        </CardContent>
        {validation && (
          <div className={`rounded-lg p-3 text-sm ${
            validation.status === 'valid' ? 'bg-[var(--pw-color-accent-secondary)]/10 text-[var(--pw-color-accent-secondary)]' :
            validation.status === 'invalid' ? 'bg-[var(--pw-color-text-primary)]/10 text-[var(--pw-color-text-primary)]' :
            'bg-[var(--pw-color-text-secondary)]/10 text-[var(--pw-color-text-secondary)]'
          }`}>
            {validation.status === 'valid' ? '✓' : validation.status === 'invalid' ? '✗' : '⚠'} {validation.message}
          </div>
        )}
        <div className="flex justify-end gap-2 p-4 pt-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={validateCredentials} disabled={validating}>
            {validating ? <Loader2 className="h-4 w-4 loader-static" /> : "Validate"}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 loader-static" /> : saved ? <><Check className="h-4 w-4" /> Saved</> : "Save"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// ── Add Provider Modal ──
function AddProviderModal({ onClose, onAdd }: { onClose: () => void; onAdd: (pr: Provider) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("custom");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    const id = name.toLowerCase().replace(/\s+/g, "-");
    const pr: Provider = {
      id,
      name: name.trim(),
      status: "not configured",
      type,
      fields: [
        { key: "api_key", label: "API Key", type: "password", placeholder: "••••••••" },
        { key: "base_url", label: "Base URL", type: "text", placeholder: "https://..." },
      ],
      docs: "Enter your provider's documentation URL",
    };
    onAdd(pr);
    // Persist to API
    saveConnection({
      provider_id: id,
      name: name.trim(),
      type,
      fields: { api_key: apiKey, base_url: baseUrl },
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--pw-color-surface-canvas)]/60 p-4">
      <Card className="w-full max-w-xl">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Add Provider</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)]" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[var(--pw-color-text-muted)]">Provider Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. LiteLLM, OpenAI, Anthropic" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-4 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--pw-color-text-muted)]">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-4 py-2 text-sm text-[var(--pw-color-text-primary)] outline-none focus:border-[var(--pw-color-accent-primary)]">
              <option value="custom">Custom (OpenAI-compatible)</option>
              <option value="cloud">Cloud Provider</option>
              <option value="local">Local Instance</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--pw-color-text-muted)]">Base URL</label>
            <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://your-proxy.com/v1" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-4 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--pw-color-text-muted)]">API Key</label>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-4 py-2 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" />
          </div>
        </CardContent>
        <div className="flex justify-end gap-2 p-4 pt-0">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!name.trim()}>Add Provider</Button>
        </div>
      </Card>
    </div>
  );
}

function StaticRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (<div className="flex items-center justify-between py-3 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-[var(--pw-color-text-muted)]" aria-hidden={true} /><span className="text-sm text-[var(--pw-color-text-primary)]">{label}</span></div><span className="text-sm text-[var(--pw-color-text-muted)]">{value}</span></div>);
}

function EditableRow({ icon: Icon, label, value, onSave }: { icon: typeof User; label: string; value: string; onSave?: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const commit = (v: string) => {
    setEditing(false);
    onSave?.(v);
    savePrincipalDisplayName(v)
      .then(() => window.dispatchEvent(new Event('principal-updated')))
      .catch(() => {});
  };

  return (<div className="flex items-center justify-between py-3 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-[var(--pw-color-text-muted)]" aria-hidden={true} /><span className="text-sm text-[var(--pw-color-text-primary)]">{label}</span></div>
    {editing ? <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => commit(draft)} onKeyDown={(e) => e.key === "Enter" && commit(draft)} className="w-40 rounded-lg border border-[var(--pw-color-accent-primary)] bg-[var(--pw-color-surface-panel)] px-2 py-1 text-sm text-[var(--pw-color-text-primary)] outline-none" /> : <button onClick={() => setEditing(true)} className="text-sm text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)]">{value}</button>}
  </div>);
}


function SelectRow({ icon: Icon, label, value, options, onChange }: { icon: typeof User; label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (<div className="flex items-center justify-between py-3 first:pt-0 last:pb-0"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-[var(--pw-color-text-muted)]" aria-hidden={true} /><span className="text-sm text-[var(--pw-color-text-primary)]">{label}</span></div>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-2 py-1 text-sm text-[var(--pw-color-text-primary)] outline-none focus:border-[var(--pw-color-accent-primary)]">
      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  </div>);
}

export default SettingsScreen;

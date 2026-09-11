import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchSetupStatus, postSetup } from "../lib/api";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Loader2, Check, ChevronLeft, ChevronRight, Sparkles } from "../lib/icons";

const COMPANIONS = [
  { id: "personal-world", name: "World Keeper", icon: "/companions/personal-world.svg" },
  { id: "mermaid", name: "Mermaid", icon: "/companions/mermaid.svg" },
  { id: "robot", name: "Robot", icon: "/companions/robot.svg" },
  { id: "squirrel", name: "Tree Squirrel", icon: "/companions/world-tree-squirrel.svg" },
  { id: "tacos", name: "Taco Truck", icon: "/companions/taco-news-truck.svg" },
];

function SetupWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [companion, setCompanion] = useState("personal-world");
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alreadySetup, setAlreadySetup] = useState(false);

  useEffect(() => {
    fetchSetupStatus()
      .then((d) => {
        const complete =
          typeof d === "object" && d !== null && "complete" in d
            ? Boolean((d as { complete: unknown }).complete)
            : false;
        if (complete) setAlreadySetup(true);
      })
      .catch(() => {});
  }, []);

  const selectedCompanion = COMPANIONS.find((c) => c.id === companion);

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text).catch(() => {}); };

  const generateToken = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.";
    let result = "";
    for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    setToken(result);
  };

  const handleFinish = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await postSetup({ token: token || "", companion });
      localStorage.setItem("pw_token", token);
      setStep(5);
    } catch {
      setError("Setup failed. Check the server and try again.");
    } finally { setIsSaving(false); }
  };

  if (alreadySetup) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--pw-color-surface-canvas)] p-4">
        <Card className="w-full max-w-lg"><CardContent className="p-6 text-center">
          <img src="/companions/personal-world.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold text-[var(--pw-color-accent-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Your Personal World is already set up!</h1>
          <p className="mt-2 text-[var(--pw-color-text-muted)]">Redirecting to dashboard…</p>
          <Button onClick={() => navigate("/")} className="mt-4">Go to Dashboard</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--pw-color-surface-canvas)] p-4">
      <Card className="w-full max-w-lg"><CardContent className="p-6">
        <div className="mb-6 text-center">
          <img src="/companions/personal-world.svg" alt="" className="mx-auto mb-3 h-12 w-12" />
          <h1 className="text-2xl font-bold text-[var(--pw-color-accent-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Welcome to your Personal World</h1>
          <p className="mt-1 text-sm text-[var(--pw-color-text-muted)]">Step {step} of 4</p>
        </div>

        {step === 1 && <div className="space-y-4">
          <p className="text-[var(--pw-color-text-primary)]">What would you like to call this world?</p>
          <p className="text-xs text-[var(--pw-color-text-muted)]">A friendly name you can change later.</p>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Personal World" maxLength={60} className="w-full rounded-xl border-2 border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-canvas)] px-4 py-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" />
        </div>}

        {step === 2 && <div className="space-y-4">
          <p className="text-[var(--pw-color-text-primary)]">Pick your companion.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COMPANIONS.map((c) => (
              <button key={c.id} onClick={() => setCompanion(c.id)} className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-colors ${companion === c.id ? "border-[var(--pw-color-accent-primary)] bg-[var(--pw-color-accent-primary)]/5" : "border-[var(--pw-color-border-subtle)] hover:border-[var(--pw-color-accent-primary)]/50"}`}>
                <img src={c.icon} alt="" className="h-10 w-10" />
                <span className="text-xs text-[var(--pw-color-text-primary)]">{c.name}</span>
                {companion === c.id && <Badge variant="default" className="text-[10px]">Selected</Badge>}
              </button>
            ))}
          </div>
        </div>}

        {step === 3 && <div className="space-y-4">
          <p className="text-[var(--pw-color-text-primary)]">Choose your login token.</p>
          <p className="text-xs text-[var(--pw-color-text-muted)]">Generate a strong one and save it somewhere safe.</p>
          <div className="relative">
            <input type={showToken ? "text" : "password"} value={token} onChange={(e) => setToken(e.target.value)} placeholder="Enter or generate a token" className="w-full rounded-xl border-2 border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-canvas)] px-4 py-3 pr-20 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none focus:border-[var(--pw-color-accent-primary)]" />
            <button onClick={() => setShowToken(!showToken)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-[var(--pw-color-text-muted)] hover:text-[var(--pw-color-text-primary)]">{showToken ? "Hide" : "Show"}</button>
          </div>
          <Button variant="outline" onClick={generateToken} className="w-full"><Sparkles className="mr-2 h-4 w-4" /> Generate Strong Token</Button>
          {token && <div className="rounded-lg bg-[var(--pw-color-surface-elevated)] p-3">
            <p className="text-xs text-[var(--pw-color-text-muted)]">Your token:</p>
            <p className="mt-1 break-all font-mono text-sm text-[var(--pw-color-accent-primary)]">{token}</p>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(token)} className="mt-2">Copy to Clipboard</Button>
          </div>}
        </div>}

        {step === 4 && <div className="space-y-4">
          <p className="text-[var(--pw-color-text-primary)]">You're all set!</p>
          <div className="space-y-2 rounded-xl bg-[var(--pw-color-surface-elevated)] p-4">
            <div className="flex justify-between text-sm"><span className="text-[var(--pw-color-text-muted)]">World name</span><span className="text-[var(--pw-color-text-primary)]">{name || "My Personal World"}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--pw-color-text-muted)]">Companion</span><span className="text-[var(--pw-color-text-primary)]">{selectedCompanion?.name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-[var(--pw-color-text-muted)]">Token</span><span className="font-mono text-[var(--pw-color-accent-primary)]">{token ? "••••••••" : "None set"}</span></div>
          </div>
          {error && <p className="text-xs text-[var(--pw-color-text-primary)]">{error}</p>}
        </div>}

        {step === 5 && <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--pw-color-accent-secondary)]/10"><Check className="h-8 w-8 text-[var(--pw-color-accent-secondary)]" /></div>
          <p className="text-[var(--pw-color-text-primary)]">Your Personal World is ready!</p>
          <Button onClick={() => navigate("/")} className="w-full">Go to Dashboard</Button>
        </div>}

        {step < 5 && <div className="mt-6 flex gap-3">
          {step > 1 && <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1"><ChevronLeft className="mr-1 h-4 w-4" /> Back</Button>}
          {step < 4 ? <Button onClick={() => setStep(step + 1)} className="flex-1">Next <ChevronRight className="ml-1 h-4 w-4" /></Button> : <Button onClick={handleFinish} disabled={isSaving} className="flex-1">{isSaving ? <Loader2 className="h-4 w-4 loader-static" /> : "Finish Setup"}</Button>}
        </div>}
      </CardContent></Card>
    </div>
  );
}

export default SetupWizard;

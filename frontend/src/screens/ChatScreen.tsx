import { useCompanion, COMPANIONS } from "../lib/companion-context";
import { getAuthToken } from "../lib/api";
import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Send, Loader2, AlertCircle, User, Sparkles } from "../lib/icons";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  "Check on my world",
  "What happened today?",
  "Show my active intents",
  "What needs attention?",
];

function ChatScreen() {
  const { companion } = useCompanion();
  const comp = COMPANIONS[companion] || COMPANIONS["personal-world"];
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, error]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMessage: Message = { role: "user", content: text.trim(), timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text.trim(), history }),
      });
      const data = await response.json();
      if (!data.ok) {
        setError(data.status === "not_configured" ? "No chat provider configured. Add a chat connection in Settings to start talking." : data.warnings?.[0] || "Something went wrong.");
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.data?.reply || data.reply || "No response.", timestamp: new Date() }]);
    } catch {
      setError("Could not connect to the chat service.");
    } finally {
      setIsLoading(false);
    }
  };

  const hasConversation = messages.length > 0 || error || isLoading;

  return (
    <main id="main-content" className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-[var(--pw-color-border-subtle)] px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Chat</h1>
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <img src={comp.icon} alt="" className="h-4 w-4" aria-hidden={true} />
            {comp.name}
          </Badge>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!hasConversation ? (
          <div className="flex h-full flex-col items-center justify-center gap-4">
            <img src={comp.icon} alt={comp.name} className="h-20 w-20" />
            <div className="text-center">
              <h2 className="text-xl font-semibold text-[var(--pw-color-text-primary)]" style={{ fontFamily: "var(--pw-typography-font-expressive)" }}>Hello! I'm your system companion.</h2>
              <p className="mt-2 max-w-lg text-[var(--pw-color-text-muted)]">I can run system diagnostics, search your world, check on capabilities, or write journal updates. What would you like to do?</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)} className="rounded-full border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-4 py-2 text-sm text-[var(--pw-color-text-secondary)] transition-colors hover:border-[var(--pw-color-accent-primary)] hover:text-[var(--pw-color-text-primary)]">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, i) => (
              <div key={i} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pw-color-surface-elevated)]">
                    <img src={comp.icon} alt="" className="h-5 w-5" aria-hidden={true} />
                  </div>
                )}
                <div className={`max-w-[70%] rounded-xl px-4 py-3 ${message.role === "user" ? "bg-[var(--pw-color-accent-primary)] text-[var(--pw-color-surface-canvas)]" : "bg-[var(--pw-color-surface-elevated)] text-[var(--pw-color-text-primary)]"}`}>
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className={`mt-1 text-[10px] ${message.role === "user" ? "text-[var(--pw-color-surface-canvas)]/60" : "text-[var(--pw-color-text-muted)]"}`}>
                    {message.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </p>
                </div>
                {message.role === "user" && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pw-color-accent-primary)]">
                    <User className="h-4 w-4 text-[var(--pw-color-surface-canvas)]" aria-hidden={true} />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--pw-color-surface-elevated)]">
                  <img src={comp.icon} alt="" className="h-5 w-5" aria-hidden={true} />
                </div>
                <div className="rounded-xl bg-[var(--pw-color-surface-elevated)] px-4 py-3">
                  <div className="flex items-center gap-2 text-[var(--pw-color-text-muted)]">
                    <Loader2 className="h-4 w-4 loader-static" aria-hidden={true} />
                    <span className="text-sm">Thinking…</span>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="flex justify-center">
                <Card className="max-w-lg border-[var(--pw-color-text-secondary)]/30 bg-[var(--pw-color-text-secondary)]/5">
                  <CardContent className="flex items-start gap-3 pt-4">
                    <AlertCircle className="h-5 w-5 shrink-0 text-[var(--pw-color-text-secondary)]" aria-hidden={true} />
                    <div>
                      <p className="text-sm text-[var(--pw-color-text-primary)]">{error}</p>
                      <button onClick={() => setError(null)} className="mt-2 text-xs text-[var(--pw-color-accent-primary)] hover:underline">Dismiss</button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[var(--pw-color-border-subtle)] px-6 py-4">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-3">
          <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about your world…" disabled={isLoading} className="flex-1 rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-4 py-3 text-sm text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] outline-none transition-colors focus:border-[var(--pw-color-accent-primary)] disabled:opacity-50" aria-label="Chat message" />
          <Button type="submit" disabled={!input.trim() || isLoading} size="icon" aria-label="Send message">
            {isLoading ? <Loader2 className="h-4 w-4 loader-static" aria-hidden={true} /> : <Send className="h-4 w-4" aria-hidden={true} />}
          </Button>
        </form>
        <p className="mt-2 text-center text-[10px] text-[var(--pw-color-text-muted)]">
          <Sparkles className="mr-1 inline h-3 w-3" aria-hidden={true} />
          Powered by your Personal World
        </p>
      </div>
    </main>
  );
}

export default ChatScreen;

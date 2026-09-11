import { useWorld, useWorldStatus, useReminders, useJournal, useHealth, usePrincipal, useVaultStatus, useSourceControlStatus } from "../lib/hooks";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  Loader2,
  AlertCircle,
  Inbox,
  CheckCircle2,
  Clock,
  Globe,
  Shield,
  Zap,
  Bell,
  BookOpen,
  Sparkles,
  FileText,
  Settings,
  GitCommit,
  Heart,
} from "../lib/icons";

function TodayScreen() {
  const world = useWorld();
  const vaultStatus = useVaultStatus();
  const scStatus = useSourceControlStatus();
  const worldStatus = useWorldStatus();
  const reminders = useReminders();
  const journal = useJournal();
  const health = useHealth();
  const principal = usePrincipal();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Loading State ──
  if (world.isLoading || worldStatus.isLoading || health.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Loader2
          className="h-8 w-8 loader-static text-[var(--pw-color-accent-primary)]"
          aria-hidden={true}
        />
        <p className="text-[var(--pw-color-text-muted)]">Loading your world…</p>
      </div>
    );
  }

  // ── Error State ──
  if (world.isError || worldStatus.isError || health.isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <AlertCircle
          className="h-8 w-8 text-[var(--pw-color-text-primary)]"
          aria-hidden={true}
        />
        <p className="text-[var(--pw-color-text-muted)]">
          Could not load your world. Check that the server is running.
        </p>
      </div>
    );
  }

  // ── Empty State ──
  if (!world.data || !worldStatus.data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8">
        <Inbox
          className="h-12 w-12 text-[var(--pw-color-text-muted)]"
          aria-hidden={true}
        />
        <h2
          className="text-xl font-semibold text-[var(--pw-color-text-primary)]"
          style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
        >
          Welcome to your Personal World
        </h2>
        <p className="text-center text-[var(--pw-color-text-muted)]">
          Your world hasn't been set up yet. Run the setup wizard to get
          started.
        </p>
      </div>
    );
  }

  const capabilities = worldStatus.data.capabilities || {};
  const capabilitiesList = Object.entries(capabilities);
  const healthyCount = capabilitiesList.filter(([, c]) => c.ok).length;
  const warningCount = capabilitiesList.filter(
    ([, c]) => c.status === "warning" || c.status === "needs_attention"
  ).length;
  const offlineCount = capabilitiesList.filter(
    ([, c]) => c.status === "not_configured" || c.status === "disabled"
  ).length;

  // Get attention items
  const attentionItems = capabilitiesList
    .filter(([, c]) => c.status === "needs_attention" || c.warnings?.length > 0)
    .slice(0, 3);

  const activeReminders = (reminders.data || []).filter((r) => r.enabled);
  const recentJournal = (journal.data || []).slice(0, 5);

  // Build discovery items from capabilities that are newly observed
  const discoveryItems = capabilitiesList
    .filter(([, c]) => c.last_observed)
    .sort(
      (a, b) =>
        new Date(b[1].last_observed).getTime() -
        new Date(a[1].last_observed).getTime()
    )
    .slice(0, 3);

  // Build recent changes from world data
  const recentChanges: Array<{
    text: string;
    time: string;
  }> = [];

  return (
    <main id="main-content" className="space-y-4 p-4">
      {/* ── Greeting + Status ── */}
      <section aria-labelledby="greeting-heading">
        <div className="flex items-start justify-between">
          <div>
            <h1
              id="greeting-heading"
              className="text-3xl font-bold text-[var(--pw-color-text-primary)]"
              style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
            >
              {principal.data?.display_name
                ? `Welcome back, ${principal.data.display_name}`
                : "Welcome back"}
            </h1>
            <p className="mt-1 text-[var(--pw-color-text-muted)]">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full loader-static rounded-full bg-[var(--pw-color-accent-secondary)] opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--pw-color-accent-secondary)]"></span>
            </span>
            <span className="text-sm text-[var(--pw-color-text-muted)]">
              Local instance synchronized
            </span>
          </div>
        </div>
      </section>

      {/* ── Health Summary ── */}
      <section aria-labelledby="health-heading">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle2
                className="h-5 w-5 text-[var(--pw-color-accent-secondary)]"
                aria-hidden={true}
              />
              <span
                id="health-heading"
                className="text-lg font-medium text-[var(--pw-color-text-primary)]"
              >
                {warningCount > 0
                  ? "Your world needs some attention"
                  : "Your world looks healthy"}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[var(--pw-color-text-muted)]">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--pw-color-accent-secondary)]"></span>
                {healthyCount} connected capabilities healthy
              </div>
              {warningCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--pw-color-text-secondary)]"></span>
                  {warningCount} need attention
                </div>
              )}
              {offlineCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-[var(--pw-color-text-muted)]"></span>
                  {offlineCount} not configured
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Attention Items ── */}
      {attentionItems.length > 0 && (
        <section aria-labelledby="attention-heading">
          <Card>
            <CardHeader>
              <CardTitle id="attention-heading" className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-[var(--pw-color-text-secondary)]" aria-hidden={true} />
                Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3" role="list">
                {attentionItems.map(([name, cap]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between border-b border-[var(--pw-color-border-subtle)] pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <span className="text-[var(--pw-color-text-primary)] capitalize">
                        {name.replace(/_/g, " ")}
                      </span>
                      {cap.warnings?.[0] && (
                        <p className="text-xs text-[var(--pw-color-text-muted)]">
                          {cap.warnings[0]}
                        </p>
                      )}
                    </div>
                    <Badge variant="attention">{cap.status.replace(/_/g, " ")}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Quick Stats ── */}
      <section aria-labelledby="stats-heading">
        <h2 id="stats-heading" className="sr-only">
          World statistics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" aria-hidden={true} />
                Facts
              </CardDescription>
              <CardTitle className="text-3xl">{worldStatus.data.facts}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" aria-hidden={true} />
                Intents
              </CardDescription>
              <CardTitle className="text-3xl">{worldStatus.data.intents}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" aria-hidden={true} />
                Policies
              </CardDescription>
              <CardTitle className="text-3xl">{worldStatus.data.policies}</CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden={true} />
                Capabilities
              </CardDescription>
              <CardTitle className="text-3xl">
                {healthyCount}/{capabilitiesList.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* ── Active Intents ── */}
      {Object.keys(world.data.intents).length > 0 && (
        <section aria-labelledby="intents-heading">
          <Card>
            <CardHeader>
              <CardTitle id="intents-heading">Current Focus</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" role="list">
                {Object.entries(world.data.intents).map(([key, intent]) => (
                  <li
                    key={key}
                    className="flex items-center justify-between border-b border-[var(--pw-color-border-subtle)] py-2 last:border-0"
                  >
                    <span className="text-[var(--pw-color-text-secondary)] capitalize">
                      {key.replace(/_/g, " ")}
                    </span>
                    <span className="text-[var(--pw-color-text-primary)]">
                      {intent.value}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Discovery ── */}
      {discoveryItems.length > 0 && (
        <section aria-labelledby="discovery-heading">
          <Card>
            <CardHeader>
              <CardTitle id="discovery-heading" className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[var(--pw-color-accent-primary)]" aria-hidden={true} />
                Discovery
              </CardTitle>
              <CardDescription>
                Found {discoveryItems.length} items matching your interests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3" role="list">
                {discoveryItems.map(([name, cap]) => (
                  <li
                    key={name}
                    className="flex items-center justify-between border-b border-[var(--pw-color-border-subtle)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          cap.ok
                            ? "bg-[var(--pw-color-accent-secondary)]"
                            : "bg-[var(--pw-color-text-secondary)]"
                        }`}
                      ></span>
                      <div>
                        <span className="text-[var(--pw-color-text-primary)] capitalize">
                          {name.replace(/_/g, " ")}
                        </span>
                        <p className="text-xs text-[var(--pw-color-text-muted)]">
                          via discovery
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {cap.status.replace(/_/g, " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Recent Changes ── */}
      {recentChanges.length > 0 && (
        <section aria-labelledby="changes-heading">
          <Card>
            <CardHeader>
              <CardTitle id="changes-heading">Recent Changes</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3" role="list">
                {recentChanges.map((change, i) => {
                  return (
                    <li
                      key={i}
                      className="flex items-center justify-between border-b border-[var(--pw-color-border-subtle)] pb-3 last:border-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[var(--pw-color-text-secondary)]">
                          {change.text}
                        </span>
                      </div>
                      <span className="text-xs text-[var(--pw-color-text-muted)]">
                        {change.time}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Vault Status ── */}
      <section aria-labelledby="vault-heading">
        <Card>
          <CardHeader>
            <CardTitle id="vault-heading" className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[var(--pw-color-accent-primary)]" aria-hidden={true} />
              Vault
            </CardTitle>
            <CardDescription>Secret storage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--pw-color-text-secondary)]">
                {vaultStatus.data?.locked ? "🔒 Locked" : "🔓 Unlocked"}
              </span>
              <Badge variant={vaultStatus.data?.locked ? "attention" : "healthy"}>
                {vaultStatus.data?.locked ? "locked" : "unlocked"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Source Control ── */}
      <section aria-labelledby="sc-heading">
        <Card>
          <CardHeader>
            <CardTitle id="sc-heading" className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[var(--pw-color-accent-primary)]" aria-hidden={true} />
              Source Control
            </CardTitle>
            <CardDescription>Git repositories</CardDescription>
          </CardHeader>
          <CardContent>
            {scStatus.data?.repos && scStatus.data.repos.length > 0 ? (
              <ul className="space-y-2" role="list">
                {scStatus.data.repos.map((repo) => (
                  <li key={repo.name} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--pw-color-text-primary)]">{repo.name}</span>
                    <Badge variant={repo.dirty ? "attention" : "healthy"}>
                      {repo.dirty ? "dirty" : "clean"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-sm text-[var(--pw-color-text-muted)]">No repositories found</span>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Reminders ── */}
      {activeReminders.length > 0 && (
        <section aria-labelledby="reminders-heading">
          <Card>
            <CardHeader>
              <CardTitle id="reminders-heading" className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[var(--pw-color-accent-primary)]" aria-hidden={true} />
                Reminders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" role="list">
                {activeReminders.map((reminder) => (
                  <li
                    key={reminder.id}
                    className="flex items-center justify-between border-b border-[var(--pw-color-border-subtle)] py-2 last:border-0"
                  >
                    <span className="text-[var(--pw-color-text-secondary)]">
                      {reminder.text}
                    </span>
                    <Badge variant="healthy">Active</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Recent Journal ── */}
      {recentJournal.length > 0 && (
        <section aria-labelledby="journal-heading">
          <Card>
            <CardHeader>
              <CardTitle id="journal-heading" className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[var(--pw-color-accent-secondary)]" aria-hidden={true} />
                Recent Journal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3" role="list">
                {recentJournal.map((entry, i) => {
                  const timeAgo = getTimeAgo(entry.ts);
                  const icon = getJournalIcon(entry.summary);
                  const Icon = icon.icon;
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-3 border-b border-[var(--pw-color-border-subtle)] pb-3 last:border-0 last:pb-0"
                    >
                      <Icon
                        className={`h-4 w-4 mt-0.5 ${icon.color}`}
                        aria-hidden={true}
                      />
                      <div className="flex-1">
                        <p className="text-[var(--pw-color-text-secondary)]">
                          {entry.summary}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {icon.label}
                          </Badge>
                          <span className="text-xs text-[var(--pw-color-text-muted)]">
                            {timeAgo}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ── Active Actors ── */}
      {worldStatus.data.actors && worldStatus.data.actors.length > 0 && (
        <section aria-labelledby="actors-heading">
          <Card>
            <CardHeader>
              <CardTitle id="actors-heading">Active Actors</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2" role="list">
                {worldStatus.data.actors.map((actor) => (
                  <li
                    key={actor.name}
                    className="flex items-center justify-between border-b border-[var(--pw-color-border-subtle)] py-2 last:border-0"
                  >
                    <span className="text-[var(--pw-color-text-secondary)]">
                      {actor.name}
                    </span>
                    <Badge
                      variant={
                        actor.status === "healthy" ? "healthy" : "unknown"
                      }
                    >
                      {actor.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}

// Helper to format timestamps as "X time ago"
function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "yesterday";
  return `${diffDays} days ago`;
}

// Helper to classify journal entries
function getJournalIcon(content: string): {
  icon: typeof CheckCircle2;
  color: string;
  label: string;
} {
  const lower = content.toLowerCase();
  if (lower.includes("deploy") || lower.includes("shipped") || lower.includes("completed")) {
    return { icon: CheckCircle2, color: "text-[var(--pw-color-accent-secondary)]", label: "deployment" };
  }
  if (lower.includes("setting") || lower.includes("config") || lower.includes("updated")) {
    return { icon: Settings, color: "text-[var(--pw-color-text-muted)]", label: "settings change" };
  }
  if (lower.includes("doc") || lower.includes("readme") || lower.includes("documentation")) {
    return { icon: FileText, color: "text-[var(--pw-color-accent-primary)]", label: "documentation" };
  }
  if (lower.includes("health") || lower.includes("check") || lower.includes("test")) {
    return { icon: Heart, color: "text-[var(--pw-color-accent-secondary)]", label: "health" };
  }
  if (lower.includes("migrat") || lower.includes("move") || lower.includes("setup")) {
    return { icon: GitCommit, color: "text-[var(--pw-color-accent-secondary)]", label: "observation" };
  }
  return { icon: BookOpen, color: "text-[var(--pw-color-text-muted)]", label: "note" };
}

export default TodayScreen;

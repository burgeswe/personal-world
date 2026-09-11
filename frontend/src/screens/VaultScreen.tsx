import { useState } from "react";
import {
  ApiError,
  deleteVaultSecret,
  lockVault,
  setVaultSecret,
  unlockVault,
} from "../lib/api";
import { useVaultNames, useVaultStatus, useVaultKey } from "../lib/hooks";
import { useAnnounce } from "../primitives/LiveRegion";
import { useStepUp } from "../primitives/StepUpPrompt";
import { Dialog } from "../primitives/Dialog";
import { StatusChip, type CanonicalStatus } from "../primitives/StatusChip";
import { ErrorState } from "../shell/ErrorState";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Loader2, Shield } from "../lib/icons";

/**
 * VaultScreen (P1 T10, parity row 5, FOUNDATION-SPEC §7):
 *
 * Status, unlock, lock, names, set, delete — all through the typed
 * client; every write passes through useStepUp() (StepUpPrompt opens on
 * a 403 step_up_required and re-sends with the step-up header).
 *
 * SECURITY (A11y-adjacent, spec §7 row 5): secret VALUES are never
 * requested and never rendered — the screen calls /api/vault/names and
 * /api/vault/set only; the value input is cleared after storing. Delete
 * confirms through the danger Dialog (verb label, consequence named).
 * Status words are StatusChip (canonical vocabulary); unlock/lock
 * outcomes announce through the app LiveRegion (action_completed /
 * error kinds only).
 */

function vaultStatusWord(locked: boolean): CanonicalStatus {
  return locked ? "not_configured" : "healthy";
}

function VaultScreen() {
  const status = useVaultStatus();
  const names = useVaultNames();
  const bumpVault = useVaultKey();
  const { announce } = useAnnounce();
  const stepUp = useStepUp();

  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [setName, setSetName] = useState("");
  const [setValue, setSetValue] = useState("");
  const [storing, setStoring] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const locked = status.data?.locked ?? true;
  const unlocked = status.data != null && !locked;

  const unlock = async () => {
    if (!passphrase || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await stepUp.withStepUp(() => unlockVault(passphrase));
      setPassphrase("");
      setMessage("Vault unlocked.");
      announce("Vault unlocked.", { kind: "action_completed", key: "vault-unlocked" });
      await Promise.all([status.refetch(), names.refetch()]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setMessage("Unlock cancelled — the vault stays locked.");
      } else {
        const detail = e instanceof ApiError && e.detail ? e.detail : null;
        setMessage(detail ?? "Unlock failed. Check the passphrase and try again.");
        announce("Unlock failed. The vault stays locked.", { kind: "error", key: "vault-unlock-failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await stepUp.withStepUp(() => lockVault());
      setMessage("Vault locked. Your secrets are sealed.");
      announce("Vault locked.", { kind: "action_completed", key: "vault-locked" });
      await Promise.all([status.refetch(), bumpVault(), names.refetch()]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setMessage("Lock cancelled — the vault stays unlocked.");
      } else {
        setMessage("Could not lock the vault just now. Try again.");
        announce("Lock failed. The vault stays unlocked.", { kind: "error", key: "vault-lock-failed" });
      }
    } finally {
      setBusy(false);
    }
  };

  const store = async () => {
    const name = setName.trim();
    if (!name || !setValue || storing) return;
    setStoring(true);
    setMessage("");
    try {
      await stepUp.withStepUp(() => setVaultSecret(name, setValue));
      setSetName("");
      setSetValue("");
      setMessage(`Stored "${name}".`);
      announce(`Secret ${name} stored.`, { kind: "action_completed", key: "vault-stored" });
      await Promise.all([names.refetch(), bumpVault()]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setMessage("Store cancelled — nothing was saved.");
      } else {
        setMessage("That secret was not stored. Try again.");
        announce("Store failed. Nothing was saved.", { kind: "error", key: "vault-store-failed" });
      }
    } finally {
      setStoring(false);
    }
  };

  const confirmDelete = async () => {
    const name = pendingDelete;
    if (!name || deleteBusy) return;
    setDeleteBusy(true);
    try {
      await stepUp.withStepUp(() => deleteVaultSecret(name));
      setMessage(`Deleted "${name}".`);
      announce(`Secret ${name} deleted.`, { kind: "action_completed", key: "vault-deleted" });
      setPendingDelete(null);
      await Promise.all([bumpVault(), names.refetch()]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "step_up_required") {
        setMessage(`Delete cancelled — "${name}" is still stored.`);
      } else {
        setMessage("Could not delete that secret just now. Try again.");
        announce("Delete failed. The secret is still stored.", { kind: "error", key: "vault-delete-failed" });
      }
    } finally {
      setDeleteBusy(false);
      setPendingDelete(null);
    }
  };

  if (status.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <p className="flex items-center gap-2 text-[var(--pw-color-text-muted)]" role="status">
          <Loader2 size={16} aria-hidden={true} className="loader-static" />
          Checking the vault…
        </p>
      </div>
    );
  }

  if (status.isError) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorState
          title="Vault"
          failed="could not reach the vault"
          detail={status.error instanceof ApiError ? status.error.detail : null}
          onRetry={() => void status.refetch()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {stepUp.prompt}
      <section aria-labelledby="vault-page-heading" className="space-y-2">
        <h1
          id="vault-page-heading"
          className="text-3xl font-bold"
          style={{ fontFamily: "var(--pw-typography-font-expressive)" }}
        >
          Vault
        </h1>
        <p className="text-[var(--pw-color-text-muted)]">
          Your secrets, sealed on this machine. Names are shown; values never leave the vault.
        </p>
        <div className="flex items-center gap-2">
          <StatusChip status={vaultStatusWord(locked)} label="vault" />
          <span className="text-sm text-[var(--pw-color-text-secondary)]" role="status">
            {message}
          </span>
        </div>
      </section>

      {/* Unlock / lock */}
      <section aria-labelledby="vault-access-heading">
        <Card>
          <CardHeader>
            <CardTitle id="vault-access-heading" className="flex items-center gap-2">
              <Shield size={18} aria-hidden={true} />
              {locked ? "Unlock your vault" : "Lock your vault"}
            </CardTitle>
            <CardDescription>
              {locked
                ? "Enter your master passphrase to reach your secrets on this device."
                : "Locking clears the secrets from memory."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {locked ? (
              <div className="space-y-3">
                <label htmlFor="vault-passphrase" className="sr-only">
                  Master passphrase
                </label>
                <input
                  id="vault-passphrase"
                  type="password"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <Button type="button" onClick={() => void unlock()} disabled={!passphrase || busy}>
                  Unlock vault
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => void lock()} disabled={busy}>
                Lock vault
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Names + set + delete (only when unlocked) */}
      {unlocked ? (
        <>
          <section aria-labelledby="vault-names-heading">
            <Card>
              <CardHeader>
                <CardTitle id="vault-names-heading">Stored secrets</CardTitle>
                <CardDescription>
                  Only the names are listed — the vault never shows a value here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {names.isLoading ? (
                  <p className="text-[var(--pw-color-text-muted)]" role="status">
                    Opening the list…
                  </p>
                ) : names.isError ? (
                  <p className="text-[var(--pw-color-text-primary)]">
                    {names.error instanceof ApiError && names.error.detail
                      ? names.error.detail
                      : "The names list could not be opened."}
                  </p>
                ) : (names.data?.names ?? []).length === 0 ? (
                  <p className="text-[var(--pw-color-text-secondary)]">
                    No secrets stored yet. Add one below.
                  </p>
                ) : (
                  <ul className="space-y-2" role="list">
                    {(names.data?.names ?? []).map((name) => (
                      <li
                        key={name}
                        className="flex items-center justify-between gap-3 border-b border-[var(--pw-color-border-subtle)] py-2 last:border-0 last:pb-0"
                      >
                        <span className="text-[var(--pw-color-text-primary)]">{name}</span>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setPendingDelete(name)}
                          aria-label={`Delete secret ${name}`}
                        >
                          Delete
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </section>

          <section aria-labelledby="vault-set-heading">
            <Card>
              <CardHeader>
                <CardTitle id="vault-set-heading">Store a secret</CardTitle>
                <CardDescription>
                  Give it a name you will recognize. The value is stored encrypted and never displayed again.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <label htmlFor="vault-secret-name" className="sr-only">
                  Secret name
                </label>
                <input
                  id="vault-secret-name"
                  type="text"
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="Secret name"
                  autoComplete="off"
                  className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <label htmlFor="vault-secret-value" className="sr-only">
                  Secret value
                </label>
                <input
                  id="vault-secret-value"
                  type="password"
                  value={setValue}
                  onChange={(e) => setSetValue(e.target.value)}
                  placeholder="Secret value"
                  autoComplete="off"
                  className="w-full rounded-xl border border-[var(--pw-color-border-subtle)] bg-[var(--pw-color-surface-panel)] px-3 text-[var(--pw-color-text-primary)] placeholder-[var(--pw-color-text-muted)] focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
                />
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    onClick={() => void store()}
                    disabled={!setName.trim() || !setValue || storing}
                  >
                    Store secret
                  </Button>
                  <span className="text-sm text-[var(--pw-color-text-muted)]" role="status">
                    {storing ? "Storing…" : ""}
                  </span>
                </div>
              </CardContent>
            </Card>
          </section>
        </>
      ) : null}

      {/* Danger confirm: verb label, consequence named (A11y §4.4) */}
      <Dialog
        open={pendingDelete !== null}
        title="Delete this secret?"
        description={
          pendingDelete
            ? `Deleting "${pendingDelete}" removes it permanently from the vault. Anything that relied on it will stop working, and this cannot be undone.`
            : ""
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        confirmLabel={deleteBusy ? "Deleting…" : "Delete secret"}
        danger={true}
        initialFocus="cancel"
      />
    </div>
  );
}

export default VaultScreen;
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { toHaveNoViolations } from "vitest-axe/dist/matchers";
import VaultScreen from "../screens/VaultScreen";
import {
  screenProviders,
  mockFetchByRoute,
  jsonResponse,
  okEnvelope,
} from "./screen-helpers";

/**
 * T10 Vault spec (parity row 5, FOUNDATION-SPEC §7):
 * - all five ops wired: status, unlock, lock, names, set, delete;
 * - delete confirms through the danger Dialog (verb label, consequence);
 * - secret VALUES are never rendered (names only; assert no value text);
 * - every write carries X-PW-StepUp; 403 step_up opens the prompt;
 * - unlock/lock outcomes announce via the LiveRegion;
 * - axe 0 violations (contrast disabled).
 */

expect.extend({ toHaveNoViolations });

// The elevation flag lives in handler scope; keep it simple via a mutable cell.
function vaultWorld() {
  const cell = { elevated: false };
  const state = {
    locked: true,
    names: ["provider-api-key", "wifi-password"] as string[],
    calls: [] as string[],
  };
  const handlers = {
    "/api/vault/status": () => {
      state.calls.push("status");
      return okEnvelope({ locked: state.locked, encrypted: true });
    },
    "/api/vault/names": () => {
      state.calls.push("names");
      if (state.locked) {
        return jsonResponse(409, { detail: "vault is locked" });
      }
      return okEnvelope({ names: state.names });
    },
    "/api/vault/unlock": (_path: string, init?: RequestInit) => {
      state.calls.push("unlock");
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (!body.passphrase) return jsonResponse(400, { detail: "passphrase required" });
      state.locked = false;
      return okEnvelope({ locked: false });
    },
    "/api/vault/lock": () => {
      state.calls.push("lock");
      state.locked = true;
      return okEnvelope({ locked: true });
    },
    "/api/vault/set": (_path: string, init?: RequestInit) => {
      state.calls.push("set");
      if (!cell.elevated) {
        return jsonResponse(403, { detail: "write requires step-up auth" });
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (!state.names.includes(body.name)) state.names.push(body.name);
      return okEnvelope({ name: body.name });
    },
    "/api/vault/wifi-password": (_path: string, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        state.calls.push("delete");
        if (!cell.elevated) {
          return jsonResponse(403, { detail: "write requires step-up auth" });
        }
        state.names = state.names.filter((n) => n !== "wifi-password");
        return okEnvelope({ name: "wifi-password" });
      }
      return jsonResponse(404, { detail: "not found" });
    },
  };
  return { cell, state, handlers };
}

beforeEach(() => {
  localStorage.setItem("pw_token", "test-token");
});

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function bootVault(world: ReturnType<typeof vaultWorld>) {
  mockFetchByRoute(world.handlers);
  const utils = screenProviders(<VaultScreen />);
  await waitFor(() => {
    expect(screen.queryByText(/Checking the vault…/)).toBeNull();
  });
  return utils;
}

async function unlockThroughUI(_world: ReturnType<typeof vaultWorld>) {
  fireEvent.change(screen.getByLabelText("Master passphrase"), {
    target: { value: "correct horse battery staple" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Unlock vault" }));
  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Lock vault" })).toBeTruthy();
  });
}

describe("VaultScreen (T10, parity row 5)", () => {
  it("renders locked status as a canonical StatusChip and offers unlock", async () => {
    const world = vaultWorld();
    await bootVault(world);
    const chip = screen.getByText("not configured").closest(".chip");
    expect(chip?.getAttribute("data-status")).toBe("not_configured");
    expect(screen.getByLabelText("Master passphrase")).toBeTruthy();
    // Locked vault: no names list, no set form.
    expect(screen.queryByText("Stored secrets")).toBeNull();
    expect(screen.queryByText("Store a secret")).toBeNull();
  });

  it("unlock: POST /api/vault/unlock flips status, shows names, announces via LiveRegion", async () => {
    const world = vaultWorld();
    await bootVault(world);
    await unlockThroughUI(world);
    expect(world.state.calls).toContain("unlock");
    expect(world.state.locked).toBe(false);
    // Names load in the follow-up effect (the names query enables
    // once the fresh status re-renders): one waitFor tick, then the
    // name (never the value) is on screen.
    await waitFor(() => {
      expect(screen.getByText("provider-api-key")).toBeTruthy();
    });
    const region = document.querySelector("[data-pw-live-region]");
    expect(region?.textContent).toContain("Vault unlocked");
  });

  it("lock: POST /api/vault/lock seals the vault and announces via LiveRegion", async () => {
    const world = vaultWorld();
    await bootVault(world);
    await unlockThroughUI(world);
    fireEvent.click(screen.getByRole("button", { name: "Lock vault" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Master passphrase")).toBeTruthy();
    });
    expect(world.state.locked).toBe(true);
    const region = document.querySelector("[data-pw-live-region]");
    expect(region?.textContent).toContain("Vault locked");
  });

  it("unlock failure announces an error and keeps the vault locked", async () => {
    const world = vaultWorld();
    mockFetchByRoute({
      ...world.handlers,
      "/api/vault/unlock": () => jsonResponse(403, { detail: "bad passphrase" }),
    });
    screenProviders(<VaultScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Checking the vault…/)).toBeNull();
    });
    fireEvent.change(screen.getByLabelText("Master passphrase"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Unlock vault" }));
    await waitFor(() => {
      const region = document.querySelector("[data-pw-live-region]");
      expect(region?.textContent).toContain("Unlock failed");
    });
    expect(world.state.locked).toBe(true);
  });

  it("set: step-up prompt opens on 403, store succeeds after continue, value never rendered", async () => {
    const world = vaultWorld();
    await bootVault(world);
    await unlockThroughUI(world);
    fireEvent.change(screen.getByLabelText("Secret name"), {
      target: { value: "new-secret" },
    });
    fireEvent.change(screen.getByLabelText("Secret value"), {
      target: { value: "super-secret-value-xyz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Store secret" }));
    // 403 → StepUpPrompt; continue re-sends with the step-up header.
    await screen.findByText("Confirm this action");
    world.cell.elevated = true;
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => {
      expect(world.state.names).toContain("new-secret");
    });
    expect(screen.getByText("new-secret")).toBeTruthy();
    // SECURITY: the stored VALUE text must never appear in the DOM.
    expect(screen.queryByText("super-secret-value-xyz")).toBeNull();
    // The value input was cleared after storing.
    expect(screen.getByLabelText("Secret value")).toHaveProperty("value", "");
  });

  it("set: the write request carries X-PW-StepUp through the single path", async () => {
    const world = vaultWorld();
    let setHeaders: Headers | null = new Headers();
    mockFetchByRoute({
      ...world.handlers,
      "/api/vault/set": (path: string, init?: RequestInit) => {
        setHeaders = new Headers(init?.headers);
        world.cell.elevated = true; // accept on first try for this test
        return (world.handlers as Record<string, (p: string, i?: RequestInit) => Response>)["/api/vault/set"](path, init);
      },
    });
    screenProviders(<VaultScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Checking the vault…/)).toBeNull();
    });
    await unlockThroughUI(world);
    fireEvent.change(screen.getByLabelText("Secret name"), {
      target: { value: "header-check" },
    });
    fireEvent.change(screen.getByLabelText("Secret value"), {
      target: { value: "irrelevant" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Store secret" }));
    await waitFor(() => {
      expect(world.state.names).toContain("header-check");
    });
    expect(setHeaders?.get("X-PW-StepUp")).toBe("1");
  });

  it("delete: danger Dialog names the verb + consequence; confirm deletes through step-up", async () => {
    const world = vaultWorld();
    let deleteHeaders: Headers | null = new Headers();
    mockFetchByRoute({
      ...world.handlers,
      "/api/vault/wifi-password": (path: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          deleteHeaders = new Headers(init?.headers);
          world.cell.elevated = true; // accept on first try for this test
          return (world.handlers as Record<string, (p: string, i?: RequestInit) => Response>)["/api/vault/wifi-password"](path, init);
        }
        return jsonResponse(404, { detail: "not found" });
      },
    });
    screenProviders(<VaultScreen />);
    await waitFor(() => {
      expect(screen.queryByText(/Checking the vault…/)).toBeNull();
    });
    await unlockThroughUI(world);
    // Names render in the follow-up effect (see unlock test).
    const deleteBtn = await screen.findByRole("button", {
      name: "Delete secret wifi-password",
    });
    fireEvent.click(deleteBtn);
    // Danger dialog: verb label + consequence, initial focus on Cancel.
    expect(screen.getByText("Delete this secret?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete secret" })).toBeTruthy();
    expect(screen.getByText(/removes it permanently from the vault/)).toBeTruthy();
    expect(document.activeElement?.textContent).toBe("Cancel");
    fireEvent.click(screen.getByRole("button", { name: "Delete secret" }));
    await waitFor(() => {
      expect(world.state.names).not.toContain("wifi-password");
    });
    expect(deleteHeaders?.get("X-PW-StepUp")).toBe("1");
    expect(screen.queryByText("wifi-password")).toBeNull();
  });

  it("delete cancel leaves the secret stored", async () => {
    const world = vaultWorld();
    await bootVault(world);
    await unlockThroughUI(world);
    // Names render in the follow-up effect (see unlock test): wait
    // for the delete control before driving it.
    const deleteBtn = await screen.findByRole("button", {
      name: "Delete secret provider-api-key",
    });
    fireEvent.click(deleteBtn);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      // The dialog element stays mounted (native semantics) — assert it
      // is CLOSED, not unmounted.
      const dialog = document.querySelector("dialog[data-pw-dialog='danger']");
      expect(dialog?.hasAttribute("open")).toBe(false);
    });
    expect(world.state.names).toContain("provider-api-key");
  });

  it("honest state when the vault read fails", async () => {
    mockFetchByRoute({
      "/api/vault/status": () => jsonResponse(500, { detail: "vault unreachable" }),
    });
    screenProviders(<VaultScreen />);
    await screen.findByText(/could not reach the vault/);
    expect(screen.getByText(/vault unreachable/)).toBeTruthy();
    expect(screen.getByText(/rest of your world still works/)).toBeTruthy();
  });

  it("values are never rendered even while unlocked (names-only assertion)", async () => {
    const world = vaultWorld();
    await bootVault(world);
    await unlockThroughUI(world);
    const html = document.body.innerHTML;
    // No plausible secret-shape text anywhere on the vault screen.
    expect(html).not.toContain("s3cret");
    expect(html).not.toMatch(/(value|secret)="?[A-Za-z0-9+/]{20,}={0,2}/i);
    // The only "secret" words are the honest labels.
    expect(screen.getByText("Stored secrets")).toBeTruthy();
  });

  it("axe: 0 violations (color-contrast disabled)", async () => {
    const world = vaultWorld();
    const { container } = await bootVault(world);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } } as never)).toHaveNoViolations();
    await unlockThroughUI(world);
    expect(await axe(container, { rules: { "color-contrast": { enabled: false } } } as never)).toHaveNoViolations();
  });
});
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import { StepUpPrompt, useStepUp } from "../primitives/StepUpPrompt";
import { ApiError, unlockVault, setLoginNavigation } from "../lib/api";

/**
 * axe rule disable (jsdom limit only — mirrors T7 specs):
 * color-contrast cannot evaluate without real rendered layout.
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/**
 * T8 StepUpPrompt spec (FOUNDATION-SPEC §5 StepUpPrompt row, §1.5).
 *
 * The prompt is UX-only: it explains WHY elevation is needed, names the
 * action, and on confirm re-runs the guarded function (which re-sends
 * the step-up header through api.ts's single withStepUp header path —
 * asserted here against the REAL unlockVault api.ts function, not a
 * duplicate mechanism).
 *
 * Integration is tested against the real 403 → step_up_required mapping
 * (T6 api.ts): a fetch mock returns the exact server response api.py's
 * require_step_up raises ("write requires step-up auth").
 */

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function Host({
  fn,
  onElevated,
}: {
  fn: () => Promise<string>;
  onElevated?: () => void;
}) {
  const { withStepUp, prompt } = useStepUp();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void withStepUp(fn)
            .then(() => onElevated?.())
            .catch(() => {
              /* rejection is the host's problem; the prompt is the contract */
            });
        }}
      >
        do action
      </button>
      {prompt}
    </>
  );
}

beforeEach(() => {
  setLoginNavigation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  setLoginNavigation((path) => window.location.assign(path));
  localStorage.clear();
});

describe("StepUpPrompt (T8)", () => {
  it("renders a dialog preset naming the action and the WHY (no OK/Yes)", async () => {
    const onElevated = vi.fn();
    const { container } = render(
      <StepUpPrompt
        action="Save preference"
        reason="This change modifies your world settings."
        onElevated={onElevated}
        open
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Confirm this action" })).toBeTruthy();
    expect(
      screen.getByText(
        "This change modifies your world settings. Confirm to continue with: Save preference."
      )
    ).toBeTruthy();
    const confirm = screen.getByRole("button", { name: "Continue" });
    expect(confirm.textContent).not.toBe("OK");
    expect(confirm.textContent).not.toBe("Yes");
    expect(confirm.textContent).not.toBe("Proceed");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("FLOW: 403 step_up_required → prompt opens → confirm → fn re-run succeeds", async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new ApiError(403, "step_up_required", "write requires step-up auth", {
          detail: "write requires step-up auth",
        });
      }
      return "saved";
    });
    const onElevated = vi.fn();
    render(<Host fn={fn} onElevated={onElevated} />);

    // first attempt fails into the prompt
    fireEvent.click(screen.getByRole("button", { name: "do action" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Confirm this action" })).toBeTruthy()
    );
    expect(screen.getByText(/Confirm to continue with/)).toBeTruthy();

    // confirm → fn re-run → success
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(onElevated).toHaveBeenCalledTimes(1));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("heading", { name: "Confirm this action" })).toBeNull();
  });

  it("FLOW: cancel rejects without re-running fn", async () => {
    let calls = 0;
    const fn = async () => {
      calls += 1;
      throw new ApiError(403, "step_up_required", "write requires step-up auth");
    };
    render(<Host fn={fn} />);
    fireEvent.click(screen.getByRole("button", { name: "do action" }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Confirm this action" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("heading", { name: "Confirm this action" })).toBeNull());
    expect(calls).toBe(1);
  });

  it("does NOT open the prompt for other errors (forbidden, network)", async () => {
    const fn = vi.fn(async () => {
      throw new ApiError(403, "forbidden", "admin only");
    });
    render(<Host fn={fn} />);
    fireEvent.click(screen.getByRole("button", { name: "do action" }));
    await waitFor(() => expect(fn).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Confirm this action" })).toBeNull();
  });

  it("INTEGRATION: real api.ts write (unlockVault) — 403 detail maps to step_up_required, confirm re-sends the step-up header", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    // call 1: server 403 step-up (api.py require_step_up response shape)
    fetchMock.mockResolvedValueOnce(
      jsonResponse(403, { detail: "write requires step-up auth" })
    );
    // call 2: success after the user confirms (header now honored)
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { ok: true, data: {} }));

    localStorage.setItem("pw_token", "transition-token");
    render(
      <Host
        fn={() => unlockVault("passphrase").then(() => "unlocked")}
        onElevated={() => undefined}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "do action" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Confirm this action" })).toBeTruthy()
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    for (const [, init] of fetchMock.mock.calls as Array<[string, RequestInit]>) {
      // the step-up header attach is api.ts's single mechanism (T6)
      expect(new Headers(init.headers).get("X-PW-StepUp")).toBe("1");
    }
    // wait for the host promise to settle (no unhandled rejection)
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Confirm this action" })).toBeNull()
    );
  });

  it("stores and displays no credentials; no remember-me anywhere", () => {
    const { container } = render(
      <StepUpPrompt
        action="Lock vault"
        reason="Vault changes need confirmation."
        open
        onElevated={() => {}}
      />
    );
    expect(container.querySelector("input[type='password']")).toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(container.textContent).not.toMatch(/remember/i);
    // nothing written to storage by rendering the prompt
    expect(localStorage.getItem("pw_token")).toBeNull();
    expect(localStorage.getItem("pw_stepup")).toBeNull();
  });

  it("axe: 0 violations on the prompt dialog", async () => {
    const { container } = render(
      <StepUpPrompt
        action="Delete secret"
        reason="This cannot be undone."
        open
        onElevated={() => {}}
      />
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });
});
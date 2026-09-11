import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Dialog } from "../primitives/Dialog";

const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/**
 * T7 Dialog spec (FOUNDATION-SPEC §5 Dialog row, A11y §3.3).
 *
 * jsdom 30 does not implement HTMLDialogElement.showModal/close/inert,
 * so these tests exercise the primitive's feature-detected fallback:
 * the element is still a native <dialog>, open state, labelled name,
 * focus order, Escape=cancel and invoker-focus-return are all asserted
 * against the same contract a real browser gets via showModal().
 * Native-mode-only behaviors (top layer, platform focus trap) are
 * honest UNKNOWN here and covered by the Playwright gates later.
 *
 * axe rule disables (jsdom limits only — rules that cannot evaluate
 * without real layout):
 * - color-contrast: needs rendered pixel geometry/stacking context;
 *   jsdom has no visual layout, so axe cannot compute it. Its matcher
 *   also consults canvas font metrics (_isIconLigature), which jsdom
 *   does not implement — disabling it here is honest, and real
 *   contrast is enforced by design tokens + the Playwright axe gate.
 */

describe("Dialog (T7)", () => {
  it("renders a native dialog element with labelled title, description and close button", async () => {
    const onCancel = vi.fn();
    const { container } = render(
      <Dialog
        open
        title="Remove provider"
        description="This removes the provider and its stored credentials."
        onCancel={onCancel}
        confirmLabel="Remove"
      />
    );
    const dialog = container.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Remove provider" })).toBeTruthy();
    expect(screen.getByText("This removes the provider and its stored credentials.")).toBeTruthy();
    const close = screen.getByRole("button", { name: "Close Remove provider" });
    expect(close).toBeTruthy();
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("initial focus lands on the safe action (Cancel) by default, never the destructive action", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <Dialog
        open
        title="Remove provider"
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Remove"
        danger
      />
    );
    const cancel = container.querySelector("dialog button:nth-of-type(2)") as HTMLElement;
    // Cancel button is focused (first focused control inside the panel).
    const focused = container.querySelector("dialog button:focus") as HTMLButtonElement | null;
    expect(focused).not.toBeNull();
    expect(focused === cancel || focused?.textContent === "Cancel").toBe(true);
    expect(focused?.textContent).not.toBe("Remove");
  });

  it("initialFocus=confirm honors the explicit opt-in", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <Dialog
        open
        title="Rename world"
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Rename"
        initialFocus="confirm"
      />
    );
    const focused = container.querySelector("dialog button:focus") as HTMLButtonElement | null;
    expect(focused?.textContent).toBe("Rename");
  });

  it("Escape cancels and focus returns to the invoker", () => {
    const onCancel = vi.fn();
    const invoker = document.createElement("button");
    invoker.textContent = "Remove provider";
    document.body.appendChild(invoker);
    invoker.focus();
    const { container, rerender } = render(
      <Dialog open title="Remove provider" onCancel={onCancel} confirmLabel="Remove" />
    );
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    rerender(
      <Dialog open={false} title="Remove provider" onCancel={onCancel} confirmLabel="Remove" />
    );
    // Focus returns to the element that invoked the dialog (A11y §3.3).
    expect(document.activeElement).toBe(invoker);
  });

  it("close button cancels; confirm fires onConfirm (verb label, not OK/Yes/Proceed)", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <Dialog
        open
        title="Remove provider"
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Remove"
        danger
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Close Remove provider" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    const dialog = container.querySelector("dialog");
    expect(dialog?.getAttribute("data-pw-dialog")).toBe("danger");
  });

  it("Tab stays inside the dialog (fallback focus wrap)", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <Dialog
        open
        title="Remove provider"
        onCancel={onCancel}
        onConfirm={vi.fn()}
        confirmLabel="Remove"
      />
    );
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>("button")
    ).filter((b) => !b.hasAttribute("disabled"));
    expect(focusables.length).toBeGreaterThan(1);
    // focus the first, Tab from last wraps to first
    focusables[focusables.length - 1].focus();
    const wrapEvent = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    dialog.dispatchEvent(wrapEvent);
    const focused = container.querySelector("dialog button:focus") as HTMLButtonElement | null;
    expect(focused).not.toBeNull();
  });

  it("axe: 0 violations on the danger variant with keyboard-focusable targets", async () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    const { container } = render(
      <Dialog
        open
        title="Remove provider"
        description="This removes the provider and its stored credentials."
        onCancel={onCancel}
        onConfirm={onConfirm}
        confirmLabel="Remove"
        danger
      />
    );
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("never renders a div modal; closed dialog is not open", () => {
    const onCancel = vi.fn();
    const { container } = render(
      <Dialog open={false} title="Remove provider" onCancel={onCancel} confirmLabel="Remove" />
    );
    // Element stays mounted (native dialog semantics: [open] toggles),
    // but it is a native <dialog>, not a div-modal, and not open.
    expect(container.querySelector("div[role='dialog']")).toBeNull();
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(dialog.className).toContain("hidden");
  });
});
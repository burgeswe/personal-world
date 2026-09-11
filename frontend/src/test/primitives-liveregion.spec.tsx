import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import {
  LiveRegionProvider,
  useAnnounce,
  type AnnounceKind,
} from "../primitives/LiveRegion";

/**
 * axe rule disable (jsdom limit only): color-contrast cannot evaluate
 * without real rendered layout (jsdom has no visual output; its
 * matcher also consults canvas font metrics). Real contrast is
 * enforced by tokens + the Playwright axe gate.
 */
const axeNoContrast = (el: Element) =>
  axe(el, { rules: { "color-contrast": { enabled: false } } } as never);

/**
 * T7 LiveRegion spec (FOUNDATION-SPEC §5 LiveRegion row, A11y §8).
 *
 * Batching semantics (fake timers make the 30 s window deterministic):
 * - 3 messages inside one window merge into "3 updates: …" exactly once
 *   when the window closes;
 * - a message after the window expired starts a separate batch;
 * - same key inside the window dedupes;
 * - kinds outside the allow-list are ignored (poll ticks, timestamps,
 *   provider observations, companion states can never announce);
 * - exactly one app-level status region exists.
 */

function AnnounceProbe({
  message,
  kind,
  key,
}: {
  message: string;
  kind: AnnounceKind;
  key?: string;
}) {
  const { announce } = useAnnounce();
  return (
    <button
      type="button"
      onClick={() => announce(message, { kind, key })}
    >
      announce
    </button>
  );
}

describe("LiveRegion (T7)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders exactly one app-level polite atomic status region", async () => {
    // axe cannot run under fake timers (it awaits internal timeouts),
    // so this async assertion uses real timers.
    vi.useRealTimers();
    const { container } = render(
      <LiveRegionProvider>
        <p>content</p>
      </LiveRegionProvider>
    );
    const regions = container.querySelectorAll("[role='status']");
    expect(regions.length).toBe(1);
    const region = regions[0];
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    expect(await axeNoContrast(container)).toHaveNoViolations();
  });

  it("3 messages inside one 30s window merge into '3 updates: …' when the window closes", () => {
    const { container } = render(
      <LiveRegionProvider>
        <ThreeAnnouncer />
      </LiveRegionProvider>
    );
    const region = container.querySelector("[role='status']") as HTMLElement;
    const buttons = screen.getAllByRole("button", { name: "announce" });
    act(() => {
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);
      fireEvent.click(buttons[2]);
    });
    expect(region.textContent).toBe("3 updates: Health changed; Attention resolved; Action completed");
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    // window closed, batch flushed — merged text stays stable
    expect(region.textContent).toBe("3 updates: Health changed; Attention resolved; Action completed");
  });

  it("a message after the window expired starts a separate batch", () => {
    const { container } = render(
      <LiveRegionProvider>
        <AnnounceProbe message="Health changed" kind="health_change" key="health-a" />
        <AnnounceProbe message="Attention resolved" kind="attention_resolved" key="attention-b" />
      </LiveRegionProvider>
    );
    const region = container.querySelector("[role='status']") as HTMLElement;
    const buttons = screen.getAllByRole("button", { name: "announce" });
    act(() => {
      fireEvent.click(buttons[0]);
    });
    act(() => {
      vi.advanceTimersByTime(31_000);
    });
    expect(region.textContent).toBe("Health changed");
    act(() => {
      fireEvent.click(buttons[1]);
    });
    // new window, separate batch
    expect(region.textContent).toBe("Attention resolved");
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(region.textContent).toBe("Attention resolved");
  });

  it("dedupes by key inside the window", () => {
    const { container } = render(
      <LiveRegionProvider>
        <AnnounceProbe message="Provider responded" kind="action_completed" key="provider-x" />
        <AnnounceProbe message="Provider responded" kind="action_completed" key="provider-x" />
      </LiveRegionProvider>
    );
    const region = container.querySelector("[role='status']") as HTMLElement;
    const buttons = screen.getAllByRole("button", { name: "announce" });
    act(() => {
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);
    });
    expect(region.textContent).toBe("Provider responded");
  });

  it("ignores kinds outside the allow-list (no poll/timestamp/provider/companion announcements)", () => {
    const { container } = render(
      <LiveRegionProvider>
        <AnnounceProbe message="Poll tick" kind={"poll_tick" as AnnounceKind} />
        <AnnounceProbe message="12:34:56" kind={"timestamp" as AnnounceKind} />
        <AnnounceProbe message="Provider observed" kind={"provider_observation" as AnnounceKind} />
        <AnnounceProbe message="Companion is thinking" kind={"companion_state" as AnnounceKind} />
      </LiveRegionProvider>
    );
    const region = container.querySelector("[role='status']") as HTMLElement;
    const buttons = screen.getAllByRole("button", { name: "announce" });
    act(() => {
      for (const b of buttons) fireEvent.click(b);
      vi.advanceTimersByTime(30_000);
    });
    expect(region.textContent).toBe("");
  });

  it("announces a single allowed message immediately (no merge needed)", () => {
    const { container } = render(
      <LiveRegionProvider>
        <AnnounceProbe message="Journal saved" kind="action_completed" key="journal-save" />
      </LiveRegionProvider>
    );
    const region = container.querySelector("[role='status']") as HTMLElement;
    fireEvent.click(screen.getByRole("button", { name: "announce" }));
    expect(region.textContent).toBe("Journal saved");
  });

  it("useAnnounce without a provider throws an honest error", () => {
    const Probe = () => {
      useAnnounce();
      return null;
    };
    expect(() => render(<Probe />)).toThrow(/LiveRegionProvider/);
  });
});

function ThreeAnnouncer() {
  const { announce } = useAnnounce();
  return (
    <>
      <button type="button" onClick={() => announce("Health changed", { kind: "health_change", key: "h" })}>
        announce
      </button>
      <button
        type="button"
        onClick={() => announce("Attention resolved", { kind: "attention_resolved", key: "a" })}
      >
        announce
      </button>
      <button
        type="button"
        onClick={() => announce("Action completed", { kind: "action_completed", key: "c" })}
      >
        announce
      </button>
    </>
  );
}
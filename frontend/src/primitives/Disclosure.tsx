import * as React from "react";
import { cn } from "../lib/utils";

/**
 * Disclosure (P1 T8, FOUNDATION-SPEC §5): native <details><summary> with
 * aria-controls; levels 1–4 (glance → technical) nest; the summary is a
 * ≥44px target (A11y §2.1). Level 1 (glance) truth is always rendered
 * outside the disclosure — the disclosure only hides progressive detail,
 * never the Level-1 answer (A11y §4.6).
 *
 * Implementation note (honest in both environments): the component is
 * CONTROLLED. jsdom implements the summary click toggle but not
 * summary keyboard activation, so the primitive handles Enter/Space
 * itself; preventDefault on click makes the identical code path run in
 * real browsers and jsdom, and keeps state as single React truth.
 *
 * Motion: reveal is instant attribute toggling — no animation beyond
 * the motion tier (spec §5 Disclosure "must not").
 */

export type DisclosureLevel = 1 | 2 | 3 | 4;

const LEVEL_LABELS: Record<DisclosureLevel, string> = {
  1: "glance",
  2: "detail",
  3: "diagnostic",
  4: "technical",
};

let disclosureSequence = 0;

function nextDisclosureId(): string {
  disclosureSequence += 1;
  return `pw-disclosure-${disclosureSequence}`;
}

export interface DisclosureProps {
  summary: string;
  level: DisclosureLevel;
  defaultOpen?: boolean;
  children?: React.ReactNode;
}

export function Disclosure({
  summary,
  level,
  defaultOpen = false,
  children,
}: DisclosureProps) {
  const [open, setOpen] = React.useState(defaultOpen);
  const idRef = React.useRef<string | null>(null);
  if (idRef.current === null) idRef.current = nextDisclosureId();
  const id = idRef.current;

  const toggle = React.useCallback(() => setOpen((v) => !v), []);

  return (
    <details
      open={open}
      data-pw-disclosure-level={level}
      className={cn(
        "rounded-lg border border-[var(--pw-color-border-subtle)]",
        "bg-[var(--pw-color-surface-panel)]"
      )}
    >
      <summary
        id={id}
        aria-controls={`${id}-content`}
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          toggle();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggle();
          }
        }}
        className={cn(
          "flex min-h-[var(--pw-target-minimum)] cursor-pointer list-none items-center",
          "gap-2 px-[var(--pw-spacing-loose)] py-[var(--pw-spacing-normal)]",
          "text-[var(--pw-color-text-primary)] font-medium",
          "focus-visible:outline-[var(--pw-focus-ring)] focus-visible:outline-2 focus-visible:outline-offset-2"
        )}
      >
        <span className="text-[var(--pw-color-text-muted)]" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
        <span>
          {summary}
          <span className="sr-only"> (level {level}: {LEVEL_LABELS[level]})</span>
        </span>
      </summary>
      <div
        id={`${id}-content`}
        role="region"
        aria-labelledby={id}
        className="px-[var(--pw-spacing-loose)] pb-[var(--pw-spacing-normal)] text-[var(--pw-color-text-secondary)]"
        hidden={!open}
      >
        {children}
      </div>
    </details>
  );
}

export interface TechnicalDetailsProps {
  /** Provider name (e.g. the adapter that served the data). */
  provider?: string;
  /** Model identifier where one applies (e.g. reasoning provider). */
  model?: string;
  /** Latency of the observation, already human-formatted by the caller. */
  latency?: string;
  /** Raw payload fragment; rendered as monospace text. */
  raw?: string;
  defaultOpen?: boolean;
}

/**
 * TechnicalDetails: the Level 4 preset. Provider, model, latency, raw
 * (FOUNDATION-SPEC §5 Disclosure row). Each part renders only when
 * present; a Level-4 disclosure never carries the only copy of Level-1
 * truth (the host renders that outside).
 */
export function TechnicalDetails({
  provider,
  model,
  latency,
  raw,
  defaultOpen = false,
}: TechnicalDetailsProps) {
  return (
    <Disclosure summary="Technical details" level={4} defaultOpen={defaultOpen}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        {provider ? (
          <>
            <dt className="text-[var(--pw-color-text-muted)]">Provider</dt>
            <dd>{provider}</dd>
          </>
        ) : null}
        {model ? (
          <>
            <dt className="text-[var(--pw-color-text-muted)]">Model</dt>
            <dd>{model}</dd>
          </>
        ) : null}
        {latency ? (
          <>
            <dt className="text-[var(--pw-color-text-muted)]">Latency</dt>
            <dd>{latency}</dd>
          </>
        ) : null}
        {raw ? (
          <>
            <dt className="text-[var(--pw-color-text-muted)]">Raw</dt>
            <dd className="overflow-x-auto whitespace-pre-wrap font-mono text-xs">
              {raw}
            </dd>
          </>
        ) : null}
      </dl>
    </Disclosure>
  );
}
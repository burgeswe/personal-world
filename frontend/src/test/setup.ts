import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "vitest-axe/dist/matchers";
// Type-side augmentation for the matcher (runtime side is registered below).
import "vitest-axe/extend-expect";

afterEach(() => {
  cleanup();
});

expect.extend({ toHaveNoViolations });
import { afterEach, expect } from "vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "vitest-axe/dist/matchers";

afterEach(() => {
  cleanup();
});

expect.extend({ toHaveNoViolations });
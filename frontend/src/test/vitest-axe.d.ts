import "vitest/globals";

declare module "vitest" {
  interface Assertion {
    toHaveNoViolations(): void;
  }
}

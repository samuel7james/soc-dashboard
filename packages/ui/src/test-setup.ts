import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// This repo doesn't run vitest with `globals: true`, so Testing Library's
// own auto-cleanup (which detects a global `afterEach`) never registers —
// without this, every render in a test file stays mounted to the jsdom
// `document` and leaks into the next test's queries.
afterEach(() => {
  cleanup();
});

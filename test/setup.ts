import '@testing-library/jest-dom/vitest';
import { cleanup } from '@solidjs/testing-library';
import { afterEach, vi } from 'vitest';

// Vitest globals are off, so testing-library cannot register its own teardown.
// Without this every render stacks up and queries find the previous test's DOM.
afterEach(cleanup);

// jsdom ships neither of these, and both are load-bearing in the real page.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  } as unknown as typeof ResizeObserver;
}
if (!globalThis.matchMedia) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {}, dispatchEvent: () => false,
  }));
}

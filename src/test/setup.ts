import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IndexedDB for Dexie
// This is a minimal mock - in real tests you might want to use fake-indexeddb
const mockIDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
};

// @ts-ignore
global.indexedDB = mockIDB;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch
global.fetch = vi.fn();

// Suppress console.error in tests (optional)
// vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock canvas for html-to-image
HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation((callback) => {
  callback(new Blob(['mock'], { type: 'image/png' }));
});
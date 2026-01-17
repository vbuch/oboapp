/**
 * Global type augmentations
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export {};

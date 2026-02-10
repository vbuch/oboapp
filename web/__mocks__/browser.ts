import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * MSW browser worker for development
 * Intercepts network requests in the browser and returns mock responses
 */
export const worker = setupWorker(...handlers);

// This file extends zod with OpenAPI before any schemas are created.
// All schema files should import from this file instead of directly from "zod"
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extend zod globally with OpenAPI support
extendZodWithOpenApi(z);

// Re-export the extended z for use in schema definitions
export { z };

// This file ensures zod is extended with OpenAPI before any schemas are created.
// Import this file first in any module that needs OpenAPI-enabled schemas.

import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

// Extend zod globally - this must happen before any schema is created
extendZodWithOpenApi(z);

// Re-export the extended z for use in this project
export { z };

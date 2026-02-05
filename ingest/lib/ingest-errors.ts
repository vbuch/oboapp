import type { IngestError, IngestErrorType } from "@/lib/types";
import { logger } from "@/lib/logger";

export interface IngestErrorRecorder {
  warn: (text: string) => void;
  error: (text: string) => void;
  exception: (text: string) => void;
}

export interface IngestErrorCollector extends IngestErrorRecorder {
  entries: IngestError[];
  record: (type: IngestErrorType, text: string) => void;
}

export const formatIngestErrorText = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
};

export const truncateIngestPayload = (
  text: string,
  maxLength: number,
): { summary: string; originalLength: number } => {
  const originalLength = text.length;

  if (originalLength <= maxLength) {
    return { summary: text, originalLength };
  }

  return {
    summary: `${text.slice(0, maxLength)}…`,
    originalLength,
  };
};

export function createIngestErrorCollector(): IngestErrorCollector {
  const entries: IngestError[] = [];

  const record = (type: IngestErrorType, text: string) => {
    entries.push({ text, type });
  };

  const warn = (text: string) => {
    logger.warn(text, { component: "ingest" });
    record("warning", text);
  };

  const error = (text: string) => {
    logger.error(text, { component: "ingest" });
    record("error", text);
  };

  const exception = (text: string) => {
    logger.error(text, { component: "ingest", errorType: "exception" });
    record("exception", text);
  };

  return {
    entries,
    record,
    warn,
    error,
    exception,
  };
}

export function getIngestErrorRecorder(
  collector?: IngestErrorRecorder | null,
): IngestErrorRecorder {
  if (collector) {
    return collector;
  }

  return {
    warn: (text: string) => {
      logger.warn(text, { component: "ingest" });
    },
    error: (text: string) => {
      logger.error(text, { component: "ingest" });
    },
    exception: (text: string) => {
      logger.error(text, { component: "ingest", errorType: "exception" });
    },
  };
}

export function buildIngestErrorsField(ingestErrors: IngestErrorCollector): {
  ingestErrors?: IngestErrorCollector["entries"];
} {
  return ingestErrors.entries.length > 0
    ? { ingestErrors: ingestErrors.entries }
    : {};
}

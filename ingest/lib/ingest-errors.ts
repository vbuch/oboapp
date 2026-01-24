import type { IngestError, IngestErrorType } from "@/lib/types";

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
    console.warn(text);
    record("warning", text);
  };

  const error = (text: string) => {
    console.error(text);
    record("error", text);
  };

  const exception = (text: string) => {
    console.error(text);
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
      console.warn(text);
    },
    error: (text: string) => {
      console.error(text);
    },
    exception: (text: string) => {
      console.error(text);
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

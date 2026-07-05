import type { BaseSourceDocument } from "../shared/types";

export interface SourceDocument extends BaseSourceDocument {
  sourceType: "sdvr-mvr-bg";
}

export type { PostLink } from "../shared/extractors";

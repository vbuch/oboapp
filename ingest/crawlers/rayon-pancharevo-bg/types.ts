import { BaseSourceDocument, PostLink } from "../shared/types";

export interface SourceDocument extends BaseSourceDocument {
  sourceType: "rayon--bg";
}

export type { PostLink };

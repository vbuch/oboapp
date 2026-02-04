import { GoogleGenAI } from "@google/genai";
import {
  formatIngestErrorText,
  getIngestErrorRecorder,
  type IngestErrorRecorder,
} from "./ingest-errors";

let ai: GoogleGenAI | null = null;

/**
 * Gets or creates the Gemini AI client instance
 */
function getAiClient(): GoogleGenAI {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY || "" });
  }
  return ai;
}

export interface GeminiApiOptions {
  readonly model: string;
  readonly contents: string;
  readonly systemInstruction: string;
}

/**
 * Calls the Gemini API with the provided options
 */
export async function callGeminiApi(
  options: GeminiApiOptions,
  ingestErrors?: IngestErrorRecorder,
): Promise<string | null> {
  const recorder = getIngestErrorRecorder(ingestErrors);

  try {
    const client = getAiClient();
    const response = await client.models.generateContent({
      model: options.model,
      contents: options.contents,
      config: {
        systemInstruction: options.systemInstruction,
        responseMimeType: "application/json",
      },
    });

    return response.text || "";
  } catch (error) {
    recorder.error(`Error calling Gemini API: ${formatIngestErrorText(error)}`);
    return null;
  }
}

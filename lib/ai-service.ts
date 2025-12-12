import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExtractedData } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Read the prompt template once at module load time
let promptTemplate: string;
try {
  promptTemplate = readFileSync(
    join(process.cwd(), 'lib', 'prompts', 'data-extraction.md'),
    'utf-8'
  );
} catch (error) {
  console.error('Failed to load prompt template:', error);
  throw new Error('Prompt template file not found');
}

export async function extractAddresses(text: string): Promise<ExtractedData | null> {
  try {
    // Validate message
    if (!text || typeof text !== 'string') {
      console.error('Invalid text parameter for address extraction');
      return null;
    }

    // Validate message length
    if (text.length > 5000) {
      console.error('Text is too long for address extraction (max 5000 characters)');
      return null;
    }

    // Sanitize input to prevent prompt injection
    const sanitizedText = text.replace(/[\n\r]/g, ' ').trim();

    // Construct the prompt by appending the sanitized message to the template
    const prompt = promptTemplate + sanitizedText;

    // Validate required environment variable
    const model = process.env.GOOGLE_AI_MODEL;
    if (!model) {
      console.error('GOOGLE_AI_MODEL environment variable is not set');
      return null;
    }

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    const responseText = response.text || '';

    // Log the response from Gemini API after address extraction
    console.log('Address extraction completed. AI Response:', responseText);

    // Parse the JSON response to extract the full structured data
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsedResponse = JSON.parse(jsonMatch[0]);
        
        // Validate and filter pins array
        const validPins = Array.isArray(parsedResponse.pins) 
          ? parsedResponse.pins.filter((addr: any) => 
              typeof addr === 'string' && addr.trim().length > 0
            )
          : [];
        
        // Validate and filter streets array
        const validStreets = Array.isArray(parsedResponse.streets)
          ? parsedResponse.streets.filter((street: any) =>
              street &&
              typeof street === 'object' &&
              typeof street.street === 'string' &&
              typeof street.from === 'string' &&
              typeof street.to === 'string'
            )
          : [];
        
        // Validate and filter timespan array
        const validTimespan = Array.isArray(parsedResponse.timespan)
          ? parsedResponse.timespan.filter((time: any) =>
              time &&
              typeof time === 'object' &&
              typeof time.start === 'string' &&
              typeof time.end === 'string'
            )
          : [];
        
        // Return the full structured data
        const extractedData: ExtractedData = {
          responsible_entity: parsedResponse.responsible_entity || '',
          pins: validPins,
          streets: validStreets,
          timespan: validTimespan,
        };
        
        return extractedData;
      } catch (parseError) {
        console.error('Failed to parse JSON response from AI:', parseError);
        return null;
      }
    }

    return null;
  } catch (error) {
    console.error('Error extracting addresses:', error);
    return null;
  }
}

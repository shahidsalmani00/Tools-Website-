import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AppMode } from "../types";
import { memoryService } from "./memoryService";

// ============================================================================
//  SECURE API KEY CONFIGURATION
// ============================================================================
const getApiKey = (): string => {
  // 1. Check Standard Environment Variable (For Vercel/Netlify/Node)
  // @ts-ignore
  if (typeof process !== 'undefined' && process.env?.API_KEY) {
    // @ts-ignore
    return process.env.API_KEY;
  }
  
  // 2. Check Vite Environment Variable (For Local Development)
  // @ts-ignore
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_KEY) {
    // @ts-ignore
    return import.meta.env.VITE_API_KEY;
  }
  
  return "";
};

export const hasApiKey = (): boolean => {
  const key = getApiKey();
  return !!key && key.length > 0;
};

const getAiClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("API Key is missing. Please set API_KEY in your environment variables.");
  }
  return new GoogleGenAI({ apiKey });
};

// ============================================================================
//  RETRY LOGIC (QUOTA MANAGER)
// ============================================================================
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Detect Quota Exceeded (429)
    const isQuotaError = 
      error.status === 429 || 
      error.code === 429 || 
      (error.message && error.message.includes('429')) || 
      (error.message && error.message.includes('quota'));

    if (isQuotaError && retries > 0) {
      // Google usually asks for ~15 seconds wait. We wait 18s to be safe.
      const waitTime = 18000; 
      console.warn(`[PixFrog AI] Free Tier Quota Hit. Cooling down for ${waitTime/1000}s... (Attempts left: ${retries})`);
      
      await sleep(waitTime);
      return retryOperation(operation, retries - 1);
    }
    
    // Other temporary errors (503 Service Unavailable)
    if ((error.status === 503 || error.code === 503) && retries > 0) {
       await sleep(5000);
       return retryOperation(operation, retries - 1);
    }

    throw error;
  }
}

// ============================================================================
//  PROMPT ENGINEERING (Text)
// ============================================================================
const SYSTEM_INSTRUCTION_BASE = `
You are an expert Prompt Engineer for generative AI models. 
Your task is to take a raw user description and transform it into a professional, high-fidelity image generation prompt based on the selected "App Mode".

### CORE PRINCIPLE:
**Respect the User's Intent.** 
- The "App Mode" dictates the *style*, *composition*, and *technical settings*.
- The "User Input" dictates the *subject*, *action*, and *specific details*.

### IMPORTANT: TEXT RENDERING
If the user asks for text to be written, format it as: text "SALE", in bold typography.

### MODE STRATEGIES:
1. **YouTube Thumbnail** (${AppMode.THUMBNAIL}): High CTR, vibrant, expressive.
2. **Logo Design** (${AppMode.LOGO}): Vector art, minimalist, white background.
3. **Background Remover** (${AppMode.BG_REMOVER}): Isolated on solid white background.
4. **Social Banner** (${AppMode.BANNER}): Wide angle, aesthetic.
5. **Poster** (${AppMode.POSTER}): Vertical, cinematic.
6. **Avatar** (${AppMode.AVATAR}): Headshot, centered.
7. **General** (${AppMode.GENERAL}): High quality digital art.

### OUTPUT FORMAT:
Return ONLY the final refined prompt string.
`;

export const refinePrompt = async (userInput: string, mode: AppMode, hasImages: boolean = false): Promise<string> => {
  return retryOperation(async () => {
    try {
      const ai = getAiClient();
      const learnedContext = memoryService.recall(mode);
      
      const context = hasImages 
        ? `Task: Image-to-Image Prompt.\nApp Mode: ${mode}\nUser Input: "${userInput}"`
        : `Task: Text-to-Image Prompt.\nApp Mode: ${mode}\nUser Input: "${userInput}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash', 
        contents: context,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_BASE + learnedContext,
          temperature: 0.7,
        },
      });

      return response.text?.trim() || userInput;
    } catch (error) {
      console.warn("Prompt refinement skipped due to error, using raw input.");
      return userInput;
    }
  }, 1); 
};

// ============================================================================
//  IMAGE GENERATION
// ============================================================================

export const generateImage = async (
  prompt: string, 
  aspectRatio: string = '1:1',
  highQuality: boolean = false
): Promise<string | null> => {
  const ai = getAiClient();

  const attemptGen = async (usePro: boolean): Promise<string | null> => {
    return retryOperation(async () => {
        try {
            const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
            
            const config: any = {
                imageConfig: { aspectRatio: aspectRatio }
            };
            
            const response = await ai.models.generateContent({
                model: model,
                contents: { parts: [{ text: prompt }] },
                config: config
            });

            if (response.candidates && response.candidates[0].content.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData) {
                        return `data:image/png;base64,${part.inlineData.data}`;
                    }
                }
            }
            return null;
        } catch (error: any) {
            if (usePro) {
                console.warn(`Pro model failed (${error.message}). Falling back to Flash...`);
                return attemptGen(false);
            }
            throw error; 
        }
    }, 2);
  };

  return attemptGen(highQuality);
};

export const generateWithImages = async (
  base64Images: string[], 
  prompt: string,
  aspectRatio: string = '1:1'
): Promise<string | null> => {
  return retryOperation(async () => {
    try {
      const ai = getAiClient();
      const parts: any[] = [];

      base64Images.forEach((img) => {
        const mimeMatch = img.match(/^data:(image\/\w+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
        const cleanData = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

        parts.push({
          inlineData: { data: cleanData, mimeType: mimeType },
        });
      });

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image', 
        contents: { parts: parts },
        config: { imageConfig: { aspectRatio: aspectRatio } }
      });

       if (response.candidates && response.candidates[0].content.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData) {
            return `data:image/png;base64,${part.inlineData.data}`;
          }
        }
      }
      return null;
    } catch (error) {
      console.error("Error generating with images:", error);
      throw error;
    }
  }, 2);
};
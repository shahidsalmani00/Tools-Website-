import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { AppMode } from "../types";
import { memoryService } from "./memoryService";

// Helper to create a new client instance with the latest API key
const getAiClient = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION_BASE = `
You are an expert Prompt Engineer for generative AI models (Gemini Image / Imagen). 
Your task is to take a raw user description and transform it into a professional, high-fidelity image generation prompt based on the selected "App Mode".

### CORE PRINCIPLE:
**Respect the User's Intent.** 
- The "App Mode" dictates the *style*, *composition*, and *technical settings*.
- The "User Input" dictates the *subject*, *action*, and *specific details*.
- **DO NOT** remove specific details the user asked for (e.g., colors, specific objects, text).
- **DO NOT** add random elements that clutter the scene unless they enhance the specific mode's goal (e.g., sparkles for a magical request is fine, but not for a minimalist logo).

### IMPORTANT: TEXT RENDERING
If the user asks for text to be written (e.g., "says 'HELLO'", "with text 'SALE'"), you **MUST** format it in the prompt as: text "SALE", in bold typography.

### MODE-SPECIFIC STRATEGIES (Default Guidance):

1. **YouTube Thumbnail** (${AppMode.THUMBNAIL}):
   - **Goal**: High Click-Through Rate (CTR), exciting, vibrant, readable at small sizes.
   - **Keywords to Add**: "YouTube thumbnail", "4k resolution", "vibrant colors", "dramatic lighting", "expressive face", "rule of thirds", "action shot".
   - **Style**: High contrast, saturated.

2. **Logo Design** (${AppMode.LOGO}):
   - **Goal**: Professional, scalable, clean, simple.
   - **Keywords to Add**: "vector art", "minimalist logo", "flat design", "clean lines", "white background", "professional", "geometric", "illustrator style".
   - **Avoid**: Photorealism, complex shading, clutter.

3. **Background Remover / Product Shot** (${AppMode.BG_REMOVER}):
   - **Goal**: Isolate the subject perfectly.
   - **Keywords to Add**: "isolated on pure white background", "studio lighting", "product photography", "clean cut edges", "no background", "no shadows".
   - **Instruction**: The background must be SOLID WHITE.

4. **Social Media Banner** (${AppMode.BANNER}):
   - **Goal**: Wide aspect ratio, room for UI elements (avatars/buttons).
   - **Keywords to Add**: "social media banner", "panoramic", "wide angle", "header image", "aesthetic", "clean composition", "negative space".

5. **Poster Design** (${AppMode.POSTER}):
   - **Goal**: Vertical, impactful, cinematic.
   - **Keywords to Add**: "movie poster style", "vertical composition", "cinematic lighting", "visual hierarchy", "bold aesthetics", "marketing art".

6. **Profile Avatar** (${AppMode.AVATAR}):
   - **Goal**: Centered, clear face/subject, circular-crop friendly.
   - **Keywords to Add**: "headshot", "centered composition", "avatar style", "facing camera", "highly detailed", "distinctive style".

7. **General Generation** (${AppMode.GENERAL}):
   - **Goal**: High quality interpretation of the prompt.
   - **Keywords to Add**: "digital art", "detailed", "high quality".

### INSTRUCTIONS FOR IMAGE INPUTS (Remix/Edit):
- **If User provides specific text**: "Modify the image to match the description: [User Description]. Keep the main subject consistent if possible."
- **If User asks to remove background**: "Generate the exact same subject but on a solid white background."

### OUTPUT FORMAT:
Return ONLY the final refined prompt string. Do not add "Here is the prompt:" or quotes.
`;

/**
 * Refines a user's raw text input into a high-quality image generation prompt.
 * Uses SUPERVISED LEARNING (Memory) to inject past successful styles.
 */
export const refinePrompt = async (userInput: string, mode: AppMode, hasImages: boolean = false): Promise<string> => {
  try {
    const ai = getAiClient();
    
    // RECALL: Fetch learned patterns for this mode
    const learnedContext = memoryService.recall(mode);

    // If we have learned memory, we explicitly tell the AI to use it.
    const memoryDirective = learnedContext 
      ? `\n\n[IMPORTANT: MEMORY ACTIVE]\nThe user has established a style preference in the 'LEARNED USER STYLES' section above. You MUST prioritize those stylistic choices (colors, lighting, medium) over the default mode strategies, while still keeping the new SUBJECT from the user input below.`
      : "";

    const context = hasImages 
      ? `Task: Create a prompt for Image-to-Image generation.\nApp Mode: ${mode}${memoryDirective}\n\nCURRENT User Input: "${userInput}"\n(User has attached reference images to use)`
      : `Task: Create a prompt for Text-to-Image generation.\nApp Mode: ${mode}${memoryDirective}\n\nCURRENT User Input: "${userInput}"`;

    // combine system instruction with learned memory
    // We append the learnedContext to the system instruction so it sets the "Persona" of the prompt engineer
    const dynamicSystemInstruction = SYSTEM_INSTRUCTION_BASE + learnedContext;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: context,
      config: {
        systemInstruction: dynamicSystemInstruction,
        temperature: 0.7, // Slightly higher creativity to blend style + new subject
      },
    });

    return response.text?.trim() || userInput;
  } catch (error) {
    console.error("Error refining prompt:", error);
    return userInput;
  }
};

/**
 * Generates an image based on a prompt (Text-to-Image).
 * Includes automatic fallback from Pro to Flash model on failure.
 */
export const generateImage = async (
  prompt: string, 
  aspectRatio: string = '1:1',
  highQuality: boolean = false
): Promise<string | null> => {
  const ai = getAiClient();

  const attemptGen = async (usePro: boolean): Promise<string | null> => {
    try {
      const model = usePro ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
      
      const config: any = {
        imageConfig: {
          aspectRatio: aspectRatio,
        }
      };

      if (usePro) {
         config.imageConfig.imageSize = '2K';
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: {
          parts: [{ text: prompt }]
        },
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
        console.warn(`Generation with ${'gemini-3-pro-image-preview'} failed, falling back to flash. Error:`, error);
        return attemptGen(false);
      }
      console.error("Error generating image:", error);
      throw error;
    }
  };

  return attemptGen(highQuality);
};

/**
 * Generates/Edits an image using provided reference images (Image-to-Image / Compositing).
 */
export const generateWithImages = async (
  base64Images: string[], 
  prompt: string,
  aspectRatio: string = '1:1'
): Promise<string | null> => {
  try {
    const ai = getAiClient();
    const parts: any[] = [];

    // Add all images to the request parts
    base64Images.forEach((img) => {
      const mimeMatch = img.match(/^data:(image\/\w+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const cleanData = img.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

      parts.push({
        inlineData: {
          data: cleanData,
          mimeType: mimeType, 
        },
      });
    });

    parts.push({ text: prompt });

    // Use Flash Image for multimodal inputs
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: {
        parts: parts,
      },
      config: {
         imageConfig: {
            aspectRatio: aspectRatio
         }
      }
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
};
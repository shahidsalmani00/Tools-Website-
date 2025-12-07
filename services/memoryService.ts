import { AppMode } from "../types";

const STORAGE_KEY = 'pixfrog_brain_v1';

interface LearnedPattern {
  mode: AppMode;
  userInput: string;
  refinedPrompt: string;
  timestamp: number;
}

/**
 * Supervised Learning Module
 * "Teaches" the app by saving successful prompt pairs.
 */
export const memoryService = {
  /**
   * Save a successful interaction (User Input -> Final Prompt)
   * This mimics "learning" from a positive outcome.
   */
  learn: (mode: AppMode, userInput: string, refinedPrompt: string) => {
    try {
      const existingStr = localStorage.getItem(STORAGE_KEY);
      const brain: LearnedPattern[] = existingStr ? JSON.parse(existingStr) : [];
      
      // Avoid duplicates
      const isDuplicate = brain.some(b => b.userInput === userInput && b.refinedPrompt === refinedPrompt);
      if (isDuplicate) return;

      // Add new pattern
      brain.push({
        mode,
        userInput,
        refinedPrompt,
        timestamp: Date.now()
      });

      // Keep memory efficient (last 20 successful patterns per mode is usually enough context)
      // We filter global list to keep total size managed, but prioritization happens in recall
      if (brain.length > 100) {
        brain.shift();
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(brain));
      console.log(`[Supervised Learning] Learned new pattern for ${mode}`);
    } catch (e) {
      console.error("Failed to save to memory", e);
    }
  },

  /**
   * Recall relevant past successes to guide the AI.
   * This provides the "Context" for the AI to understand what works.
   */
  recall: (mode: AppMode): string => {
    try {
      const existingStr = localStorage.getItem(STORAGE_KEY);
      if (!existingStr) return "";

      const brain: LearnedPattern[] = JSON.parse(existingStr);
      
      // Filter for the current mode to ensure relevant learning
      // Get the MOST RECENT 5 examples. Recent preferences matter most.
      const relevantMemories = brain
        .filter(m => m.mode === mode)
        .reverse()
        .slice(0, 5); 

      if (relevantMemories.length === 0) return "";

      const formattedMemory = relevantMemories.map((m, i) => 
        `[STYLE REFERENCE ${i + 1}]
User Asked For: "${m.userInput}"
You Generated Prompt: "${m.refinedPrompt}"
--------------------------------------------------`
      ).join('\n');

      return `
\n\n============= LEARNED USER STYLES (SUPERVISED MEMORY) =============
The user has explicitly LIKED the following output styles. 
You MUST treat these as the "Gold Standard" for this user's taste.

${formattedMemory}

INSTRUCTION: 
1. Analyze the "You Generated Prompt" examples above. 
2. Identify the recurring keywords, lighting choices, camera angles, and artistic styles (e.g., "neon", "minimalist", "hyper-realistic").
3. APPLY those exact stylistic choices to the NEW request below, unless the user specifically asks for something contradictory.
4. Do not copy the *subject* (unless requested), but COPY the *style*.
===================================================================\n`;
    } catch (e) {
      console.error("Failed to recall memory", e);
      return "";
    }
  }
};
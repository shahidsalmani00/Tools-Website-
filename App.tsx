import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdOverlay from './components/AdOverlay';
import { AppMode, ChatMessage, GenerationConfig } from './types';
import { refinePrompt, generateImage, generateWithImages } from './services/geminiService';
import { memoryService } from './services/memoryService';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  
  // Store chat history separately for each mode
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  
  // Track generation status per mode
  const [generatingMode, setGeneratingMode] = useState<AppMode | null>(null);
  
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [config, setConfig] = useState<GenerationConfig>({
    aspectRatio: '1:1',
    highQuality: false
  });

  // Get messages for the current mode
  const currentMessages = histories[currentMode] || [];
  const isGenerating = generatingMode === currentMode;

  // Automatically set Aspect Ratio and Quality based on Mode
  useEffect(() => {
    let newRatio = '1:1';
    let newQuality = false;

    switch (currentMode) {
      case AppMode.THUMBNAIL:
      case AppMode.BANNER:
        newRatio = '16:9';
        newQuality = true; // Use Pro for better text/composition
        break;
      case AppMode.POSTER:
        newRatio = '3:4';
        newQuality = true;
        break;
      case AppMode.LOGO:
      case AppMode.AVATAR:
        newRatio = '1:1';
        newQuality = true; // Pro for sharp details
        break;
      case AppMode.BG_REMOVER:
        newRatio = '1:1'; // Edits usually preserve or default to square if generated
        newQuality = false; // Flash is good for edits
        break;
      case AppMode.GENERAL:
      default:
        newRatio = '1:1';
        newQuality = false;
        break;
    }

    setConfig(prev => ({
      ...prev,
      aspectRatio: newRatio as any,
      highQuality: newQuality
    }));
  }, [currentMode]);

  const handleModeChange = useCallback((mode: AppMode) => {
    setCurrentMode(mode);
    // Show interstitial ad when changing tools
    setShowAdOverlay(true);
  }, []);

  const handleReset = useCallback(() => {
    setHistories(prev => ({
        ...prev,
        [currentMode]: []
    }));
    if (generatingMode === currentMode) {
        setGeneratingMode(null);
    }
  }, [currentMode, generatingMode]);

  /**
   * Supervised Learning Feedback Loop
   * Called when user clicks "Like" / Thumbs Up on a message
   */
  const handleLikeMessage = useCallback((index: number) => {
    const activeMode = currentMode;
    const messages = histories[activeMode] || [];
    const message = messages[index];
    
    // Safety check: ensure it's an assistant message with metadata
    if (!message || message.role !== 'assistant' || !message.metadata?.finalPrompt) return;
    
    // 1. Find the User Prompt that triggered this (usually index - 1)
    const userMessage = messages[index - 1];
    const userInput = userMessage?.role === 'user' ? userMessage.content : "";

    // 2. Teach the Memory Service
    if (userInput && message.metadata.finalPrompt) {
        memoryService.learn(activeMode, userInput, message.metadata.finalPrompt);
    }

    // 3. Update UI to show it's liked
    const newMessages = [...messages];
    newMessages[index] = {
        ...message,
        metadata: {
            ...message.metadata,
            liked: true
        }
    };
    
    setHistories(prev => ({
        ...prev,
        [activeMode]: newMessages
    }));
  }, [currentMode, histories]);

  const handleSendMessage = useCallback(async (text: string, imageInputs?: string[]) => {
    // Capture the mode that initiated the request
    const activeMode = currentMode;

    // Add user message to state for the specific mode
    const newUserMsg: ChatMessage = {
      role: 'user',
      content: text,
      images: imageInputs,
      timestamp: Date.now()
    };
    
    setHistories(prev => ({
        ...prev,
        [activeMode]: [...(prev[activeMode] || []), newUserMsg]
    }));
    
    setGeneratingMode(activeMode);

    try {
      let finalPrompt = text;
      let resultImageUrl: string | null = null;
      const hasImages = imageInputs && imageInputs.length > 0;

      // WORKFLOW 1: Generation WITH Images (Editing/Compositing)
      if (hasImages) {
        // 1. Refine the prompt specifically for image-to-image
        const refinedPrompt = await refinePrompt(text, activeMode, true);
        finalPrompt = refinedPrompt;

        // Default prompt fallbacks
        if (!finalPrompt || finalPrompt === "" || (text === "" && !finalPrompt)) {
            if (activeMode === AppMode.BG_REMOVER) {
                finalPrompt = "Isolate the main subject on a solid white background. Do not change the subject.";
            } else if (activeMode === AppMode.THUMBNAIL) {
                finalPrompt = "Make this into an exciting YouTube thumbnail. High contrast, expressive.";
            } else if (activeMode === AppMode.LOGO) {
                finalPrompt = "Turn this into a minimalist vector logo.";
            } else {
                finalPrompt = "Enhance this image, high quality.";
            }
        }

        resultImageUrl = await generateWithImages(imageInputs, finalPrompt, config.aspectRatio);
      } 
      // WORKFLOW 2: Text-to-Image Generation (No input images)
      else {
        // Step 1: Refine the prompt using Gemini Chat + Memory Service
        const refinedPrompt = await refinePrompt(text, activeMode, false);
        finalPrompt = refinedPrompt;
        
        // Step 2: Generate the image
        resultImageUrl = await generateImage(refinedPrompt, config.aspectRatio, config.highQuality);
      }

      if (resultImageUrl) {
        setHistories(prev => ({
            ...prev,
            [activeMode]: [...(prev[activeMode] || []), {
                role: 'assistant',
                content: `Here is your ${activeMode} design!`,
                images: [resultImageUrl as string], 
                timestamp: Date.now(),
                // Store the prompt metadata so we can learn from it later
                metadata: {
                    originalPrompt: text,
                    finalPrompt: finalPrompt,
                    liked: false
                }
            }]
        }));
      } else {
        setHistories(prev => ({
            ...prev,
            [activeMode]: [...(prev[activeMode] || []), {
                role: 'assistant',
                content: "Sorry, I couldn't generate an image this time. Please try again.",
                timestamp: Date.now()
            }]
        }));
      }

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      
      const errString = error.toString();
      const errMessage = error.message || "Unknown error";
      
      let userFriendlyTitle = "⚠️ Generation Failed";
      let troubleshootingSteps = "";

      // 403 Permission Denied / Forbidden
      if (errString.includes('403') || errMessage.includes('PERMISSION_DENIED') || errString.includes('permission denied')) {
        userFriendlyTitle = "⚠️ **Access Denied (403)**";
        troubleshootingSteps = `
**How to Fix:**
1. **Enable API:** Go to Google Cloud Console > APIs & Services > Enable "Google Generative AI API".
2. **Billing:** Ensure your Cloud Project has a Billing Account linked (Required for Image models).
3. **Region:** Image generation might be restricted in your current region.
4. **Key:** Verify your API_KEY is correct.`;
      } 
      // 429 Resource Exhausted / Quota
      else if (errString.includes('429') || errMessage.includes('RESOURCE_EXHAUSTED')) {
         userFriendlyTitle = "⚠️ **Quota Exceeded (429)**";
         troubleshootingSteps = "**How to Fix:**\nYou have hit the rate limit. Please wait a minute before trying again or check your quota limits in Google Cloud Console.";
      } 
      // 500 Server Errors
      else if (errString.includes('500') || errMessage.includes('INTERNAL')) {
          userFriendlyTitle = "⚠️ **Server Error (500)**";
          troubleshootingSteps = "**How to Fix:**\nGoogle's servers are experiencing issues. Please try again in a few moments.";
      }
      else {
          troubleshootingSteps = "**How to Fix:**\nCheck your internet connection and ensure your API key is configured correctly in the environment variables.";
      }

      setHistories(prev => ({
        ...prev,
        [activeMode]: [...(prev[activeMode] || []), {
            role: 'assistant',
            content: `${userFriendlyTitle}\n\n**Error Details:** ${errMessage}\n\n${troubleshootingSteps}`,
            timestamp: Date.now()
        }]
      }));
    } finally {
      setGeneratingMode(prev => (prev === activeMode ? null : prev));
    }
  }, [currentMode, config]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      <Sidebar 
        currentMode={currentMode} 
        setMode={handleModeChange} 
        onReset={handleReset}
      />
      
      <main className="flex-1 flex flex-col relative w-full h-full bg-slate-950">
         <ChatInterface 
            key={currentMode} // Force re-mount on mode change to clear input/selection state
            messages={currentMessages} 
            onSendMessage={handleSendMessage}
            onLikeMessage={handleLikeMessage}
            isGenerating={isGenerating}
            currentMode={currentMode}
            config={config}
            setConfig={setConfig}
         />
      </main>

      <AdOverlay 
        isOpen={showAdOverlay} 
        onClose={() => setShowAdOverlay(false)} 
      />
    </div>
  );
}

export default App;
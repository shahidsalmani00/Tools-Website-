import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdOverlay from './components/AdOverlay';
import { AppMode, ChatMessage, GenerationConfig } from './types';
import { refinePrompt, generateImage, generateWithImages } from './services/geminiService';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [config, setConfig] = useState<GenerationConfig>({
    aspectRatio: '1:1',
    highQuality: false
  });

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
    setMessages([]);
    setIsGenerating(false);
  }, []);

  const handleSendMessage = useCallback(async (text: string, imageInputs?: string[]) => {
    // Add user message to state
    const newUserMsg: ChatMessage = {
      role: 'user',
      content: text,
      images: imageInputs,
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, newUserMsg]);
    setIsGenerating(true);

    try {
      let finalPrompt = text;
      let resultImageUrl: string | null = null;
      const hasImages = imageInputs && imageInputs.length > 0;

      // WORKFLOW 1: Generation WITH Images (Editing/Compositing)
      if (hasImages) {
        // 1. Refine the prompt specifically for image-to-image
        const refinedPrompt = await refinePrompt(text, currentMode, true);
        finalPrompt = refinedPrompt;

        // Default prompt fallbacks
        if (!finalPrompt || finalPrompt === "" || (text === "" && !finalPrompt)) {
            if (currentMode === AppMode.BG_REMOVER) {
                finalPrompt = "Isolate the main subject on a solid white background. Do not change the subject.";
            } else if (currentMode === AppMode.THUMBNAIL) {
                finalPrompt = "Make this into an exciting YouTube thumbnail. High contrast, expressive.";
            } else if (currentMode === AppMode.LOGO) {
                finalPrompt = "Turn this into a minimalist vector logo.";
            } else {
                finalPrompt = "Enhance this image, high quality.";
            }
        }

        resultImageUrl = await generateWithImages(imageInputs, finalPrompt, config.aspectRatio);
      } 
      // WORKFLOW 2: Text-to-Image Generation (No input images)
      else {
        // Step 1: Refine the prompt using Gemini Chat
        const refinedPrompt = await refinePrompt(text, currentMode, false);
        finalPrompt = refinedPrompt;
        
        // Step 2: Generate the image
        resultImageUrl = await generateImage(refinedPrompt, config.aspectRatio, config.highQuality);
      }

      if (resultImageUrl) {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Here is your ${currentMode} design!`,
          images: [resultImageUrl as string], // Store result image here
          timestamp: Date.now()
        }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Sorry, I couldn't generate an image this time. Please try again.",
          timestamp: Date.now()
        }]);
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

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `${userFriendlyTitle}\n\n**Error Details:** ${errMessage}\n\n${troubleshootingSteps}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsGenerating(false);
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
            messages={messages} 
            onSendMessage={handleSendMessage}
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
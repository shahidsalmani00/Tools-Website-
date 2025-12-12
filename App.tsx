import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdOverlay from './components/AdOverlay';
import { AppMode, ChatMessage, GenerationConfig } from './types';
import { refinePrompt, generateImage, generateWithImages } from './services/geminiService';
import { memoryService } from './services/memoryService';

function App() {
  // App State
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  const [generatingMode, setGeneratingMode] = useState<AppMode | null>(null);
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  
  const [config, setConfig] = useState<GenerationConfig>({
    aspectRatio: '1:1',
    highQuality: false
  });
  
  const currentMessages = histories[currentMode] || [];
  const isGenerating = generatingMode === currentMode;

  useEffect(() => {
    let newRatio = '1:1';
    let newQuality = false;

    // Smart Defaults based on App Mode
    switch (currentMode) {
      case AppMode.THUMBNAIL:
      case AppMode.BANNER:
        newRatio = '16:9';
        newQuality = true; 
        break;
      case AppMode.POSTER:
        newRatio = '3:4';
        newQuality = true;
        break;
      case AppMode.LOGO:
      case AppMode.AVATAR:
        newRatio = '1:1';
        newQuality = true; 
        break;
      case AppMode.BG_REMOVER:
        newRatio = '1:1'; 
        newQuality = false; 
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

  const handleLikeMessage = useCallback((index: number) => {
    const activeMode = currentMode;
    const messages = histories[activeMode] || [];
    const message = messages[index];
    
    if (!message || message.role !== 'assistant' || !message.metadata?.finalPrompt) return;
    
    const userMessage = messages[index - 1];
    const userInput = userMessage?.role === 'user' ? userMessage.content : "";

    if (userInput && message.metadata.finalPrompt) {
        memoryService.learn(activeMode, userInput, message.metadata.finalPrompt);
    }

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
    const activeMode = currentMode;
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

      // 1. Refine Prompt (Text Generation)
      if (text.trim().length > 0 || !hasImages) {
         try {
             finalPrompt = await refinePrompt(text, activeMode, hasImages);
         } catch (e) {
             console.warn("Prompt refinement failed, using original text.");
             finalPrompt = text;
         }
      }

      // Fallback prompts if empty
      if (!finalPrompt || finalPrompt === "") {
            if (activeMode === AppMode.BG_REMOVER) finalPrompt = "Isolate the subject on white background.";
            else if (activeMode === AppMode.THUMBNAIL) finalPrompt = "YouTube thumbnail.";
            else finalPrompt = "High quality image.";
      }

      // 2. Generate Image (Image Generation)
      if (hasImages) {
        resultImageUrl = await generateWithImages(imageInputs, finalPrompt, config.aspectRatio);
      } else {
        resultImageUrl = await generateImage(finalPrompt, config.aspectRatio, config.highQuality);
      }

      if (resultImageUrl) {
        setHistories(prev => ({
            ...prev,
            [activeMode]: [...(prev[activeMode] || []), {
                role: 'assistant',
                content: `Here is your ${activeMode} design!`,
                images: [resultImageUrl as string], 
                timestamp: Date.now(),
                metadata: {
                    originalPrompt: text,
                    finalPrompt: finalPrompt,
                    liked: false
                }
            }]
        }));
      } else {
        throw new Error("No image data returned from API.");
      }

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      let errMessage = error.message || "Unknown error";
      const errString = error.toString();
      
      // Simplified Error Messages for a better user experience
      if (errString.includes("429") || errMessage.includes("quota") || errMessage.includes("RESOURCE_EXHAUSTED")) {
        errMessage = "System busy. Please wait a few seconds and try again.";
      } else if (errString.includes("403") || errMessage.includes("PERMISSION_DENIED")) {
        errMessage = "Connection refused. The API Key may have restrictions or is invalid.";
      } else if (errMessage.includes("API Key is missing")) {
        errMessage = "API Key is missing in the configuration.";
      } else if (errMessage.includes("SAFETY")) {
        errMessage = "I couldn't generate that due to safety guidelines. Please try a different description.";
      } else if (errMessage.includes("fetch")) {
        errMessage = "Network error. Please check your internet connection.";
      }

      setHistories(prev => ({
        ...prev,
        [activeMode]: [...(prev[activeMode] || []), {
            role: 'assistant',
            content: `⚠️ ${errMessage}`,
            timestamp: Date.now()
        }]
      }));
    } finally {
      setGeneratingMode(prev => (prev === activeMode ? null : prev));
    }
  }, [currentMode, config]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-teal-500/30 relative">
      <Sidebar 
        currentMode={currentMode} 
        setMode={handleModeChange} 
        onReset={handleReset}
      />
      
      <main className="flex-1 flex flex-col relative w-full h-full bg-slate-950">
         <ChatInterface 
            key={currentMode} 
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
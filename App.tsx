import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdOverlay from './components/AdOverlay';
import { AppMode, ChatMessage, GenerationConfig } from './types';
import { refinePrompt, generateImage, generateWithImages, hasApiKey } from './services/geminiService';
import { memoryService } from './services/memoryService';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  const [isConfigured, setIsConfigured] = useState(hasApiKey());
  
  // Store chat history separately for each mode
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  
  // Track generation status per mode
  const [generatingMode, setGeneratingMode] = useState<AppMode | null>(null);
  
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [config, setConfig] = useState<GenerationConfig>({
    aspectRatio: '1:1',
    highQuality: false
  });

  const currentMessages = histories[currentMode] || [];
  const isGenerating = generatingMode === currentMode;

  useEffect(() => {
    // Check for API key on mount (useful if env vars are injected dynamically)
    setIsConfigured(hasApiKey());
  }, []);

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
        throw new Error("No image data returned.");
      }

    } catch (error: any) {
      console.error("Gemini API Error:", error);
      let errMessage = error.message || "Unknown error";
      
      // USER-FRIENDLY ERROR MESSAGES
      if (errMessage.includes("429") || errMessage.includes("quota") || errMessage.includes("RESOURCE_EXHAUSTED")) {
        errMessage = "Server is extremely busy. Please wait 1 minute and try again.";
      } else if (errMessage.includes("403")) {
        errMessage = "Access Denied (403). API Key issue.";
      } else if (errMessage.includes("API Key is missing")) {
        errMessage = "API Key not found in environment.";
      }

      setHistories(prev => ({
        ...prev,
        [activeMode]: [...(prev[activeMode] || []), {
            role: 'assistant',
            content: `⚠️ Generation Failed: ${errMessage}`,
            timestamp: Date.now()
        }]
      }));
    } finally {
      setGeneratingMode(prev => (prev === activeMode ? null : prev));
    }
  }, [currentMode, config]);
  
  if (!isConfigured) {
    return (
      <div className="flex h-screen bg-slate-950 text-slate-100 font-sans items-center justify-center p-6">
        <div className="text-center max-w-md animate-in fade-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-slate-700 shadow-xl shadow-slate-900/50">
             <span className="text-4xl">🔑</span>
          </div>
          <h1 className="text-2xl font-bold mb-3 text-white">API Key Required</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">
            PixFrog AI is ready to deploy! Please set your Google Gemini API Key in the environment variables to start generating.
          </p>
          <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-800 text-left text-sm text-slate-300 font-mono shadow-inner mb-6">
             <p className="mb-2 text-slate-500 font-semibold uppercase text-xs tracking-wider">For Local Development (.env):</p>
             <p className="text-teal-400 mb-4 bg-slate-950 p-2 rounded border border-slate-800/50 select-all">VITE_API_KEY=AIzaSy...</p>
             
             <p className="mb-2 text-slate-500 font-semibold uppercase text-xs tracking-wider">For Deployment (Vercel/Netlify):</p>
             <p className="text-teal-400 bg-slate-950 p-2 rounded border border-slate-800/50 select-all">API_KEY=AIzaSy...</p>
          </div>
          
          <div className="flex flex-col gap-3">
             <p className="text-xs text-slate-600">
                Get your free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-teal-500 hover:underline">Google AI Studio</a>
             </p>
             <button 
               onClick={() => window.location.reload()}
               className="bg-teal-600 hover:bg-teal-500 text-white py-2 px-4 rounded-lg font-medium transition-colors"
             >
               I've Added The Key - Reload App
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-teal-500/30">
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
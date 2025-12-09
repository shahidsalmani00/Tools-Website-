import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdOverlay from './components/AdOverlay';
import { AppMode, ChatMessage, GenerationConfig } from './types';
import { refinePrompt, generateImage, generateWithImages } from './services/geminiService';
import { memoryService } from './services/memoryService';
import { Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

function App() {
  const [apiKeyReady, setApiKeyReady] = useState<boolean>(false);
  const [checkingKey, setCheckingKey] = useState<boolean>(true);

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

  // ===========================================================================
  // API KEY MANAGEMENT
  // ===========================================================================
  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setApiKeyReady(hasKey);
      } else {
        // Fallback for dev environments where aistudio might not be injected
        // assuming process.env.API_KEY is manually set
        // @ts-ignore
        if (process.env.API_KEY) setApiKeyReady(true);
      }
    } catch (e) {
      console.error("Error checking API key:", e);
    } finally {
      setCheckingKey(false);
    }
  };

  const handleConnectApiKey = async () => {
    try {
      if (window.aistudio) {
        await window.aistudio.openSelectKey();
        // Assume success if no error thrown
        setApiKeyReady(true);
      }
    } catch (error: any) {
      console.error("Key selection failed:", error);
      if (error.message && error.message.includes("Requested entity was not found")) {
         // Retry logic as per guidelines
         alert("Session expired. Please select your key again.");
         handleConnectApiKey();
      }
    }
  };

  // ===========================================================================
  // APP LOGIC
  // ===========================================================================

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
      
      if (errMessage.includes("429") || errMessage.includes("quota") || errMessage.includes("RESOURCE_EXHAUSTED")) {
        errMessage = "Server traffic is high (Quota Limit). Please wait a moment and try again.";
      } else if (errMessage.includes("403")) {
        errMessage = "API Key Invalid or Access Denied. Please check your environment configuration.";
      } else if (errMessage.includes("API Key is missing")) {
        errMessage = "API Key not found. Please ensure you have connected your account.";
      } else if (errMessage.includes("SAFETY")) {
        errMessage = "Generation blocked by safety filters. Try a different prompt.";
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

  // ===========================================================================
  // RENDER: LOADING / LANDING
  // ===========================================================================

  if (checkingKey) {
     return <div className="h-screen bg-slate-950 flex items-center justify-center text-teal-500">
         <Sparkles className="animate-spin" size={32} />
     </div>;
  }

  if (!apiKeyReady) {
    return (
        <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                 <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] bg-teal-500/10 rounded-full blur-[100px]"></div>
                 <div className="absolute bottom-[0%] right-[0%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[100px]"></div>
             </div>

             <div className="max-w-md w-full bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative z-10 text-center">
                 <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-cyan-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-teal-500/20">
                     <Sparkles className="text-white" size={32} />
                 </div>
                 
                 <h1 className="text-3xl font-bold text-white mb-2">PixFrog AI</h1>
                 <p className="text-slate-400 mb-8 leading-relaxed">
                    Unleash your creativity with our advanced AI Studio. 
                    Generate thumbnails, logos, and banners in seconds.
                 </p>

                 <div className="bg-slate-800/50 rounded-xl p-4 mb-8 border border-slate-700/50 text-left">
                     <h3 className="text-slate-200 font-semibold text-sm mb-2 flex items-center gap-2">
                        <ShieldCheck size={16} className="text-green-400"/> 
                        Access Required
                     </h3>
                     <p className="text-xs text-slate-500 mb-2">
                        To use high-quality models (Gemini 2.5/3.0), you must connect a valid API Key from a Google Cloud Project.
                     </p>
                     <a 
                       href="https://ai.google.dev/gemini-api/docs/billing" 
                       target="_blank" 
                       rel="noreferrer"
                       className="text-[10px] text-teal-400 hover:text-teal-300 underline"
                     >
                       Read about Billing Requirements &rarr;
                     </a>
                 </div>

                 <button 
                    onClick={handleConnectApiKey}
                    className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-xl hover:scale-[1.02] active:scale-[0.98]"
                 >
                    <span>Connect Google Account</span>
                    <ArrowRight size={18} />
                 </button>
             </div>
             
             <p className="mt-8 text-slate-600 text-xs">Powered by Google Gemini API</p>
        </div>
    );
  }

  // ===========================================================================
  // RENDER: MAIN APP
  // ===========================================================================
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
import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatInterface from './components/ChatInterface';
import AdOverlay from './components/AdOverlay';
import { AppMode, ChatMessage, GenerationConfig } from './types';
import { refinePrompt, generateImage, generateWithImages, hasApiKey } from './services/geminiService';
import { memoryService } from './services/memoryService';
import { AlertTriangle, Settings, CheckCircle } from 'lucide-react';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  const [isConfigured, setIsConfigured] = useState(true);
  
  // Store chat history separately for each mode
  const [histories, setHistories] = useState<Record<string, ChatMessage[]>>({});
  
  // Track generation status per mode
  const [generatingMode, setGeneratingMode] = useState<AppMode | null>(null);
  
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [config, setConfig] = useState<GenerationConfig>({
    aspectRatio: '1:1',
    highQuality: false
  });

  useEffect(() => {
    // Check for API Key on mount
    setIsConfigured(hasApiKey());
  }, []);

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

      if (hasImages) {
        const refinedPrompt = await refinePrompt(text, activeMode, true);
        finalPrompt = refinedPrompt;

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
      else {
        const refinedPrompt = await refinePrompt(text, activeMode, false);
        finalPrompt = refinedPrompt;
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
      const errMessage = error.message || "Unknown error";
      
      setHistories(prev => ({
        ...prev,
        [activeMode]: [...(prev[activeMode] || []), {
            role: 'assistant',
            content: `⚠️ Generation Failed: ${errMessage}\n\nCheck your connection or API key settings.`,
            timestamp: Date.now()
        }]
      }));
    } finally {
      setGeneratingMode(prev => (prev === activeMode ? null : prev));
    }
  }, [currentMode, config]);

  // RENDER SETUP GUIDE IF NO API KEY
  if (!isConfigured) {
    return (
        <div className="flex h-screen bg-slate-950 text-slate-100 font-sans items-center justify-center p-6">
            <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
                        <AlertTriangle size={32} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Setup Required</h1>
                        <p className="text-slate-400">Connect your PixFrog app to the AI Brain.</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <p className="text-sm text-slate-300 mb-2">
                            The app is running, but it cannot find the <code className="bg-slate-950 px-1.5 py-0.5 rounded text-teal-400 font-mono">API_KEY</code> environment variable. 
                            This is normal for new deployments on free platforms like Vercel or Netlify.
                        </p>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Settings size={18} />
                            How to fix on Vercel (Recommended):
                        </h2>
                        <ol className="list-decimal list-inside space-y-3 text-slate-300 text-sm ml-2">
                            <li className="pl-2">Go to your <strong>Vercel Dashboard</strong>.</li>
                            <li className="pl-2">Select your project and go to <strong>Settings</strong> tab.</li>
                            <li className="pl-2">Click on <strong>Environment Variables</strong> in the sidebar.</li>
                            <li className="pl-2">Add a new variable:
                                <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-slate-400">
                                    <li>Key: <span className="text-white font-mono bg-slate-800 px-1 rounded">API_KEY</span></li>
                                    <li>Value: <span className="text-white font-mono bg-slate-800 px-1 rounded">Your_Gemini_API_Key_Here</span></li>
                                </ul>
                            </li>
                            <li className="pl-2 flex items-center gap-2">
                                <span className="text-teal-400 font-bold">Important:</span> 
                                Go to <strong>Deployments</strong> and verify/redeploy for changes to take effect.
                            </li>
                        </ol>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-800 flex justify-between items-center">
                    <p className="text-xs text-slate-500">Once configured, refresh this page.</p>
                    <a href="https://vercel.com/dashboard" target="_blank" rel="noreferrer" className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-lg font-medium transition-colors">
                        Open Vercel Dashboard
                    </a>
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
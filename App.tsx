import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ImageCanvas from './components/ImageCanvas';
import ChatInterface from './components/ChatInterface';
import { AppMode, ChatMessage, GeneratedImage, GenerationConfig } from './types';
import { refinePrompt, generateImage, generateWithImages } from './services/geminiService';

function App() {
  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.GENERAL);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<GeneratedImage | null>(null);
  const [loadingStep, setLoadingStep] = useState<string>('');
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

  const handleReset = useCallback(() => {
    setMessages([]);
    setGeneratedImage(null);
    setLoadingStep('');
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
    setLoadingStep('Analyzing request...');

    try {
      let finalPrompt = text;
      let resultImageUrl: string | null = null;
      const hasImages = imageInputs && imageInputs.length > 0;

      // WORKFLOW 1: Generation WITH Images (Editing/Compositing)
      if (hasImages) {
        setLoadingStep('Processing uploaded assets...');
        
        // 1. Refine the prompt specifically for image-to-image
        // If text is empty, refinePrompt might return empty string, so we handle that below
        const refinedPrompt = await refinePrompt(text, currentMode, true);
        finalPrompt = refinedPrompt;

        // Default prompt fallbacks if the user didn't provide text or refine failed
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

        setLoadingStep('Creating composition...');
        resultImageUrl = await generateWithImages(imageInputs, finalPrompt, config.aspectRatio);
      } 
      // WORKFLOW 2: Text-to-Image Generation (No input images)
      else {
        // Step 1: Refine the prompt using Gemini Chat
        setLoadingStep('Refining prompt...');
        const refinedPrompt = await refinePrompt(text, currentMode, false);
        
        // Add Assistant message showing the refined prompt
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Creating: "${refinedPrompt}"`,
          timestamp: Date.now()
        }]);

        setLoadingStep('Generating image (this may take a moment)...');
        finalPrompt = refinedPrompt;
        
        // Step 2: Generate the image
        resultImageUrl = await generateImage(refinedPrompt, config.aspectRatio, config.highQuality);
      }

      if (resultImageUrl) {
        setGeneratedImage({
          url: resultImageUrl,
          prompt: finalPrompt,
          timestamp: Date.now()
        });
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Here is your generated design!",
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
      console.error(error);
      const isPermissionError = error?.message?.includes('403') || error?.status === 'PERMISSION_DENIED';
      
      const errorMessage = isPermissionError 
        ? "Permission Denied: Your API key doesn't have access to the selected model. Please ensure you have a valid project with billing enabled for high-quality generation."
        : "An error occurred. Please ensure your API key is valid and check your connection.";

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage,
        timestamp: Date.now()
      }]);
    } finally {
      setIsGenerating(false);
      setLoadingStep('');
    }
  }, [currentMode, config]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans selection:bg-indigo-500/30">
      <Sidebar 
        currentMode={currentMode} 
        setMode={setCurrentMode} 
        onReset={handleReset}
      />
      
      <main className="flex-1 flex flex-col md:flex-row relative">
         <ImageCanvas 
           image={generatedImage} 
           isLoading={isGenerating} 
           loadingStep={loadingStep} 
         />
         
         <ChatInterface 
            messages={messages} 
            onSendMessage={handleSendMessage}
            isGenerating={isGenerating}
            currentMode={currentMode}
            config={config}
            setConfig={setConfig}
         />
      </main>
    </div>
  );
}

export default App;
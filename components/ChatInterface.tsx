import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Sparkles, X, Image as ImageIcon, Plus, Download, Share2 } from 'lucide-react';
import { ChatMessage, AppMode, GenerationConfig } from '../types';
import AdUnit from './AdUnit';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, images?: string[]) => void;
  isGenerating: boolean;
  currentMode: AppMode;
  config: GenerationConfig;
  setConfig: React.Dispatch<React.SetStateAction<GenerationConfig>>;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  messages, 
  onSendMessage, 
  isGenerating, 
  currentMode,
  config,
  setConfig
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const handleSend = () => {
    if (!inputText.trim() && selectedImages.length === 0) return;
    onSendMessage(inputText, selectedImages.length > 0 ? selectedImages : undefined);
    setInputText('');
    setSelectedImages([]);
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      files.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setSelectedImages(prev => [...prev, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const downloadImage = (url: string, prefix: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${prefix}-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 flex flex-col h-full relative bg-slate-950">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-20 flex justify-between items-center shadow-lg">
        <div>
            <h3 className="text-slate-200 font-bold flex items-center gap-2 text-lg">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            Creative Assistant
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">Mode: <span className="text-indigo-400">{currentMode}</span></p>
        </div>
        
        {/* Compact Settings in Header */}
        <div className="flex items-center gap-2">
            <select 
             value={config.aspectRatio}
             onChange={(e) => setConfig({...config, aspectRatio: e.target.value as any})}
             className="bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-700 py-1.5 px-2 focus:ring-1 focus:ring-indigo-500 outline-none hidden sm:block"
           >
             <option value="1:1">1:1 Square</option>
             <option value="16:9">16:9 Landscape</option>
             <option value="9:16">9:16 Portrait</option>
             <option value="3:4">3:4 Vertical</option>
             <option value="4:3">4:3 Standard</option>
           </select>
           <button 
              onClick={() => setConfig({...config, highQuality: !config.highQuality})}
              className={`text-xs rounded-lg border py-1.5 px-3 transition-all flex items-center gap-2 ${config.highQuality ? 'bg-indigo-900/30 border-indigo-500/50 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
           >
             <span className="hidden sm:inline">{config.highQuality ? 'Pro' : 'Fast'}</span>
             <div className={`w-2 h-2 rounded-full ${config.highQuality ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-slate-600'}`}></div>
           </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8 scroll-smooth scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        
        {/* Top Ad Unit - Restored */}
        <div className="max-w-3xl mx-auto w-full">
             <AdUnit size="banner" className="h-[90px] mb-6 shadow-md border border-slate-800/50" label="Sponsored" />
        </div>

        {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center mt-10 opacity-60 min-h-[40vh]">
                <div className="w-20 h-20 bg-slate-800/50 rounded-full flex items-center justify-center mb-6">
                    <Sparkles size={40} className="text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-300 mb-2">What shall we create?</h2>
                <p className="text-slate-500 text-sm max-w-md mx-auto mb-4">Select a mode from the sidebar and describe your vision. You can also upload reference images.</p>
                {currentMode === AppMode.THUMBNAIL && (
                  <p className="text-indigo-400 text-xs font-medium bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-500/20">Pro Tip: Upload a screenshot for thumbnail remixes!</p>
                )}
            </div>
        )}

        {messages.map((msg, idx) => (
          <React.Fragment key={idx}>
          <div className={`flex flex-col max-w-3xl mx-auto w-full group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            
            {/* User Message */}
            {msg.role === 'user' && (
                <div className="max-w-[85%] sm:max-w-[70%]">
                    <div className="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-5 py-3.5 shadow-lg shadow-indigo-900/20">
                        {msg.images && msg.images.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3">
                                {msg.images.map((img, i) => (
                                <img key={i} src={img} alt="User upload" className="w-20 h-20 object-cover rounded-lg border-2 border-white/20" />
                                ))}
                            </div>
                        )}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1 text-right mr-1 opacity-0 group-hover:opacity-100 transition-opacity">You</div>
                </div>
            )}

            {/* Assistant / Generated Content */}
            {msg.role === 'assistant' && (
                <div className="w-full flex gap-4">
                     <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-1 shadow-lg shadow-purple-900/20">
                         <Sparkles size={14} className="text-white" />
                     </div>
                     <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-300 mb-3 bg-slate-800/50 px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-700/50 inline-block">
                            {msg.content}
                        </div>

                        {/* Generated Image Result */}
                        {msg.images && msg.images.length > 0 && (
                            <div className="mt-2 relative w-full max-w-xl group/image">
                                <div className="rounded-xl overflow-hidden shadow-2xl border border-slate-700 bg-slate-900 relative">
                                    <div className="absolute inset-0 bg-slate-800 animate-pulse -z-10"></div>
                                    <img 
                                        src={msg.images[0]} 
                                        alt="Generated Result" 
                                        className="w-full h-auto object-contain max-h-[600px] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" 
                                    />
                                    
                                    {/* Overlay Actions */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-all duration-300 flex items-end justify-between p-4">
                                        <button className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors">
                                            <Share2 size={20} />
                                        </button>
                                        <button 
                                            onClick={() => downloadImage(msg.images![0], 'pixelforge')}
                                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium shadow-lg transition-all transform hover:scale-105 active:scale-95"
                                        >
                                            <Download size={16} />
                                            <span>Download</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                     </div>
                </div>
            )}
          </div>
          
          {/* Banner Ad Insertion: Show after assistant response */}
          {msg.role === 'assistant' && (
              <div className="w-full max-w-3xl mx-auto mt-6 mb-2 animate-in fade-in duration-500">
                   <AdUnit size="banner" className="h-[90px] w-full shadow-lg border border-slate-800/30" label="Sponsored" />
              </div>
          )}
          </React.Fragment>
        ))}

        {isGenerating && (
             <div className="flex items-start max-w-3xl mx-auto w-full gap-4">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-1">
                     <div className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                </div>
                <div className="bg-slate-800/30 rounded-2xl rounded-tl-sm px-5 py-3 border border-slate-700/50 flex items-center gap-3">
                   <span className="text-sm text-slate-400">Crafting your masterpiece...</span>
                   <div className="flex gap-1">
                     <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                     <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                     <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                   </div>
                </div>
             </div>
        )}
        <div ref={messagesEndRef} className="h-4" />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800 z-30">
        <div className="max-w-3xl mx-auto">
            {/* Image Preview Strip */}
            {selectedImages.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                    {selectedImages.map((img, idx) => (
                    <div key={idx} className="relative shrink-0 group">
                        <img src={img} alt="Preview" className="h-16 w-16 rounded-xl object-cover border border-slate-600 shadow-md" />
                        <button 
                            onClick={() => removeImage(idx)}
                            className="absolute -top-2 -right-2 bg-slate-800 text-slate-400 hover:text-red-400 rounded-full p-1 border border-slate-600 shadow-sm transition-colors"
                        >
                            <X size={12} />
                        </button>
                    </div>
                    ))}
                    {selectedImages.length < 3 && (
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="h-16 w-16 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:border-indigo-500 hover:bg-slate-800/50 transition-all"
                    >
                        <Plus size={20} />
                    </button>
                    )}
                </div>
            )}

            <div className="flex items-end gap-2 bg-slate-800 p-2 rounded-2xl border border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all shadow-lg">
            <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/*"
                multiple 
                className="hidden"
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-xl transition-all"
                title="Upload Images (Max 3 recommended)"
            >
                {currentMode === AppMode.BG_REMOVER ? <ImageIcon size={20} className="text-indigo-400" /> : <Upload size={20} />}
            </button>
            
            <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                currentMode === AppMode.THUMBNAIL 
                ? "Describe your thumbnail... (e.g., 'Surprised face on left, gaming screenshot bg')" 
                : "Type a prompt to generate..."
                }
                className="flex-1 bg-transparent border-none text-slate-200 placeholder-slate-500 resize-none py-3 px-1 focus:ring-0 text-sm max-h-32 min-h-[44px] scrollbar-hide"
                rows={1}
                style={{ height: 'auto', minHeight: '44px' }}
            />
            
            <button 
                onClick={handleSend}
                disabled={isGenerating || (!inputText.trim() && selectedImages.length === 0)}
                className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-900/20 active:scale-95"
            >
                <Send size={20} />
            </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-2 text-center opacity-60">
                PixelForge AI can make mistakes. Review generated images carefully.
            </p>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
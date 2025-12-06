import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, Sparkles, X, Image as ImageIcon, Plus } from 'lucide-react';
import { ChatMessage, AppMode, GenerationConfig } from '../types';

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
  }, [messages]);

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
    // Reset input to allow selecting the same file again if needed
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full md:w-[400px] bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0">
      
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <h3 className="text-slate-200 font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          Creative Assistant
        </h3>
        <p className="text-xs text-slate-500 mt-1">Mode: <span className="text-indigo-400">{currentMode}</span></p>
      </div>

      {/* Settings / Controls */}
      <div className="px-4 py-3 bg-slate-800/30 border-b border-slate-800 grid grid-cols-2 gap-2">
         <div className="flex flex-col gap-1">
           <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Ratio</label>
           <select 
             value={config.aspectRatio}
             onChange={(e) => setConfig({...config, aspectRatio: e.target.value as any})}
             className="bg-slate-800 text-slate-300 text-xs rounded-md border border-slate-700 p-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
           >
             <option value="1:1">1:1 Square</option>
             <option value="16:9">16:9 Landscape</option>
             <option value="9:16">9:16 Portrait</option>
             <option value="3:4">3:4 Vertical</option>
             <option value="4:3">4:3 Standard</option>
           </select>
         </div>
         <div className="flex flex-col gap-1">
           <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Quality</label>
           <button 
              onClick={() => setConfig({...config, highQuality: !config.highQuality})}
              className={`text-xs rounded-md border p-1.5 transition-all flex items-center justify-between ${config.highQuality ? 'bg-indigo-900/30 border-indigo-500/50 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
           >
             <span>{config.highQuality ? 'Pro (HD)' : 'Fast (SD)'}</span>
             <div className={`w-2 h-2 rounded-full ${config.highQuality ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]' : 'bg-slate-600'}`}></div>
           </button>
         </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
            <div className="text-center mt-10 opacity-50">
                <p className="text-slate-500 text-sm">Describe what you want to create.</p>
                <p className="text-slate-600 text-xs mt-2">Example: "A neon cyberpunk cityscape logo"</p>
                {currentMode === AppMode.THUMBNAIL && (
                  <p className="text-indigo-400 text-xs mt-4 font-medium">Tip: Upload images to use them in your thumbnail!</p>
                )}
            </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col max-w-[90%] ${msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'}`}>
            
            <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-slate-800 text-slate-300 rounded-bl-none border border-slate-700'
            }`}>
              {msg.images && msg.images.length > 0 && (
                 <div className="flex flex-wrap gap-2 mb-2">
                    {msg.images.map((img, i) => (
                       <img key={i} src={img} alt="User upload" className="w-16 h-16 object-cover rounded-lg border border-white/20" />
                    ))}
                    <div className="w-full text-[10px] opacity-70 italic">{msg.images.length} image(s) uploaded</div>
                 </div>
              )}
              {msg.content && <span>{msg.content}</span>}
            </div>
            
            <span className="text-[10px] text-slate-600 mt-1 px-1">
               {msg.role === 'user' ? 'You' : 'AI Assistant'}
            </span>
          </div>
        ))}
        {isGenerating && (
             <div className="flex items-start max-w-[90%] mr-auto">
                <div className="bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-slate-700 flex items-center gap-2">
                   <div className="flex gap-1">
                     <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                     <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                     <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                   </div>
                   <span className="text-xs text-slate-500 ml-1">Thinking...</span>
                </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-slate-900 border-t border-slate-800">
        
        {/* Image Preview Strip */}
        {selectedImages.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-hide">
                {selectedImages.map((img, idx) => (
                  <div key={idx} className="relative shrink-0">
                      <img src={img} alt="Preview" className="h-16 w-16 rounded-lg object-cover border border-slate-600" />
                      <button 
                        onClick={() => removeImage(idx)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md"
                      >
                          <X size={12} />
                      </button>
                  </div>
                ))}
                {selectedImages.length < 3 && (
                   <button 
                     onClick={() => fileInputRef.current?.click()}
                     className="h-16 w-16 rounded-lg border border-dashed border-slate-600 flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:border-indigo-500 transition-colors"
                   >
                      <Plus size={20} />
                   </button>
                )}
            </div>
        )}

        <div className="flex items-end gap-2 bg-slate-800 p-2 rounded-xl border border-slate-700 focus-within:ring-2 focus-within:ring-indigo-500/50 transition-all">
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
            className="p-2 text-slate-400 hover:text-indigo-400 transition-colors"
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
              ? "Describe thumbnail... (e.g., 'Change background to space')" 
              : "Describe your image..."
            }
            className="flex-1 bg-transparent border-none text-slate-200 placeholder-slate-500 resize-none py-2 px-1 focus:ring-0 text-sm max-h-32 min-h-[40px] scrollbar-hide"
            rows={1}
            style={{ height: 'auto', minHeight: '40px' }}
          />
          
          <button 
            onClick={handleSend}
            disabled={isGenerating || (!inputText.trim() && selectedImages.length === 0)}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-900/20"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-2 text-center">
            {currentMode === AppMode.THUMBNAIL 
             ? "Advanced Mode: Upload images to remix/edit them into a thumbnail." 
             : "Describe details clearly for best results."}
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
import React from 'react';
import { Download, Share, Maximize2, Loader2, Image as ImageIcon } from 'lucide-react';
import { GeneratedImage } from '../types';
import AdUnit from './AdUnit';

interface ImageCanvasProps {
  image: GeneratedImage | null;
  isLoading: boolean;
  loadingStep?: string;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({ image, isLoading, loadingStep }) => {
  const handleDownload = () => {
    if (!image) return;
    const link = document.createElement('a');
    link.href = image.url;
    link.download = `vividra-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 bg-slate-950 p-6 flex flex-col h-full overflow-hidden relative">
      {/* Header / Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-slate-200">Canvas</h2>
        <div className="flex gap-2">
          <button 
            disabled={!image}
            onClick={handleDownload}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700"
          >
            <Download size={16} />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Main Display Area */}
      <div className="flex-1 bg-slate-900/50 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center relative overflow-hidden group">
        
        {isLoading ? (
          <div className="flex flex-col items-center gap-4 text-indigo-400 animate-pulse">
             <div className="relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-xl rounded-full"></div>
                <Loader2 size={48} className="animate-spin relative z-10" />
             </div>
             <p className="text-slate-400 font-medium tracking-wide text-sm">
               {loadingStep || 'Processing...'}
             </p>
          </div>
        ) : image ? (
          <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
             {/* Pattern background to show transparency if applicable */}
             <div className="absolute inset-0 opacity-20" 
                style={{ 
                  backgroundImage: 'radial-gradient(#475569 1px, transparent 1px)', 
                  backgroundSize: '20px 20px' 
                }}>
             </div>
             
             <img 
              src={image.url} 
              alt="Generated Content" 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg relative z-10"
            />
            
            {/* Prompt Overlay on Hover */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent p-6 translate-y-full group-hover:translate-y-0 transition-transform duration-300 z-20">
              <p className="text-slate-300 text-sm line-clamp-3 font-mono leading-relaxed border-l-2 border-indigo-500 pl-3">
                {image.prompt}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-slate-600">
            <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center">
              <ImageIcon size={32} />
            </div>
            <p className="text-lg font-medium">Ready to create</p>
            <p className="text-sm max-w-xs text-center">Select a mode and describe your idea to start generating amazing visuals.</p>
          </div>
        )}
      </div>

      {/* Bottom Banner Ad */}
      <div className="mt-6">
        <AdUnit size="banner" className="h-[90px]" label="Support Vividra" />
      </div>
    </div>
  );
};

export default ImageCanvas;
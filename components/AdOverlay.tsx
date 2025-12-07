import React from 'react';
import { X } from 'lucide-react';
import AdUnit from './AdUnit';

interface AdOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdOverlay: React.FC<AdOverlayProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-lg w-full relative overflow-hidden flex flex-col items-center p-6 gap-6 scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-full transition-colors border border-slate-700/50"
        >
          <X size={20} />
        </button>

        <div className="text-center space-y-2 mt-2">
            <h3 className="text-xl font-bold text-white">PixFroge Sponsors</h3>
            <p className="text-sm text-slate-400">Support us by viewing this message</p>
        </div>

        {/* Display Ad */}
        <div className="w-full flex justify-center">
            <AdUnit size="rectangle" className="w-full max-w-[336px] h-[280px] shadow-lg" label="Sponsored Display" />
        </div>

        <button 
            onClick={onClose}
            className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-medium transition-colors"
        >
            Continue to Tool
        </button>
      </div>
    </div>
  );
};

export default AdOverlay;
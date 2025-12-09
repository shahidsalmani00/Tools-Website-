import React, { useState } from 'react';
import { AppMode } from '../types';
import { 
  Youtube, 
  Hexagon, 
  Scissors, 
  Share2, 
  Image as ImageIcon, 
  User, 
  Sparkles,
  RotateCcw
} from 'lucide-react';

interface SidebarProps {
  currentMode: AppMode;
  setMode: (mode: AppMode) => void;
  onReset: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentMode, setMode, onReset }) => {
  const [imgError, setImgError] = useState(false);

  const modes = [
    { id: AppMode.GENERAL, label: 'General', icon: <Sparkles size={20} /> },
    { id: AppMode.THUMBNAIL, label: 'Thumbnail', icon: <Youtube size={20} /> },
    { id: AppMode.LOGO, label: 'Logo', icon: <Hexagon size={20} /> },
    { id: AppMode.BG_REMOVER, label: 'BG Remover', icon: <Scissors size={20} /> },
    { id: AppMode.BANNER, label: 'Social Banner', icon: <Share2 size={20} /> },
    { id: AppMode.POSTER, label: 'Poster', icon: <ImageIcon size={20} /> },
    { id: AppMode.AVATAR, label: 'Avatar', icon: <User size={20} /> },
  ];

  return (
    <div className="w-16 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 transition-all duration-300 z-30">
      <div className="p-4 md:p-6 flex items-center justify-center md:justify-start gap-3 border-b border-slate-800 h-[73px]">
        {/* LOGO AREA */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-white shadow-lg shadow-teal-500/10 border-2 border-slate-800 group relative">
           {!imgError ? (
             <img 
              src="logo.png" 
              alt="PixFroge Logo" 
              className="w-full h-full object-contain p-0.5 transition-transform duration-300 group-hover:scale-110"
              onError={() => setImgError(true)}
             />
           ) : (
             /* Custom SVG Recreating the Froge Camera Logo */
             <svg viewBox="0 0 100 100" className="w-full h-full p-1" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="headGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#22d3ee" /> {/* Cyan */}
                    <stop offset="100%" stopColor="#2dd4bf" /> {/* Teal */}
                  </linearGradient>
                  <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#0ea5e9" /> {/* Sky Blue */}
                    <stop offset="100%" stopColor="#0284c7" /> {/* Blue */}
                  </linearGradient>
                </defs>
                
                <rect x="15" y="10" width="8" height="8" fill="#22d3ee" opacity="0.8" />
                <rect x="75" y="12" width="6" height="6" fill="#2dd4bf" opacity="0.8" />
                <rect x="25" y="5" width="5" height="5" fill="#0ea5e9" opacity="0.6" />

                <path d="M20 45 Q20 25 35 25 L65 25 Q80 25 80 45 L80 50 L20 50 Z" fill="url(#headGrad)" />
                
                <circle cx="30" cy="35" r="10" fill="white" stroke="#0f172a" strokeWidth="2" />
                <circle cx="30" cy="35" r="5" fill="#0f172a" />
                
                <circle cx="70" cy="35" r="10" fill="white" stroke="#0f172a" strokeWidth="2" />
                <circle cx="70" cy="35" r="5" fill="#0f172a" />
                
                <path d="M22 50 L78 50" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />

                <rect x="20" y="52" width="60" height="35" rx="8" fill="url(#bodyGrad)" />
                
                <circle cx="50" cy="69" r="14" fill="#f8fafc" />
                <circle cx="50" cy="69" r="11" fill="#1e293b" />
                <circle cx="53" cy="66" r="3" fill="white" opacity="0.9" />
                
                <circle cx="72" cy="60" r="3" fill="white" opacity="0.8" />
                
                <circle cx="50" cy="69" r="16" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="2,2" />
             </svg>
           )}
        </div>
        <span className="font-bold text-xl tracking-tight hidden md:block text-slate-100">
          Pix<span className="text-teal-400">Froge</span>
        </span>
      </div>

      <div className="p-2 md:p-3 pb-0">
          <button 
            onClick={onReset}
            className="w-full flex items-center gap-2 px-0 md:px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700 justify-center md:justify-start"
            title="New Project"
          >
            <RotateCcw size={18} />
            <span className="hidden md:inline">New Project</span>
          </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide flex flex-col justify-between">
        <ul className="space-y-1 px-2">
          {modes.map((mode) => (
            <li key={mode.id}>
              <button
                onClick={() => setMode(mode.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group justify-center md:justify-start ${
                  currentMode === mode.id
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-900/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
                title={mode.label}
              >
                <div className={`${currentMode === mode.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'}`}>
                  {mode.icon}
                </div>
                <span className="hidden md:block font-medium text-sm">{mode.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};

export default Sidebar;
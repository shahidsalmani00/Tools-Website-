import React from 'react';
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
    <div className="w-20 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0 transition-all duration-300">
      <div className="p-6 flex items-center justify-center md:justify-start gap-3 border-b border-slate-800">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
          <Sparkles className="text-white w-5 h-5" />
        </div>
        <span className="font-bold text-xl tracking-tight hidden md:block text-white">PixelForge</span>
      </div>

      <div className="p-3 pb-0">
          <button 
            onClick={onReset}
            className="w-full flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-sm font-medium transition-colors border border-slate-700 justify-center md:justify-start"
          >
            <RotateCcw size={16} />
            <span className="hidden md:inline">New Project</span>
          </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
        <ul className="space-y-1 px-2">
          {modes.map((mode) => (
            <li key={mode.id}>
              <button
                onClick={() => setMode(mode.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                  currentMode === mode.id
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
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

      <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 mt-auto">
        <div className="text-[10px] text-slate-600 hidden md:block text-center">
          <p className="font-medium text-slate-500">PixelForge v1.1</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
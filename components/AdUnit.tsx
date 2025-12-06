import React from 'react';

interface AdUnitProps {
  className?: string;
  size?: 'banner' | 'rectangle' | 'vertical';
  label?: string;
}

const AdUnit: React.FC<AdUnitProps> = ({ className = "", size = 'rectangle', label = "Advertisement" }) => {
  // Logic to determine dimensions based on size prop if not overridden by className
  const sizeClasses = {
    banner: 'h-24 w-full',
    rectangle: 'h-64 w-full',
    vertical: 'h-full w-40'
  };

  return (
    <div className={`relative overflow-hidden bg-slate-800 rounded-lg flex flex-col items-center justify-center text-center group ${sizeClasses[size]} ${className}`}>
      
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}>
      </div>

      {/* Content */}
      <div className="z-10 flex flex-col items-center gap-1">
        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900/50 px-2 py-0.5 rounded">
          {label}
        </span>
        <div className="w-full px-4">
             <div className="w-full h-[1px] bg-slate-700/50 my-2"></div>
        </div>
        <p className="text-slate-600 text-[10px] max-w-[200px]">
          Google AdSense / Custom Ad Code
        </p>
      </div>
      
    </div>
  );
};

export default AdUnit;
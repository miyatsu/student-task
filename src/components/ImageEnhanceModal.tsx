import React, { useState, useEffect, useRef } from 'react';
import { X, Check, Loader2 } from 'lucide-react';
import { AppFile } from '../App';
import Upscaler from 'upscaler';

interface ImageEnhanceModalProps {
  file: AppFile;
  onClose: () => void;
  onSave: (newFile: AppFile) => void;
}

export default function ImageEnhanceModal({ file, onClose, onSave }: ImageEnhanceModalProps) {
  const [originalUrl, setOriginalUrl] = useState<string>('');
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [sliderPos, setSliderPos] = useState(50);
  const [enhancedBlob, setEnhancedBlob] = useState<Blob | null>(null);
  
  const imgRef = useRef<HTMLImageElement>(null);
  const upscalerRef = useRef<InstanceType<typeof Upscaler> | null>(null);

  useEffect(() => {
    let active = true;
    const url = URL.createObjectURL(file.file);
    setOriginalUrl(url);

    const processUpscale = async () => {
      try {
        if (!upscalerRef.current) {
          upscalerRef.current = new Upscaler();
        }
        
        // Wait for the img element to load the original image
        const img = new Image();
        img.src = url;
        await new Promise((resolve) => {
          img.onload = resolve;
        });

        // Use patch-based upscaling to avoid memory issues on large images
        const upscaledDataUrl = await upscalerRef.current.upscale(img, {
          patchSize: 64,
          padding: 2
        });

        if (!active) return;
        
        // Convert data URL to Blob
        const res = await fetch(upscaledDataUrl);
        const blob = await res.blob();
        
        if (!active) return;
        
        setEnhancedBlob(blob);
        setEnhancedUrl(URL.createObjectURL(blob));
        setIsProcessing(false);
      } catch (err) {
        console.error("Enhancement failed:", err);
        if (active) setIsProcessing(false);
      }
    };

    processUpscale();

    return () => { 
      active = false; 
    };
  }, [file]);

  const handleSave = () => {
    if (enhancedBlob) {
      const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const extension = file.name.includes('.') ? file.name.substring(file.name.lastIndexOf('.')) : '';
      const newName = `${baseName}-enhanced${extension}`;
      const newFile = new File([enhancedBlob], newName, { type: file.file.type });
      onSave({
        id: Math.random().toString(36).substring(7),
        file: newFile,
        name: newName,
        size: newFile.size,
        type: 'image',
        previewUrl: enhancedUrl || undefined
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col h-[85vh]">
        <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-zinc-800">AI Image Enhancement (Upscaler JS)</h2>
          <button onClick={onClose} className="p-1 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>
        <div className="flex-1 bg-zinc-900 relative flex items-center justify-center overflow-hidden p-4">
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center text-white gap-4">
              <Loader2 className="w-8 h-8 animate-spin" />
              <p>Downloading AI model and enhancing image... this may take 10-30 seconds.</p>
            </div>
          ) : (
            <div className="relative w-full h-full select-none flex items-center justify-center pointer-events-none">
              <img src={originalUrl} className="absolute w-full h-full object-contain pointer-events-none" alt="Original" />
              
              {enhancedUrl && (
                <img 
                  src={enhancedUrl} 
                  className="absolute w-full h-full object-contain pointer-events-none" 
                  alt="Enhanced" 
                  style={{ clipPath: `polygon(${sliderPos}% 0, 100% 0, 100% 100%, ${sliderPos}% 100%)` }}
                />
              )}
              
              {enhancedUrl && (
                 <>
                    <div 
                       className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-md z-10 pointer-events-none"
                       style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }}
                    >
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-8 bg-white rounded shadow-sm flex items-center justify-center gap-0.5 pointer-events-none">
                         <div className="w-0.5 h-4 bg-zinc-300 rounded-full" />
                         <div className="w-0.5 h-4 bg-zinc-300 rounded-full" />
                       </div>
                    </div>
                    <input 
                       type="range"
                       min="0" max="100"
                       value={sliderPos}
                       onChange={(e) => setSliderPos(Number(e.target.value))}
                       className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20 pointer-events-auto"
                    />
                 </>
              )}
            </div>
          )}
          {!isProcessing && (
             <div className="absolute top-4 left-4 text-white/70 bg-black/50 px-2 py-1 rounded text-sm pointer-events-none z-30">Original</div>
          )}
          {!isProcessing && (
             <div className="absolute top-4 right-4 text-white/70 bg-black/50 px-2 py-1 rounded text-sm pointer-events-none z-30">Enhanced (Upscaled)</div>
          )}
        </div>
        <div className="p-4 border-t border-zinc-100 flex justify-between items-center bg-white">
          <div className="text-sm text-zinc-500">
            Drag the slider to compare original (left) and enhanced (right).
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium rounded-lg transition-colors">
              Cancel
            </button>
            <button 
              onClick={handleSave} 
              disabled={isProcessing} 
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <Check className="w-4 h-4" /> Save Enhanced Copy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

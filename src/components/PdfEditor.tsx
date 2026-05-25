import React, { useState, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { X, Trash2, FileOutput, CheckSquare, Square, Loader2 } from 'lucide-react';
import type { AppFile } from '../features/files';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfEditorProps {
  file: AppFile;
  onClose: () => void;
  onUpdate: (id: string, newFile: File) => void;
  onExtract: (newFile: File) => void;
}

export default function PdfEditor({ file, onClose, onUpdate, onExtract }: PdfEditorProps) {
  const [pages, setPages] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadPages = async () => {
      setIsLoading(true);
      try {
        const arrayBuffer = await file.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const numPages = pdf.numPages;
        const pageImages: string[] = [];

        for (let i = 1; i <= numPages; i++) {
          if (!isMounted) break;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 0.5 }); // Thumbnail scale
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport } as any).promise;
            pageImages.push(canvas.toDataURL('image/jpeg', 0.8));
          }
        }
        if (isMounted) {
          setPages(pageImages);
          setSelectedPages(new Set());
        }
      } catch (error) {
        console.error("Error loading PDF pages:", error);
        if (isMounted) alert("Failed to load PDF pages for preview.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadPages();

    return () => {
      isMounted = false;
    };
  }, [file.file]);

  const toggleSelection = (index: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedPages.size === pages.length) {
      setSelectedPages(new Set());
    } else {
      setSelectedPages(new Set(pages.map((_, i) => i)));
    }
  };

  const handleDelete = async () => {
    if (selectedPages.size === 0) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      // Remove in reverse order to not mess up indices
      const indicesToRemove = Array.from<number>(selectedPages).sort((a, b) => b - a);
      for (const index of indicesToRemove) {
        pdfDoc.removePage(index);
      }
      
      const pdfBytes = await pdfDoc.save();
      const newFile = new File([pdfBytes], file.name, { type: 'application/pdf' });
      onUpdate(file.id, newFile);
    } catch (error) {
      console.error("Error deleting pages:", error);
      alert("Failed to delete pages.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExtract = async () => {
    if (selectedPages.size === 0) return;
    setIsProcessing(true);
    try {
      const arrayBuffer = await file.file.arrayBuffer();
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();
      
      const indicesToExtract = Array.from<number>(selectedPages).sort((a, b) => a - b);
      const copiedPages = await newPdf.copyPages(sourcePdf, indicesToExtract);
      
      copiedPages.forEach(page => newPdf.addPage(page));
      
      const pdfBytes = await newPdf.save();
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      const newName = `${baseName}-extracted-${Date.now()}.pdf`;
      const newFile = new File([pdfBytes], newName, { type: 'application/pdf' });
      
      onExtract(newFile);
      setSelectedPages(new Set());
    } catch (error) {
      console.error("Error extracting pages:", error);
      alert("Failed to extract pages.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-50/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-zinc-200 shadow-sm">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-zinc-800 truncate max-w-md" title={file.name}>
            {file.name}
          </h2>
          <span className="text-sm text-zinc-500 bg-zinc-100 px-2 py-1 rounded-md">
            {pages.length} Pages
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-zinc-200">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleAll}
            disabled={pages.length === 0 || isLoading || isProcessing}
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {selectedPages.size === pages.length && pages.length > 0 ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {selectedPages.size === pages.length && pages.length > 0 ? 'Deselect All' : 'Select All'}
          </button>
          <span className="text-sm text-zinc-400">|</span>
          <span className="text-sm text-zinc-600">
            {selectedPages.size} selected
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={selectedPages.size === 0 || isProcessing || selectedPages.size === pages.length}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={selectedPages.size === pages.length ? "Cannot delete all pages" : "Delete selected pages"}
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Delete Selected
          </button>
          <button
            onClick={handleExtract}
            disabled={selectedPages.size === 0 || isProcessing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileOutput className="w-4 h-4" />}
            Extract to New PDF
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p>Loading pages...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {pages.map((imgSrc, index) => {
              const isSelected = selectedPages.has(index);
              return (
                <div
                  key={index}
                  onClick={() => toggleSelection(index)}
                  className={`relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-200
                    ${isSelected ? 'border-indigo-500 shadow-md scale-[0.98]' : 'border-zinc-200 hover:border-indigo-300 hover:shadow-sm'}
                  `}
                >
                  <div className="aspect-[1/1.414] bg-white p-2">
                    <img
                      src={imgSrc}
                      alt={`Page ${index + 1}`}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  
                  {/* Overlay */}
                  <div className={`absolute inset-0 bg-indigo-500/10 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <div className="absolute top-3 left-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors
                        ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/80 border-zinc-300 text-transparent'}
                      `}>
                        <CheckSquare className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Page Number */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                    <p className="text-white text-sm font-medium text-center">
                      Page {index + 1}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

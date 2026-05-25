import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ExternalLink } from 'lucide-react';
import * as mammoth from 'mammoth';
import type { AppFile } from '../features/files';

interface FilePreviewProps {
  file: AppFile | null;
  onClose: () => void;
}

export default function FilePreview({ file, onClose }: FilePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [wordHtml, setWordHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setObjectUrl(null);
      setWordHtml(null);
      return;
    }

    if (file.type === 'word') {
      file.file.arrayBuffer().then(buffer => {
        mammoth.convertToHtml({ arrayBuffer: buffer })
          .then(result => setWordHtml(result.value))
          .catch(err => console.error("Mammoth preview err:", err));
      });
      return;
    }

    const url = file.previewUrl || URL.createObjectURL(file.file);
    setObjectUrl(url);

    return () => {
      if (!file.previewUrl && url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [file]);

  return (
    <AnimatePresence>
      {file && (objectUrl || wordHtml) && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-5xl h-[90vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-white shadow-sm z-10">
              <h3 className="font-medium text-zinc-900 truncate pr-4" title={file.name}>
                {file.name}
              </h3>
              <div className="flex items-center gap-2">
                {objectUrl && (
                  <a
                    href={objectUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </a>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-zinc-100 flex items-center justify-center p-4">
              {file.type === 'pdf' && objectUrl ? (
                <iframe
                  src={`${objectUrl}#toolbar=0`}
                  className="w-full h-full rounded-lg shadow-sm bg-white"
                  title={file.name}
                />
              ) : file.type === 'word' && wordHtml ? (
                <div 
                  className="w-full max-w-4xl bg-white shadow-sm rounded-lg p-8 md:p-12 prose prose-zinc max-w-none text-left"
                  dangerouslySetInnerHTML={{ __html: wordHtml }}
                />
              ) : objectUrl ? (
                <img
                  src={objectUrl}
                  alt={file.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

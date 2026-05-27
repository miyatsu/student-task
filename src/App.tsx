import React, { useState, useRef, useCallback } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Download, Loader2, Upload } from 'lucide-react';
import { PDFDocument, PDFRawStream, PDFName } from 'pdf-lib';
import JSZip from 'jszip';
import PdfEditor from './components/PdfEditor';
import AiAssistant from './components/AiAssistant';
import ImageEnhanceModal from './components/ImageEnhanceModal';
import FilePreview from './components/FilePreview';
import HomeHero, { HomeCapabilityStrip } from './components/HomeHero';
import imageCompression from 'browser-image-compression';
import {
  AppFile,
  buildImageToPdfErrorMessage,
  createWordPdfRenderHost,
  embedImageFileInPdf,
  SortConfig,
  SortKey,
  duplicateAppFile,
  getNextSortConfig,
  isSupportedFile,
  moveAppFile,
  partitionAppFiles,
  removeAppFile,
  removeSelectedFiles,
  renameAppFile,
  resolveZipEntryNames,
  selectFilesByIds,
  sortAppFiles,
  toggleAllSelection,
  toggleSelection,
} from './features/files';
import { ImageFilesSection, PdfFilesSection, WordFilesSection } from './features/files/components';
import { createGeminiClient, geminiSetupGuideText } from './lib/gemini';

import * as mammoth from 'mammoth';
// @ts-ignore
import html2pdf from 'html2pdf.js';

type NativeWordPdfBackend = 'libreoffice-cli' | 'word-com';
type WordConversionMethod = NativeWordPdfBackend | 'html-fallback';

const WORD_CONVERSION_METHOD_LABELS: Record<WordConversionMethod, string> = {
  'libreoffice-cli': 'Method: LibreOffice CLI export',
  'word-com': 'Method: local Microsoft Word export',
  'html-fallback': 'Method: browser HTML fallback',
};

const buildWordConversionMethodLabel = (method: WordConversionMethod) => WORD_CONVERSION_METHOD_LABELS[method];

const isNativeWordPdfBackend = (value: string | null): value is NativeWordPdfBackend => (
  value === 'libreoffice-cli' || value === 'word-com'
);

const buildNextWordConversionMethodLabel = (
  wordUnavailable: boolean,
  cliUnavailable: boolean,
) => {
  if (!wordUnavailable) {
    return buildWordConversionMethodLabel('word-com');
  }

  if (!cliUnavailable) {
    return buildWordConversionMethodLabel('libreoffice-cli');
  }

  return buildWordConversionMethodLabel('html-fallback');
};

export default function App() {
  const [pdfFiles, setPdfFiles] = useState<AppFile[]>([]);
  const [imageFiles, setImageFiles] = useState<AppFile[]>([]);
  const [wordFiles, setWordFiles] = useState<AppFile[]>([]);
  const [selectedPdfIds, setSelectedPdfIds] = useState<Set<string>>(new Set());
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  
  const [imageSort, setImageSort] = useState<SortConfig | null>(null);
  const [pdfSort, setPdfSort] = useState<SortConfig | null>(null);
  const [wordSort, setWordSort] = useState<SortConfig | null>(null);
  
  const [isDragging, setIsDragging] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [enhanceFile, setEnhanceFile] = useState<AppFile | null>(null);
  const [editingPagesPdfId, setEditingPagesPdfId] = useState<string | null>(null);
  const [aiAssistantFiles, setAiAssistantFiles] = useState<AppFile[] | null>(null);
  const [editingName, setEditingName] = useState("");
  const [extractingTextId, setExtractingTextId] = useState<string | null>(null);
  const [extractingImagesId, setExtractingImagesId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<AppFile | null>(null);
  const [imageConversionProgress, setImageConversionProgress] = useState<{
    completed: number;
    total: number;
    currentFileName: string | null;
  } | null>(null);
  const [wordConversionProgress, setWordConversionProgress] = useState<{
    completed: number;
    total: number;
    currentFileName: string | null;
    startedAt?: number;
    detailLabel?: string | null;
  } | null>(null);
  const libreOfficeWordPdfBackendUnavailableRef = useRef(false);
  const wordComPdfBackendUnavailableRef = useRef(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = useCallback((newFiles: FileList | File[]) => {
    const validFiles = Array.from(newFiles).filter(isSupportedFile);
    
    if (validFiles.length === 0) {
      alert('Please upload only PDF, Word, or Image (PNG, JPG, JPEG) files.');
      return;
    }

    const groupedFiles = partitionAppFiles(validFiles);
    const newPdfs = groupedFiles.pdf;
    const newImgs = groupedFiles.image;
    const newWords = groupedFiles.word;

    if (newPdfs.length > 0) {
      setPdfFiles(prev => [...prev, ...newPdfs]);
      setSelectedPdfIds(prev => new Set([...prev, ...newPdfs.map(f => f.id)]));
    }
    if (newImgs.length > 0) {
      setImageFiles(prev => [...prev, ...newImgs]);
      setSelectedImageIds(prev => new Set([...prev, ...newImgs.map(f => f.id)]));
    }
    if (newWords.length > 0) {
      setWordFiles(prev => [...prev, ...newWords]);
      setSelectedWordIds(prev => new Set([...prev, ...newWords.map(f => f.id)]));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const handleUploadZoneKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    openFilePicker();
  }, [openFilePicker]);

  const removeFile = (id: string, type: AppFile['type']) => {
    if (type === 'pdf') {
      setPdfFiles(prev => removeAppFile(prev, id));
      setSelectedPdfIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else if (type === 'word') {
      setWordFiles(prev => removeAppFile(prev, id));
      setSelectedWordIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      setImageFiles(prev => removeAppFile(prev, id));
      setSelectedImageIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSort = (type: AppFile['type'], key: SortKey) => {
    let currentConfig: SortConfig | null = null;
    if (type === 'pdf') currentConfig = pdfSort;
    else if (type === 'image') currentConfig = imageSort;
    else if (type === 'word') currentConfig = wordSort;

    const newConfig = getNextSortConfig(currentConfig, key);

    if (type === 'pdf') {
      setPdfSort(newConfig);
      setPdfFiles(prev => sortAppFiles(prev, newConfig));
    } else if (type === 'image') {
      setImageSort(newConfig);
      setImageFiles(prev => sortAppFiles(prev, newConfig));
    } else if (type === 'word') {
      setWordSort(newConfig);
      setWordFiles(prev => sortAppFiles(prev, newConfig));
    }
  };

  const moveFile = (type: AppFile['type'], id: string, direction: 'up' | 'down') => {
    if (type === 'pdf') {
      setPdfFiles(prev => moveAppFile(prev, id, direction));
      setPdfSort(null);
    } else if (type === 'image') {
      setImageFiles(prev => moveAppFile(prev, id, direction));
      setImageSort(null);
    } else {
      setWordFiles(prev => moveAppFile(prev, id, direction));
      setWordSort(null);
    }
  };

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { source, destination } = result;

    if (source.droppableId === destination.droppableId) {
      if (source.droppableId === 'pdf-list') {
        const items = Array.from(pdfFiles);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);
        setPdfFiles(items);
        setPdfSort(null);
      } else if (source.droppableId === 'image-list') {
        const items = Array.from(imageFiles);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);
        setImageFiles(items);
        setImageSort(null);
      } else if (source.droppableId === 'word-list') {
        const items = Array.from(wordFiles);
        const [reorderedItem] = items.splice(source.index, 1);
        items.splice(destination.index, 0, reorderedItem);
        setWordFiles(items);
        setWordSort(null);
      }
    }
  };

  const startRename = (file: AppFile) => {
    setEditingFileId(file.id);
    setEditingName(file.name);
  };

  const saveRename = (id: string, type: AppFile['type']) => {
    if (!editingName.trim()) {
      setEditingFileId(null);
      return;
    }

    const nextName = editingName.trim();
    const applyRename = (file: AppFile) => file.id === id ? renameAppFile(file, nextName) : file;

    if (type === 'pdf') {
      setPdfFiles(prev => prev.map(applyRename));
    } else if (type === 'word') {
      setWordFiles(prev => prev.map(applyRename));
    } else {
      setImageFiles(prev => prev.map(applyRename));
    }
    setEditingFileId(null);
  };

  const duplicateFile = (file: AppFile, type: AppFile['type']) => {
    const newAppFile = duplicateAppFile(file);

    if (type === 'pdf') {
      setPdfFiles(prev => [...prev, newAppFile]);
    } else if (type === 'word') {
      setWordFiles(prev => [...prev, newAppFile]);
    } else if (type === 'image') {
      setImageFiles(prev => [...prev, newAppFile]);
    }
  };

  const rotateImage = async (imgFile: AppFile) => {
    try {
      const imgUrl = URL.createObjectURL(imgFile.file);
      const img = new Image();
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.height;
      canvas.height = img.width;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, imgFile.file.type));
      if (blob) {
        const newFile = new File([blob], imgFile.name, { type: imgFile.file.type });
        const newPreviewUrl = URL.createObjectURL(newFile);
        
        setImageFiles(prev => prev.map(f => f.id === imgFile.id ? { ...f, file: newFile, size: newFile.size, previewUrl: newPreviewUrl } : f));
      }
    } catch (error) {
      console.error("Error rotating image:", error);
      alert("An error occurred while rotating the image.");
    }
  };

  const toggleWordSelection = (id: string) => {
    setSelectedWordIds(prev => toggleSelection(prev, id));
  };

  const togglePdfSelection = (id: string) => {
    setSelectedPdfIds(prev => toggleSelection(prev, id));
  };

  const toggleImageSelection = (id: string) => {
    setSelectedImageIds(prev => toggleSelection(prev, id));
  };

  const toggleAllPdfs = () => {
    setSelectedPdfIds(prev => toggleAllSelection(prev, pdfFiles));
  };

  const toggleAllWords = () => {
    setSelectedWordIds(prev => toggleAllSelection(prev, wordFiles));
  };

  const deleteSelectedWords = () => {
    setWordFiles(prev => removeSelectedFiles(prev, selectedWordIds));
    setSelectedWordIds(new Set());
  };

  const toggleAllImages = () => {
    setSelectedImageIds(prev => toggleAllSelection(prev, imageFiles));
  };

  const deleteSelectedImages = () => {
    setImageFiles(prev => removeSelectedFiles(prev, selectedImageIds));
    setSelectedImageIds(new Set());
  };

  const deleteSelectedPdfs = () => {
    setPdfFiles(prev => removeSelectedFiles(prev, selectedPdfIds));
    setSelectedPdfIds(new Set());
  };

  const isLegacyWordFile = (file: File) => {
    const lowerCaseFileName = file.name.toLowerCase();
    return lowerCaseFileName.endsWith('.doc') && !lowerCaseFileName.endsWith('.docx');
  };

  const buildWordToPdfErrorMessage = (fileName: string, error: unknown) => {
    if (error instanceof Error && error.message.trim()) {
      return `Failed to convert "${fileName}" to PDF: ${error.message.trim()}`;
    }

    return `Failed to convert "${fileName}" to PDF: ${String(error)}`;
  };

  const updateWordConversionProgress = (progress: {
    completed: number;
    total: number;
    currentFileName: string | null;
    startedAt: number;
    detailLabel?: string | null;
  }) => {
    setWordConversionProgress(progress);
  };

  const extractLegacyWordHtml = async (file: File) => {
    const formData = new FormData();
    formData.append('word', file);

    const response = await fetch('/api/word/extract-html', {
      method: 'POST',
      body: formData,
    });

    let payload: { html?: string; error?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.error || `Server returned ${response.status} while reading the .doc file.`);
    }

    if (!payload?.html) {
      throw new Error('Server did not return readable HTML for the .doc file.');
    }

    return payload.html;
  };

  const convertWordFileToHtml = async (word: AppFile) => {
    if (isLegacyWordFile(word.file)) {
      return extractLegacyWordHtml(word.file);
    }

    const arrayBuffer = await word.file.arrayBuffer();
    const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
    return html;
  };

  const convertWordFileToNativePdf = async (file: File, preferredBackend: NativeWordPdfBackend) => {
    const formData = new FormData();
    formData.append('word', file);

    const response = await fetch(`/api/word/convert-pdf?backend=${preferredBackend}`, {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      const backendHeader = response.headers.get('X-Word-Pdf-Backend');
      return {
        blob: await response.blob(),
        backend: isNativeWordPdfBackend(backendHeader) ? backendHeader : preferredBackend,
      };
    }

    let payload: { error?: string; code?: string } | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw Object.assign(
      new Error(
        payload?.error
        || `Server returned ${response.status} while exporting the Word file through the local native backend.`,
      ),
      {
        code: payload?.code,
        preferredBackend,
      },
    );
  };

  const renderWordHtmlToPdfBlob = async (html: string) => {
    const renderHost = createWordPdfRenderHost(html);

    try {
      const opt: any = {
        margin: 10,
        filename: 'temp.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      return await html2pdf().set(opt).from(renderHost.source).output('blob');
    } finally {
      renderHost.dispose();
    }
  };

  const convertWordFileToPdfBlob = async (
    word: AppFile,
    onMethodChange: (methodLabel: string) => void,
  ) => {
    const nativeErrors: Error[] = [];
    const nativeBackendsToTry: NativeWordPdfBackend[] = [];

    if (!wordComPdfBackendUnavailableRef.current) {
      nativeBackendsToTry.push('word-com');
    }

    if (!libreOfficeWordPdfBackendUnavailableRef.current) {
      nativeBackendsToTry.push('libreoffice-cli');
    }

    for (const backend of nativeBackendsToTry) {
      onMethodChange(buildWordConversionMethodLabel(backend));

      try {
        const nativeResult = await convertWordFileToNativePdf(word.file, backend);
        return {
          blob: nativeResult.blob,
          mode: 'native' as const,
          backend: nativeResult.backend,
        };
      } catch (error) {
        const nativeError = error instanceof Error ? error : new Error(String(error));
        const errorCode = 'code' in nativeError ? nativeError.code : undefined;

        if (backend === 'libreoffice-cli' && errorCode === 'native-backend-unavailable') {
          libreOfficeWordPdfBackendUnavailableRef.current = true;
        }

        if (backend === 'word-com' && errorCode === 'native-backend-unavailable') {
          wordComPdfBackendUnavailableRef.current = true;
        }

        nativeErrors.push(nativeError);
      }
    }

    try {
      onMethodChange(buildWordConversionMethodLabel('html-fallback'));
      const html = await convertWordFileToHtml(word);
      const blob = await renderWordHtmlToPdfBlob(html);
      return {
        blob,
        mode: 'fallback' as const,
        backend: 'html-fallback' as const,
      };
    } catch (fallbackError) {
      if (nativeErrors.length > 0) {
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new Error(`${nativeErrors.map((error) => error.message).join(' ')} Fallback rendering also failed: ${fallbackMessage}`);
      }

      throw fallbackError;
    }
  };

  const convertSelectedWords = async () => {
    const selected = selectFilesByIds(wordFiles, selectedWordIds);
    if (selected.length === 0) return;

    const startedAt = Date.now();
    let completedSuccessfully = false;
    let lastMethodLabel = buildNextWordConversionMethodLabel(
      wordComPdfBackendUnavailableRef.current,
      libreOfficeWordPdfBackendUnavailableRef.current,
    );

    setIsConverting(true);
    updateWordConversionProgress({
      completed: 0,
      total: selected.length,
      currentFileName: selected[0]?.name ?? null,
      startedAt,
      detailLabel: lastMethodLabel,
    });
    try {
      const newPdfs: AppFile[] = [];

      for (const [index, word] of selected.entries()) {
        lastMethodLabel = buildNextWordConversionMethodLabel(
          wordComPdfBackendUnavailableRef.current,
          libreOfficeWordPdfBackendUnavailableRef.current,
        );

        updateWordConversionProgress({
          completed: index,
          total: selected.length,
          currentFileName: word.name,
          startedAt,
          detailLabel: lastMethodLabel,
        });

        const conversionResult = await convertWordFileToPdfBlob(word, (detailLabel) => {
          lastMethodLabel = detailLabel;
          updateWordConversionProgress({
            completed: index,
            total: selected.length,
            currentFileName: word.name,
            startedAt,
            detailLabel,
          });
        });

        const baseName = word.name.replace(/\.[^/.]+$/, "");
        const newName = `${baseName}.pdf`;
        const newFile = new File([conversionResult.blob], newName, { type: 'application/pdf' });

        newPdfs.push({
          id: Math.random().toString(36).substring(7),
          file: newFile,
          name: newName,
          size: newFile.size,
          type: 'pdf'
        });

        lastMethodLabel = conversionResult.mode === 'native'
          ? buildWordConversionMethodLabel(conversionResult.backend)
          : buildWordConversionMethodLabel('html-fallback');

        updateWordConversionProgress({
          completed: index + 1,
          total: selected.length,
          currentFileName: selected[index + 1]?.name ?? null,
          startedAt,
          detailLabel: lastMethodLabel,
        });
      }

      updateWordConversionProgress({
        completed: selected.length,
        total: selected.length,
        currentFileName: null,
        startedAt,
        detailLabel: lastMethodLabel,
      });
      
      setPdfFiles(prev => [...prev, ...newPdfs]);
      setSelectedPdfIds(prev => new Set([...prev, ...newPdfs.map(f => f.id)]));
      completedSuccessfully = true;
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 400);
      });
    } catch (error) {
      console.error(error);
      const activeFileName = wordConversionProgress?.currentFileName ?? selected[0]?.name ?? 'selected Word document';
      alert(buildWordToPdfErrorMessage(activeFileName, error));
    } finally {
      if (!completedSuccessfully) {
        setWordConversionProgress(null);
        setIsConverting(false);
        return;
      }

      setWordConversionProgress(null);
      setIsConverting(false);
    }
  };

  const convertSelectedImages = async () => {
    const selectedImgs = selectFilesByIds(imageFiles, selectedImageIds);
    if (selectedImgs.length === 0) return;

    setIsConverting(true);
    setConversionError(null);
    setImageConversionProgress({
      completed: 0,
      total: selectedImgs.length,
      currentFileName: selectedImgs[0]?.name ?? null,
    });
    try {
      const newPdfs: AppFile[] = [];
      
      for (const [index, img] of selectedImgs.entries()) {
        setImageConversionProgress({
          completed: index,
          total: selectedImgs.length,
          currentFileName: img.name,
        });

        try {
          const pdfDoc = await PDFDocument.create();
          const { image } = await embedImageFileInPdf(pdfDoc, img.file);
          const page = pdfDoc.addPage([image.width, image.height]);
          page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
          const pdfBytes = await pdfDoc.save();
          
          const baseName = img.name.replace(/\.[^/.]+$/, "");
          const newName = `${baseName}.pdf`;
          const newFile = new File([pdfBytes], newName, { type: 'application/pdf' });
          
          newPdfs.push({
            id: Math.random().toString(36).substring(7),
            file: newFile,
            name: newName,
            size: newFile.size,
            type: 'pdf'
          });

          setImageConversionProgress({
            completed: index + 1,
            total: selectedImgs.length,
            currentFileName: selectedImgs[index + 1]?.name ?? null,
          });
        } catch (error) {
          throw new Error(buildImageToPdfErrorMessage(img.name, error));
        }
      }
      
      setPdfFiles(prev => [...prev, ...newPdfs]);
      setSelectedPdfIds(prev => new Set([...prev, ...newPdfs.map(p => p.id)]));
      
      // Clear selection of images after conversion, but keep the images in the list
      setSelectedImageIds(new Set());
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : buildImageToPdfErrorMessage('selected image', error);
      console.error("Error converting images:", error);
      setConversionError(message);
      alert(message);
    } finally {
      setImageConversionProgress(null);
      setIsConverting(false);
    }
  };

  const compressSelectedImages = async (level: 'low' | 'medium' | 'high') => {
    const selectedImgs = selectFilesByIds(imageFiles, selectedImageIds);
    if (selectedImgs.length === 0) return;

    setIsCompressing(true);
    try {
      const newImages: AppFile[] = [];
      const timestamp = Date.now();

      for (const img of selectedImgs) {
        let options = {
          maxSizeMB: 1,
          maxWidthOrHeight: 1920,
          useWebWorker: false, // Turned off to prevent issues
        };
        
        if (level === 'low') {
          options.maxSizeMB = 0.5;
        } else if (level === 'high') {
          options.maxSizeMB = 2;
        }
        
        const compressedFile = await imageCompression(img.file, options);
        const baseName = img.name.replace(/\.[^/.]+$/, "");
        const extension = img.name.split('.').pop() || 'jpg';
        const newName = `compressed-${baseName}-${timestamp}.${extension}`;
        
        const newFile = new File([compressedFile], newName, { type: compressedFile.type });

        newImages.push({
          id: Math.random().toString(36).substring(7),
          file: newFile,
          name: newName,
          size: newFile.size,
          type: 'image',
          previewUrl: URL.createObjectURL(newFile)
        });
      }

      setImageFiles(prev => [...prev, ...newImages]);
      setSelectedImageIds(prev => new Set([...prev, ...newImages.map(p => p.id)]));
    } catch (error) {
      console.error("Error compressing images:", error);
      alert("An error occurred while compressing the images.");
    } finally {
      setIsCompressing(false);
    }
  };

  const compressSelectedPdfs = async (level: 'low' | 'medium' | 'high') => {
    const selectedPdfs = selectFilesByIds(pdfFiles, selectedPdfIds);
    if (selectedPdfs.length === 0) return;

    setIsCompressing(true);
    try {
      const newPdfs: AppFile[] = [];
      const timestamp = Date.now();

      for (const pdfFile of selectedPdfs) {
        const formData = new FormData();
        formData.append("pdf", pdfFile.file);
        formData.append("level", level);

        const startRes = await fetch("/api/compress/start", {
          method: "POST",
          body: formData,
        });

        if (!startRes.ok) throw new Error(`Failed to start compression for ${pdfFile.name}`);
        
        const { jobId } = await startRes.json();
        
        let isDone = false;
        while (!isDone) {
          await new Promise(r => setTimeout(r, 2000)); // poll every 2 seconds
          const statusRes = await fetch(`/api/compress/status/${jobId}`);
          if (!statusRes.ok) throw new Error("Failed to check status");
          const statusData = await statusRes.json();
          if (statusData.status === "done") {
            isDone = true;
          } else if (statusData.status === "error") {
            throw new Error(statusData.error || "Unknown compression error");
          }
        }

        const downloadRes = await fetch(`/api/compress/download/${jobId}`);
        if (!downloadRes.ok) throw new Error(`Failed to download compressed ${pdfFile.name}`);

        const compressedBlob = await downloadRes.blob();
        const baseName = pdfFile.name.replace(/\.[^/.]+$/, "");
        const newName = `compressed-${baseName}-${timestamp}.pdf`;
        const newFile = new File([compressedBlob], newName, { type: 'application/pdf' });

        newPdfs.push({
          id: Math.random().toString(36).substring(7),
          file: newFile,
          name: newName,
          size: newFile.size,
          type: 'pdf'
        });
      }

      setPdfFiles(prev => [...prev, ...newPdfs]);
      setSelectedPdfIds(prev => new Set([...prev, ...newPdfs.map(p => p.id)]));
    } catch (error) {
      console.error("Error compressing PDFs:", error);
      alert(error instanceof Error ? error.message : "An error occurred while compressing the PDFs.");
    } finally {
      setIsCompressing(false);
    }
  };

  const mergeSelectedPdfs = async () => {
    const selectedPdfs = selectFilesByIds(pdfFiles, selectedPdfIds);
    if (selectedPdfs.length < 2) return;

    setIsMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdfFile of selectedPdfs) {
        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      }

      const mergedPdfBytes = await mergedPdf.save();
      
      let finalName = `merged-${Date.now()}.pdf`;

      const newFile = new File([mergedPdfBytes], finalName, { type: 'application/pdf' });
      const newAppFile: AppFile = {
        id: Math.random().toString(36).substring(7),
        file: newFile,
        name: finalName,
        size: newFile.size,
        type: 'pdf'
      };

      setPdfFiles(prev => [...prev, newAppFile]);
      setSelectedPdfIds(prev => new Set([...prev, newAppFile.id]));
    } catch (error) {
      console.error("Error merging PDFs:", error);
      alert("An error occurred while merging the PDFs.");
    } finally {
      setIsMerging(false);
    }
  };

  const downloadSelected = async () => {
    const selectedPdfs = selectFilesByIds(pdfFiles, selectedPdfIds);
    const selectedImgs = selectFilesByIds(imageFiles, selectedImageIds);
    const selectedWords = selectFilesByIds(wordFiles, selectedWordIds);
    const allSelected = [...selectedPdfs, ...selectedImgs, ...selectedWords];

    if (allSelected.length === 0) return;

    if (allSelected.length === 1) {
      const file = allSelected[0].file;
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = allSelected[0].name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    setIsDownloading(true);
    try {
      const zip = new JSZip();

      resolveZipEntryNames(allSelected).forEach(({ file, name }) => {
        zip.file(name, file.file);
      });
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `download-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error zipping files:", error);
      alert("Failed to download files.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExtractText = async (appFile: AppFile) => {
    setExtractingTextId(appFile.id);
    try {
      const ai = await createGeminiClient();
      if (!ai) {
        alert(geminiSetupGuideText);
        return;
      }

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(appFile.file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { data: base64, mimeType: appFile.file.type } },
              { text: 'Extract all text from this image. Output ONLY the extracted text in Markdown format. Do not include any conversational filler, explanations, or markdown code blocks around the entire output.' }
            ]
          }
        ]
      });

      const text = response.text || '';
      
      const blob = new Blob([text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${appFile.name.split('.')[0]}-extracted.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error extracting text:', error);
      alert('Failed to extract text. Please try again.');
    } finally {
      setExtractingTextId(null);
    }
  };

  const [convertingToImgId, setConvertingToImgId] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  const handleConvertToVector = async (appFile: AppFile) => {
    setConvertingToImgId(appFile.id);
    setConversionError(null);
    try {
      const formData = new FormData();
      formData.append("pdf", appFile.file);
      formData.append("format", "svg");

      const response = await fetch("/api/pdf2img", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server returned ${response.status}: ${errorText.substring(0, 100)}`);
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(`Expected JSON but got ${contentType}: ${text.substring(0, 100)}`);
      }

      const data = await response.json();
      
      if (!data || !data.pages || data.pages.length === 0) {
        throw new Error("No pages returned from server.");
      }

      const newImgs: AppFile[] = [];
      
      data.pages.forEach((pageData: string, index: number) => {
        const mimeType = 'image/svg+xml';
        const blob = new Blob([pageData], { type: mimeType });
        const padIndex = String(index + 1).padStart(3, '0');
        const fileObj = new File([blob], `${appFile.name.replace(/\.pdf$/i, '')}_page_${padIndex}.svg`, { type: mimeType });
        
        newImgs.push({
          id: Math.random().toString(36).substring(7),
          file: fileObj,
          name: fileObj.name,
          size: fileObj.size,
          type: 'image',
          previewUrl: URL.createObjectURL(blob)
        });
      });
      
      setImageFiles(prev => [...prev, ...newImgs]);
      setSelectedImageIds(prev => new Set([...prev, ...newImgs.map(f => f.id)]));
    } catch (e) {
      setConversionError("Error converting PDF to vector: " + String(e));
      console.error(e);
      // alert is blocked in iframe, clear error after 10 seconds
      setTimeout(() => setConversionError(null), 10000);
    } finally {
      setConvertingToImgId(null);
    }
  };

  const handleExtractImages = async (appFile: AppFile) => {
    setExtractingImagesId(appFile.id);
    try {
      const arrayBuffer = await appFile.file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const extractedFiles: File[] = [];
      
      const enumerated = pdfDoc.context.enumerateIndirectObjects();
      let imageCount = 0;
      for (const [ref, pdfObject] of enumerated) {
        if (pdfObject instanceof PDFRawStream) {
          const subtype = pdfObject.dict.lookup(PDFName.of('Subtype'));
          if (subtype === PDFName.of('Image')) {
            const filter = pdfObject.dict.lookup(PDFName.of('Filter'));
            
            // We only handle DCTDecode (JPEG) for now as it's the most common and easiest to extract directly
            if (filter === PDFName.of('DCTDecode')) {
              imageCount++;
              const bytes = pdfObject.contents;
              const blob = new Blob([bytes], { type: 'image/jpeg' });
              const extractedFile = new File([blob], `${appFile.name.replace('.pdf', '')}-img-${imageCount}.jpg`, { type: 'image/jpeg' });
              extractedFiles.push(extractedFile);
            }
          }
        }
      }

      if (extractedFiles.length > 0) {
        processFiles(extractedFiles);
        alert(`Successfully extracted ${extractedFiles.length} image(s) and added them to your Images list.`);
      } else {
        alert('No extractable JPEG images found in this PDF.');
      }
    } catch (error) {
      console.error('Error extracting images:', error);
      alert('Failed to extract images. Please try again.');
    } finally {
      setExtractingImagesId(null);
    }
  };

  const totalSelected = selectedPdfIds.size + selectedImageIds.size + selectedWordIds.size;

  const openAiAssistant = (files: AppFile[]) => {
    setAiAssistantFiles(files);
  };

  const openPreview = (file: AppFile) => {
    setPreviewFile(file);
  };

  const openEnhanceModal = (file: AppFile) => {
    setEnhanceFile(file);
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-slate-950 font-sans selection:bg-slate-200 selection:text-slate-950 pb-32">
      <div className="mx-auto max-w-6xl px-6 py-12 lg:px-8 lg:py-16">
        <section className="space-y-4 rounded-[2.75rem] border border-zinc-200/80 bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.18),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(244,244,245,0.92))] p-3 shadow-[0_28px_90px_-48px_rgba(24,24,27,0.35)] sm:p-4 lg:p-5">
          <HomeHero onChooseFiles={openFilePicker} />

          <div className="rounded-[2.15rem] border border-zinc-200/75 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_44px_-38px_rgba(24,24,27,0.28)] sm:p-5 lg:p-6">
            <HomeCapabilityStrip />

            <div className="mt-4 sm:mt-5">
              <div
                id="workspace-upload-panel"
                role="button"
                tabIndex={0}
                aria-label="Upload files to your workspace"
                className={`group relative flex min-h-[16rem] flex-col justify-center overflow-hidden rounded-[2rem] border border-dashed bg-white/90 px-6 py-10 text-center transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 sm:px-8 sm:py-12
                  ${isDragging
                    ? 'border-sky-300 bg-sky-50/65 shadow-lg shadow-sky-100/70'
                    : 'border-slate-300 shadow-sm shadow-slate-200/60 hover:border-slate-400 hover:shadow-slate-200/80'
                  }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={openFilePicker}
                onKeyDown={handleUploadZoneKeyDown}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-sky-100/70 via-emerald-50/45 to-transparent" />
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/png,image/jpeg,image/jpg,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileInput}
                />

                <div className="relative mx-auto h-16 w-16 rounded-full bg-sky-100 text-sky-700 shadow-sm shadow-sky-100/80 flex items-center justify-center">
                  <Upload className="h-8 w-8" />
                </div>
                <p className="relative mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">Workspace Upload</p>

                <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-zinc-500">
                    {['PDF', 'DOC / DOCX', 'PNG', 'JPG / JPEG'].map((item) => (
                      <span key={item} className="rounded-full border border-zinc-200 bg-white/85 px-3 py-1.5">
                        {item}
                      </span>
                    ))}
                </div>

                <p className="relative mt-5 text-sm leading-7 text-zinc-500">
                  Choose files from your device, or drag and drop them here.
                </p>
              </div>
            </div>
          </div>
        </section>

        <main className="mt-10 space-y-8">
          {conversionError && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
              <p className="font-medium">Error</p>
              <p className="text-sm">{conversionError}</p>
            </div>
          )}

          <DragDropContext onDragEnd={onDragEnd}>
            
            <ImageFilesSection
              files={imageFiles}
              selectedIds={selectedImageIds}
              sortConfig={imageSort}
              editingFileId={editingFileId}
              editingName={editingName}
              onEditingNameChange={setEditingName}
              onCancelEditing={() => setEditingFileId(null)}
              onSaveRename={(id) => saveRename(id, 'image')}
              onStartRename={startRename}
              onToggleAll={toggleAllImages}
              onToggleSelection={toggleImageSelection}
              onSort={(key) => handleSort('image', key)}
              onMove={(id, direction) => moveFile('image', id, direction)}
              onOpenPreview={openPreview}
              onDuplicate={(file) => duplicateFile(file, 'image')}
              onRotate={rotateImage}
              onEnhance={openEnhanceModal}
              onAskAi={openAiAssistant}
              onExtractText={handleExtractText}
              extractingTextId={extractingTextId}
              onRemove={(id) => removeFile(id, 'image')}
              onDeleteSelected={deleteSelectedImages}
              onCompress={compressSelectedImages}
              isCompressing={isCompressing}
              onConvertSelected={convertSelectedImages}
              isConverting={isConverting}
              conversionProgress={imageConversionProgress}
            />

            <PdfFilesSection
              files={pdfFiles}
              selectedIds={selectedPdfIds}
              sortConfig={pdfSort}
              editingFileId={editingFileId}
              editingName={editingName}
              onEditingNameChange={setEditingName}
              onCancelEditing={() => setEditingFileId(null)}
              onSaveRename={(id) => saveRename(id, 'pdf')}
              onStartRename={startRename}
              onToggleAll={toggleAllPdfs}
              onToggleSelection={togglePdfSelection}
              onSort={(key) => handleSort('pdf', key)}
              onMove={(id, direction) => moveFile('pdf', id, direction)}
              onOpenPreview={openPreview}
              onDuplicate={(file) => duplicateFile(file, 'pdf')}
              onAskAi={openAiAssistant}
              onExtractImages={handleExtractImages}
              extractingImagesId={extractingImagesId}
              onConvertToVector={handleConvertToVector}
              convertingToImgId={convertingToImgId}
              onEditPages={(file) => setEditingPagesPdfId(file.id)}
              onRemove={(id) => removeFile(id, 'pdf')}
              onDeleteSelected={deleteSelectedPdfs}
              onCompress={compressSelectedPdfs}
              isCompressing={isCompressing}
              onMergeSelected={mergeSelectedPdfs}
              isMerging={isMerging}
            />

            <WordFilesSection
              files={wordFiles}
              selectedIds={selectedWordIds}
              sortConfig={wordSort}
              editingFileId={editingFileId}
              editingName={editingName}
              onEditingNameChange={setEditingName}
              onCancelEditing={() => setEditingFileId(null)}
              onSaveRename={(id) => saveRename(id, 'word')}
              onStartRename={startRename}
              onToggleAll={toggleAllWords}
              onToggleSelection={toggleWordSelection}
              onSort={(key) => handleSort('word', key)}
              onMove={(id, direction) => moveFile('word', id, direction)}
              onOpenPreview={openPreview}
              onDuplicate={(file) => duplicateFile(file, 'word')}
              onAskAi={openAiAssistant}
              onRemove={(id) => removeFile(id, 'word')}
              onDeleteSelected={deleteSelectedWords}
              onConvertSelected={convertSelectedWords}
              isConverting={isConverting}
              conversionProgress={wordConversionProgress}
            />

          </DragDropContext>
        </main>
      </div>

      {/* Floating Download Bar */}
      {totalSelected > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 shadow-[0_-10px_30px_-10px_rgba(0,0,0,0.1)] p-4 z-50 animate-in slide-in-from-bottom-full duration-300">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-zinc-700 bg-zinc-100 px-3 py-1 rounded-full">
                {totalSelected} file(s) selected
              </span>
              <span className="text-sm text-zinc-500 hidden sm:inline-block">
                Ready to download
              </span>
            </div>
            <button
              onClick={downloadSelected}
              disabled={isDownloading}
              className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all text-sm
                ${isDownloading
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm hover:shadow active:scale-[0.98]'
                }
              `}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Preparing Download...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Download Selected
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* PDF Editor Modal */}
      {editingPagesPdfId && (
        <PdfEditor
          file={pdfFiles.find(f => f.id === editingPagesPdfId)!}
          onClose={() => setEditingPagesPdfId(null)}
          onUpdate={(id, newFile) => {
            setPdfFiles(prev => prev.map(f => f.id === id ? { ...f, file: newFile, size: newFile.size } : f));
          }}
          onExtract={(newFile) => {
            const newAppFile: AppFile = {
              id: Math.random().toString(36).substring(7),
              file: newFile,
              name: newFile.name,
              size: newFile.size,
              type: 'pdf'
            };
            setPdfFiles(prev => [...prev, newAppFile]);
            setSelectedPdfIds(prev => new Set([...prev, newAppFile.id]));
          }}
        />
      )}

      {/* AI Assistant Modal */}
      {aiAssistantFiles && (
        <AiAssistant
          files={aiAssistantFiles}
          onClose={() => setAiAssistantFiles(null)}
        />
      )}

      {/* Image Enhance Modal */}
      {enhanceFile && (
        <ImageEnhanceModal
          file={enhanceFile}
          onClose={() => setEnhanceFile(null)}
          onSave={(newFile) => {
            setImageFiles(prev => [...prev, newFile]);
          }}
        />
      )}

      {/* File Preview Modal */}
      <FilePreview
        file={previewFile}
        onClose={() => setPreviewFile(null)}
      />
    </div>
  );
}

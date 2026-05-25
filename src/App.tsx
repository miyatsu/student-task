import React, { useState, useRef, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Upload, FileText, GripVertical, Trash2, Download, FileUp, Loader2, Image as ImageIcon, Edit2, Check, X, FileArchive, LayoutGrid, Sparkles, ScanText, ImagePlus, FileImage, Eye, RotateCw, Copy, ArrowUp, ArrowDown, Wand2 } from 'lucide-react';
import { PDFDocument, PDFRawStream, PDFName } from 'pdf-lib';
import JSZip from 'jszip';
import PdfEditor from './components/PdfEditor';
import AiAssistant from './components/AiAssistant';
import ImageEnhanceModal from './components/ImageEnhanceModal';
import FilePreview from './components/FilePreview';
import imageCompression from 'browser-image-compression';
import {
  AppFile,
  SortConfig,
  SortKey,
  duplicateAppFile,
  formatBytes,
  getNextSortConfig,
  isSupportedFile,
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
import { createGeminiClient, geminiSetupGuideText } from './lib/gemini';

import * as mammoth from 'mammoth';
// @ts-ignore
import html2pdf from 'html2pdf.js';

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
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const getSortIcon = (config: SortConfig | null, key: SortKey) => {
    if (!config || config.key !== key) return null;
    return config.order === 'asc' ? <ArrowUp className="inline w-3 h-3 ml-1 text-indigo-600" /> : <ArrowDown className="inline w-3 h-3 ml-1 text-indigo-600" />;
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

  const convertSelectedWords = async () => {
    const selected = selectFilesByIds(wordFiles, selectedWordIds);
    if (selected.length === 0) return;

    setIsConverting(true);
    try {
      const newPdfs: AppFile[] = [];
      for (const word of selected) {
        const arrayBuffer = await word.file.arrayBuffer();
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer });
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        tempDiv.style.width = '210mm';
        tempDiv.style.padding = '20mm';
        tempDiv.style.backgroundColor = 'white';
        tempDiv.style.color = 'black';
        tempDiv.style.fontFamily = 'Arial, sans-serif';
        tempDiv.style.lineHeight = '1.5';
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);
        
        try {
          const opt: any = {
            margin: 10,
            filename: 'temp.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
          };
          const pdfBlob = await html2pdf().set(opt).from(tempDiv).output('blob');
          
          const baseName = word.name.replace(/\.[^/.]+$/, "");
          const newName = `${baseName}.pdf`;
          const newFile = new File([pdfBlob], newName, { type: 'application/pdf' });
          
          newPdfs.push({
            id: Math.random().toString(36).substring(7),
            file: newFile,
            name: newName,
            size: newFile.size,
            type: 'pdf'
          });
        } finally {
          document.body.removeChild(tempDiv);
        }
      }
      
      setPdfFiles(prev => [...prev, ...newPdfs]);
      setSelectedPdfIds(prev => new Set([...prev, ...newPdfs.map(f => f.id)]));
      alert(`Successfully converted ${newPdfs.length} Word document(s) to PDF!`);
    } catch (error) {
      console.error(error);
      alert('Error during conversion. Ensure the Word file is a valid DOCX.');
    } finally {
      setIsConverting(false);
    }
  };

  const convertSelectedImages = async () => {
    const selectedImgs = selectFilesByIds(imageFiles, selectedImageIds);
    if (selectedImgs.length === 0) return;

    setIsConverting(true);
    try {
      const newPdfs: AppFile[] = [];
      
      for (const img of selectedImgs) {
        const pdfDoc = await PDFDocument.create();
        const arrayBuffer = await img.file.arrayBuffer();
        let image;
        if (img.file.type === 'image/png') {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else {
          image = await pdfDoc.embedJpg(arrayBuffer);
        }
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
      }
      
      setPdfFiles(prev => [...prev, ...newPdfs]);
      setSelectedPdfIds(prev => new Set([...prev, ...newPdfs.map(p => p.id)]));
      
      // Clear selection of images after conversion, but keep the images in the list
      setSelectedImageIds(new Set());
    } catch (error) {
      console.error("Error converting images:", error);
      alert("An error occurred while converting images.");
    } finally {
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

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 pb-32">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 mb-3">PDF & Image Tools</h1>
          <p className="text-zinc-500 text-lg">Convert images to PDFs, compress, and merge multiple PDFs into one document.</p>
        </header>

        <main className="space-y-8">
          {conversionError && (
            <div className="p-4 bg-red-50 border-l-4 border-red-500 text-red-700 rounded-md">
              <p className="font-medium">Error</p>
              <p className="text-sm">{conversionError}</p>
            </div>
          )}

          {/* Upload Zone */}
          <div
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-200 ease-in-out cursor-pointer
              ${isDragging 
                ? 'border-indigo-500 bg-indigo-50 scale-[1.02]' 
                : 'border-zinc-300 bg-white hover:border-indigo-400 hover:bg-zinc-50'
              }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              multiple
              accept="application/pdf,image/png,image/jpeg,image/jpg"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileInput}
            />
            <div className="mx-auto w-16 h-16 mb-4 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Upload className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Click to upload or drag and drop</h3>
            <p className="text-zinc-500">Supports PDF, PNG, and JPG files</p>
          </div>

          <DragDropContext onDragEnd={onDragEnd}>
            
            {/* Image List Section */}
            {imageFiles.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={selectedImageIds.size === imageFiles.length && imageFiles.length > 0}
                      onChange={toggleAllImages}
                      className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <h3 className="font-semibold text-zinc-700">Images ({imageFiles.length})</h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
                    <button onClick={() => handleSort('image', 'name')} className="hover:text-zinc-900 transition-colors flex items-center">NAME {getSortIcon(imageSort, 'name')}</button>
                    <button onClick={() => handleSort('image', 'date')} className="hover:text-zinc-900 transition-colors flex items-center">DATE {getSortIcon(imageSort, 'date')}</button>
                    <button onClick={() => handleSort('image', 'size')} className="hover:text-zinc-900 transition-colors flex items-center">SIZE {getSortIcon(imageSort, 'size')}</button>
                  </div>
                </div>
                
                <Droppable droppableId="image-list" type="image">
                  {(provided) => (
                    <ul
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="divide-y divide-zinc-100"
                    >
                      {imageFiles.map((file, index) => (
                        <Draggable key={file.id} draggableId={file.id} index={index}>
                          {(provided, snapshot) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center p-4 gap-4 bg-white transition-colors
                                ${snapshot.isDragging ? 'shadow-md ring-1 ring-indigo-500/20 z-10' : 'hover:bg-zinc-50'}
                              `}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing p-1"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>

                              <input 
                                type="checkbox" 
                                checked={selectedImageIds.has(file.id)}
                                onChange={() => toggleImageSelection(file.id)}
                                className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                              />
                              
                              <div 
                                className="w-10 h-10 rounded-lg bg-zinc-100 flex items-center justify-center overflow-hidden shrink-0 border border-zinc-200 cursor-pointer"
                                onClick={() => setPreviewFile(file)}
                              >
                                {file.previewUrl ? (
                                  <img src={file.previewUrl} alt={file.name} className="w-full h-full object-cover" />
                                ) : (
                                  <ImageIcon className="w-5 h-5 text-zinc-400" />
                                )}
                              </div>
                              
                              {editingFileId === file.id ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <input 
                                    type="text" 
                                    value={editingName} 
                                    onChange={e => setEditingName(e.target.value)}
                                    className="flex-1 border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveRename(file.id, 'image');
                                      if (e.key === 'Escape') setEditingFileId(null);
                                    }}
                                  />
                                  <button onClick={() => saveRename(file.id, 'image')} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4"/></button>
                                  <button onClick={() => setEditingFileId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4"/></button>
                                </div>
                              ) : (
                                <div 
                                  className="flex-1 min-w-0 flex items-center gap-2 group cursor-pointer"
                                  onClick={() => setPreviewFile(file)}
                                >
                                  <p className="text-sm font-medium text-zinc-900 truncate hover:text-indigo-600 transition-colors">
                                    {file.name}
                                  </p>
                                  <button onClick={(e) => { e.stopPropagation(); startRename(file); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); duplicateFile(file, 'image'); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Duplicate">
                                    <Copy className="w-4 h-4" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); rotateImage(file); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Rotate 90°">
                                    <RotateCw className="w-4 h-4" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); setEnhanceFile(file); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Enhance Image">
                                    <Wand2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              <div className="text-xs text-zinc-500 w-20 text-right">
                                {formatBytes(file.size)}
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFile(file);
                                }}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Preview File"
                              >
                                <Eye className="w-5 h-5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAiAssistantFiles([file]);
                                }}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="AI Assistant"
                              >
                                <Sparkles className="w-5 h-5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExtractText(file);
                                }}
                                disabled={extractingTextId === file.id}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Extract Text (OCR)"
                              >
                                {extractingTextId === file.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanText className="w-5 h-5" />}
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(file.id, 'image');
                                }}
                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove file"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>

                <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 flex justify-between items-center overflow-x-auto">
                  <span className="text-sm text-zinc-500 whitespace-nowrap min-w-max mr-4">
                    {selectedImageIds.size} image(s) selected
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={deleteSelectedImages}
                      disabled={selectedImageIds.size === 0}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm shrink-0 whitespace-nowrap
                        ${selectedImageIds.size === 0
                          ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 shadow-sm hover:shadow active:scale-[0.98]'
                        }
                      `}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected
                    </button>
                    <button
                      onClick={() => {
                        const selectedFiles = imageFiles.filter(f => selectedImageIds.has(f.id));
                        setAiAssistantFiles(selectedFiles);
                      }}
                      disabled={selectedImageIds.size === 0}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm shrink-0 whitespace-nowrap
                        ${selectedImageIds.size === 0
                          ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shadow-sm hover:shadow active:scale-[0.98]'
                        }
                      `}
                    >
                      <Sparkles className="w-4 h-4" />
                      Ask AI
                    </button>
                    {/* Compress Group */}
                    <div className="flex items-center">
                      <div className={`relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap border
                        ${selectedImageIds.size === 0 || isCompressing
                          ? 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed'
                          : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 active:bg-indigo-100 shadow-sm cursor-pointer'
                        }`}
                      >
                        {isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                        {isCompressing ? "Compressing..." : "Compress As..."}
                        <select
                          value=""
                          onChange={(e) => compressSelectedImages(e.target.value as any)}
                          disabled={selectedImageIds.size === 0 || isCompressing}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value="" disabled>Select Ratio...</option>
                          <option value="low">Low Quality (Smallest)</option>
                          <option value="medium">Medium Quality (Recommended)</option>
                          <option value="high">High Quality (Largest)</option>
                        </select>
                      </div>
                    </div>
                    <button
                      onClick={convertSelectedImages}
                      disabled={selectedImageIds.size === 0 || isConverting}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm
                        ${selectedImageIds.size === 0 || isConverting
                          ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow active:scale-[0.98]'
                        }
                      `}
                    >
                      {isConverting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          Convert to PDF
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PDF List Section */}
            {pdfFiles.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={selectedPdfIds.size === pdfFiles.length && pdfFiles.length > 0}
                      onChange={toggleAllPdfs}
                      className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <h3 className="font-semibold text-zinc-700">PDF Documents ({pdfFiles.length})</h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
                    <button onClick={() => handleSort('pdf', 'name')} className="hover:text-zinc-900 transition-colors flex items-center">NAME {getSortIcon(pdfSort, 'name')}</button>
                    <button onClick={() => handleSort('pdf', 'date')} className="hover:text-zinc-900 transition-colors flex items-center">DATE {getSortIcon(pdfSort, 'date')}</button>
                    <button onClick={() => handleSort('pdf', 'size')} className="hover:text-zinc-900 transition-colors flex items-center">SIZE {getSortIcon(pdfSort, 'size')}</button>
                  </div>
                </div>
                
                <Droppable droppableId="pdf-list" type="pdf">
                  {(provided) => (
                    <ul
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="divide-y divide-zinc-100"
                    >
                      {pdfFiles.map((file, index) => (
                        <Draggable key={file.id} draggableId={file.id} index={index}>
                          {(provided, snapshot) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center p-4 gap-4 bg-white transition-colors
                                ${snapshot.isDragging ? 'shadow-md ring-1 ring-indigo-500/20 z-10' : 'hover:bg-zinc-50'}
                              `}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing p-1"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>

                              <input 
                                type="checkbox" 
                                checked={selectedPdfIds.has(file.id)}
                                onChange={() => togglePdfSelection(file.id)}
                                className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                              />
                              
                              <div 
                                className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 shrink-0 cursor-pointer hover:bg-red-100 transition-colors"
                                onClick={() => setPreviewFile(file)}
                              >
                                <FileText className="w-5 h-5" />
                              </div>
                              
                              {editingFileId === file.id ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <input 
                                    type="text" 
                                    value={editingName} 
                                    onChange={e => setEditingName(e.target.value)}
                                    className="flex-1 border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveRename(file.id, 'pdf');
                                      if (e.key === 'Escape') setEditingFileId(null);
                                    }}
                                  />
                                  <button onClick={() => saveRename(file.id, 'pdf')} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4"/></button>
                                  <button onClick={() => setEditingFileId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4"/></button>
                                </div>
                              ) : (
                                <div 
                                  className="flex-1 min-w-0 flex items-center gap-2 group cursor-pointer"
                                  onClick={() => setPreviewFile(file)}
                                >
                                  <p className="text-sm font-medium text-zinc-900 truncate hover:text-indigo-600 transition-colors">
                                    {file.name}
                                  </p>
                                  <button onClick={(e) => { e.stopPropagation(); startRename(file); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); duplicateFile(file, 'pdf'); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Duplicate">
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              <div className="text-xs text-zinc-500 w-20 text-right">
                                {formatBytes(file.size)}
                              </div>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFile(file);
                                }}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Preview File"
                              >
                                <Eye className="w-5 h-5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAiAssistantFiles([file]);
                                }}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="AI Assistant"
                              >
                                <Sparkles className="w-5 h-5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleExtractImages(file);
                                }}
                                disabled={extractingImagesId === file.id}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Extract Images"
                              >
                                {extractingImagesId === file.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConvertToVector(file);
                                }}
                                disabled={convertingToImgId === file.id}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                                title="Convert Pages to Vector (SVG)"
                              >
                                {convertingToImgId === file.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileImage className="w-5 h-5" />}
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingPagesPdfId(file.id);
                                }}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Preview & Edit Pages"
                              >
                                <LayoutGrid className="w-5 h-5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(file.id, 'pdf');
                                }}
                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove file"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>

                <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 flex flex-col gap-4">
                  <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                    <span className="text-sm text-zinc-500 font-medium whitespace-nowrap">
                      {selectedPdfIds.size} PDF(s) selected
                    </span>
                    
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                      <button
                        onClick={deleteSelectedPdfs}
                        disabled={selectedPdfIds.size === 0}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap
                          ${selectedPdfIds.size === 0
                            ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 active:bg-red-200'
                          }
                        `}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Selected
                      </button>
                      <button
                        onClick={() => {
                          const selectedFiles = pdfFiles.filter(f => selectedPdfIds.has(f.id));
                          setAiAssistantFiles(selectedFiles);
                        }}
                        disabled={selectedPdfIds.size === 0}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap
                          ${selectedPdfIds.size === 0
                            ? 'bg-zinc-100 text-zinc-400 cursor-not-allowed'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:bg-indigo-200'
                          }
                        `}
                      >
                        <Sparkles className="w-4 h-4" />
                        Ask AI
                      </button>
                      {/* Compress Group */}
                      <div className="flex items-center">
                        <div className={`relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap border
                          ${selectedPdfIds.size === 0 || isCompressing
                            ? 'bg-zinc-50 text-zinc-400 border-zinc-200 cursor-not-allowed'
                            : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 active:bg-indigo-100 shadow-sm cursor-pointer'
                          }`}
                        >
                          {isCompressing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileArchive className="w-4 h-4" />}
                          {isCompressing ? "Compressing..." : "Compress As..."}
                          <select
                            value=""
                            onChange={(e) => compressSelectedPdfs(e.target.value as any)}
                            disabled={selectedPdfIds.size === 0 || isCompressing}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          >
                            <option value="" disabled>Select Ratio...</option>
                            <option value="low">Low Quality (Smallest)</option>
                            <option value="medium">Medium Quality (Recommended)</option>
                            <option value="high">High Quality (Largest)</option>
                          </select>
                        </div>
                      </div>

                      {/* Merge Group */}
                      <button
                        onClick={mergeSelectedPdfs}
                        disabled={selectedPdfIds.size < 2 || isMerging}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap
                          ${selectedPdfIds.size < 2 || isMerging
                            ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow active:scale-[0.98]'
                          }
                        `}
                      >
                        {isMerging ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />}
                        Merge Selected
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {wordFiles.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden mb-8">
                <div className="px-6 py-4 border-b border-zinc-200 bg-zinc-50/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={selectedWordIds.size === wordFiles.length && wordFiles.length > 0}
                      onChange={toggleAllWords}
                      className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <h3 className="font-semibold text-zinc-700">Word Documents ({wordFiles.length})</h3>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-zinc-500">
                    <button onClick={() => handleSort('word', 'name')} className="hover:text-zinc-900 transition-colors flex items-center">NAME {getSortIcon(wordSort, 'name')}</button>
                    <button onClick={() => handleSort('word', 'date')} className="hover:text-zinc-900 transition-colors flex items-center">DATE {getSortIcon(wordSort, 'date')}</button>
                    <button onClick={() => handleSort('word', 'size')} className="hover:text-zinc-900 transition-colors flex items-center">SIZE {getSortIcon(wordSort, 'size')}</button>
                  </div>
                </div>
                
                <Droppable droppableId="word-list" type="word">
                  {(provided) => (
                    <ul
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className="divide-y divide-zinc-100"
                    >
                      {wordFiles.map((file, index) => (
                        <Draggable key={file.id} draggableId={file.id} index={index}>
                          {(provided, snapshot) => (
                            <li
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center p-4 gap-4 bg-white transition-colors
                                ${snapshot.isDragging ? 'shadow-md ring-1 ring-indigo-500/20 z-10' : 'hover:bg-zinc-50'}
                              `}
                            >
                              <div
                                {...provided.dragHandleProps}
                                className="text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing p-1"
                              >
                                <GripVertical className="w-5 h-5" />
                              </div>

                              <input 
                                type="checkbox" 
                                checked={selectedWordIds.has(file.id)}
                                onChange={() => toggleWordSelection(file.id)}
                                className="w-4 h-4 text-indigo-600 rounded border-zinc-300 focus:ring-indigo-500 cursor-pointer"
                              />
                              
                              <div 
                                className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0 cursor-pointer hover:bg-blue-100 transition-colors"
                                onClick={() => setPreviewFile(file)}
                              >
                                <FileText className="w-5 h-5" />
                              </div>
                              
                              {editingFileId === file.id ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <input 
                                    type="text" 
                                    value={editingName} 
                                    onChange={e => setEditingName(e.target.value)}
                                    className="flex-1 border border-indigo-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    autoFocus
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveRename(file.id, 'word');
                                      if (e.key === 'Escape') setEditingFileId(null);
                                    }}
                                  />
                                  <button onClick={() => saveRename(file.id, 'word')} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check className="w-4 h-4"/></button>
                                  <button onClick={() => setEditingFileId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4"/></button>
                                </div>
                              ) : (
                                <div 
                                  className="flex-1 min-w-0 flex items-center gap-2 group cursor-pointer"
                                  onClick={() => setPreviewFile(file)}
                                >
                                  <p className="text-sm font-medium text-zinc-900 truncate hover:text-indigo-600 transition-colors">
                                    {file.name}
                                  </p>
                                  <button onClick={(e) => { e.stopPropagation(); startRename(file); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Rename">
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); duplicateFile(file, 'word'); }} className="text-zinc-300 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Duplicate">
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                              )}

                              <div className="text-xs text-zinc-500 w-20 text-right">
                                {formatBytes(file.size)}
                              </div>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewFile(file);
                                }}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Preview File"
                              >
                                <Eye className="w-5 h-5" />
                              </button>

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAiAssistantFiles([file]);
                                }}
                                className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="AI Assistant"
                              >
                                <Sparkles className="w-5 h-5" />
                              </button>
                              
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(file.id, 'word');
                                }}
                                className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove file"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </li>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </ul>
                  )}
                </Droppable>

                <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50/50 flex justify-between items-center overflow-x-auto">
                  <span className="text-sm text-zinc-500 whitespace-nowrap min-w-max mr-4">
                    {selectedWordIds.size} document(s) selected
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={deleteSelectedWords}
                      disabled={selectedWordIds.size === 0}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm shrink-0 whitespace-nowrap
                        ${selectedWordIds.size === 0
                          ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 shadow-sm hover:shadow active:scale-[0.98]'
                        }
                      `}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Selected
                    </button>
                    <button
                      onClick={() => {
                        const selectedFiles = wordFiles.filter(f => selectedWordIds.has(f.id));
                        setAiAssistantFiles(selectedFiles);
                      }}
                      disabled={selectedWordIds.size === 0}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm shrink-0 whitespace-nowrap
                        ${selectedWordIds.size === 0
                          ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                          : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shadow-sm hover:shadow active:scale-[0.98]'
                        }
                      `}
                    >
                      <Sparkles className="w-4 h-4" />
                      Ask AI
                    </button>
                    <button
                      onClick={convertSelectedWords}
                      disabled={selectedWordIds.size === 0 || isConverting}
                      className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all text-sm
                        ${selectedWordIds.size === 0 || isConverting
                          ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow active:scale-[0.98]'
                        }
                      `}
                    >
                      {isConverting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Converting...
                        </>
                      ) : (
                        <>
                          <FileImage className="w-4 h-4" />
                          To PDF
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

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

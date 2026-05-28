import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Loader2, Bot, User } from 'lucide-react';
import Markdown from 'react-markdown';
import * as mammoth from 'mammoth';
import type { AppFile } from '../features/files';
import {
  buildGeminiErrorMessage,
  createGeminiClient,
  geminiSetupGuideMarkdown,
  getGeminiApiKey,
  loadGeminiApiKey,
} from '../lib/gemini';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface AiAssistantProps {
  files: AppFile[];
  onClose: () => void;
}

export default function AiAssistant({ files, onClose }: AiAssistantProps) {
  const [geminiConfigured, setGeminiConfigured] = useState<boolean | null>(() => getGeminiApiKey() ? true : null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const filesBase64Ref = useRef<{ data: string; mimeType: string; name: string }[] | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const getFilesBase64 = async () => {
    if (filesBase64Ref.current) return filesBase64Ref.current;
    
    const promises = files.map(file => new Promise<{ data: string; mimeType: string; name: string }>((resolve, reject) => {
      if (file.type === 'word') {
        file.file.arrayBuffer().then(buffer => {
          mammoth.extractRawText({ arrayBuffer: buffer })
            .then(result => {
              const textContent = result.value || "Empty Document";
              const encoder = new TextEncoder();
              const bytes = encoder.encode(textContent);
              const binString = Array.from(bytes).map(byte => String.fromCodePoint(byte)).join('');
              const base64 = btoa(binString);
              
              resolve({
                data: base64,
                mimeType: 'text/plain',
                name: file.name
              });
            }).catch(reject);
        }).catch(reject);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(file.file);
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({
          data: base64,
          mimeType: file.type === 'pdf' ? 'application/pdf' : file.file.type,
          name: file.name
        });
      };
      reader.onerror = reject;
    }));
    
    const results = await Promise.all(promises);
    filesBase64Ref.current = results;
    return results;
  };

  const handleSend = async (text: string, isInitial = false) => {
    if (!text.trim()) return;

    if (!isInitial) {
      setMessages(prev => [...prev, { role: 'user', text }]);
      setInput('');
    }
    
    setIsStreaming(true);

    try {
      const ai = await createGeminiClient();
      if (!ai) {
        setGeminiConfigured(false);
        setMessages(prev => prev.length > 0 ? prev : [{ role: 'model', text: geminiSetupGuideMarkdown }]);
        return;
      }

      setGeminiConfigured(true);

      const fileData = await getFilesBase64();

      let contents: any[] = [];
      const fileParts = fileData.map(f => ({ inlineData: { data: f.data, mimeType: f.mimeType } }));
      
      if (isInitial) {
        contents = [
          {
            role: 'user',
            parts: [
              ...fileParts,
              { text }
            ]
          }
        ];
      } else {
        contents = [
          {
            role: 'user',
            parts: [
              ...fileParts,
              { text: "Here are the reference documents/images." }
            ]
          }
        ];
        
        contents.push(...messages.map(m => ({
          role: m.role,
          parts: [{ text: m.text }]
        })));
        
        contents.push({
          role: 'user',
          parts: [{ text }]
        });
      }

      const responseStream = await ai.models.generateContentStream({
        model: 'gemini-3.1-pro-preview',
        contents,
      });

      setMessages((prev) => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of responseStream) {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          return [
            ...prev.slice(0, -1),
            { ...last, text: last.text + (chunk.text || '') }
          ];
        });
      }
    } catch (error) {
      console.error('AI Error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'model', text: buildGeminiErrorMessage(error, 'Gemini chat') }
      ]);
    } finally {
      setIsStreaming(false);
      if (isInitial) setIsInitializing(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const initializeAssistant = async () => {
      setIsInitializing(true);

      const apiKey = await loadGeminiApiKey();
      if (cancelled) {
        return;
      }

      const configured = Boolean(apiKey);
      setGeminiConfigured(configured);

      if (!configured) {
        setMessages([{ role: 'model', text: geminiSetupGuideMarkdown }]);
        setIsInitializing(false);
        return;
      }

      const initialPrompt = files.length > 1 
        ? `Please provide a brief summary of these ${files.length} documents/images.`
        : files[0].type === 'pdf' 
          ? "Please provide a brief summary of this PDF document." 
          : "Please describe this image in detail.";

      await handleSend(initialPrompt, true);
    };

    initializeAssistant();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm p-4 sm:p-6">
      <div className="bg-white w-full max-w-3xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-white/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-800">AI Assistant</h2>
              <p className="text-xs text-zinc-500 truncate max-w-[200px] sm:max-w-sm" title={files.map(f => f.name).join(', ')}>
                Chatting about: {files.length === 1 ? files[0].name : `${files.length} files`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-zinc-50/50">
          {isInitializing ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium animate-pulse">
                {geminiConfigured === null ? 'Checking Gemini configuration...' : `Analyzing document${files.length > 1 ? 's' : ''}...`}
              </p>
            </div>
          ) : (
            <div className="space-y-6 max-w-2xl mx-auto">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center shadow-sm
                    ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-zinc-200 text-indigo-600'}
                  `}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
                    <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed
                      ${msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-tr-sm' 
                        : 'bg-white border border-zinc-100 text-zinc-700 rounded-tl-sm'
                      }
                    `}>
                      {msg.role === 'user' ? (
                        msg.text
                      ) : (
                        <div className="markdown-body prose prose-sm prose-zinc max-w-none">
                          <Markdown>{msg.text}</Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isStreaming && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-white border border-zinc-200 text-indigo-600 flex items-center justify-center shadow-sm">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="px-5 py-3.5 bg-white border border-zinc-100 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-zinc-100">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
            className="max-w-2xl mx-auto relative flex items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={geminiConfigured === null
                ? 'Checking Gemini configuration...'
                : geminiConfigured
                  ? `Ask a question about ${files.length > 1 ? 'these documents' : 'this document'}...`
                  : 'Configure GEMINI_API_KEY to enable Gemini chat.'}
              disabled={geminiConfigured !== true || isStreaming || isInitializing}
              className="w-full pl-5 pr-14 py-3.5 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50 text-sm"
            />
            <button
              type="submit"
              disabled={geminiConfigured !== true || !input.trim() || isStreaming || isInitializing}
              className="absolute right-2 p-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
          <div className="text-center mt-3">
            <p className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase">
              {geminiConfigured === null
                ? 'Checking Gemini setup'
                : geminiConfigured
                  ? 'Powered by Gemini 3.1 Pro'
                  : 'Gemini disabled until GEMINI_API_KEY is configured'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

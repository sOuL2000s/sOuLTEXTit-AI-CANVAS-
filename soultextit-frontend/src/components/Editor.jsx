import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import { Markdown } from 'tiptap-markdown';
import { Node, mergeAttributes, nodeInputRule, nodePasteRule } from '@tiptap/core';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import axios from 'axios';
import katex from 'katex';
import 'katex/dist/katex.min.css';

// Neural Math Extension for Tiptap
const MathExtension = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  addAttributes() {
    return {
      latex: { default: '' },
      displayMode: { default: false },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'span[data-latex]',
        getAttrs: (dom) => ({
          latex: dom.getAttribute('data-latex'),
          displayMode: dom.getAttribute('data-display') === 'true',
        }),
      },
      {
        tag: 'div.math-block',
        getAttrs: (dom) => ({
          latex: dom.getAttribute('data-latex') || dom.textContent,
          displayMode: true,
        }),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    const { latex, displayMode } = HTMLAttributes;
    return [
      displayMode ? 'div' : 'span',
      { 
        'data-latex': latex, 
        'data-display': displayMode,
        class: displayMode ? 'math-block' : 'math-inline'
      },
      displayMode ? `$$${latex}$$` : `$${latex}$`
    ];
  },
  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement(node.attrs.displayMode ? 'div' : 'span');
      dom.classList.add(node.attrs.displayMode ? 'math-block' : 'math-inline');
      dom.style.cursor = 'pointer';
      
      const render = () => {
        try {
          katex.render(node.attrs.latex || 'math', dom, {
            throwOnError: false,
            displayMode: node.attrs.displayMode,
          });
        } catch (e) {
          dom.textContent = node.attrs.latex;
        }
      };
      render();

      dom.addEventListener('click', () => {
        const newLatex = prompt('Edit LaTeX:', node.attrs.latex);
        if (newLatex !== null && editor.isEditable) {
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(getPos(), undefined, { ...node.attrs, latex: newLatex });
            return true;
          });
        }
      });

      return { 
        dom,
        update: (updatedNode) => {
          if (updatedNode.type !== node.type) return false;
          // Reactively update the KaTeX render if attributes change
          render(); 
          return true;
        }
      };
    };
  },
  addInputRules() {
    return [
      nodeInputRule({
        find: /\$\$([^$]+)\$\$\s$/,
        type: this.type,
        getAttributes: match => ({ latex: match[1], displayMode: true }),
      }),
      nodeInputRule({
        find: /\$([^$]+)\$\s$/,
        type: this.type,
        getAttributes: match => ({ latex: match[1], displayMode: false }),
      }),
    ];
  },
  addPasteRules() {
    return [
      nodePasteRule({
        find: /\$\$([^$]+)\$\$/g,
        type: this.type,
        getAttributes: match => ({ latex: match[1], displayMode: true }),
      }),
      nodePasteRule({
        find: /\$([^$]+)\$/g,
        type: this.type,
        getAttributes: match => ({ latex: match[1], displayMode: false }),
      }),
    ];
  },
  // Seamless integration for tiptap-markdown 
  addStorage() {
    return {
      markdown: {
        serialize: (state, node) => {
          const { latex, displayMode } = node.attrs;
          if (displayMode) {
            state.write(`\n$$\n${latex}\n$$\n`);
          } else {
            state.write(`$${latex}$`);
          }
        },
        parse: {
          // Parsing is handled by inputRules and pasteRules to avoid conflict with markdown-it logic
        }
      }
    };
  }
});
import { io } from 'socket.io-client';
import { Download, Mic, MicOff, Wand2, Check, X, Save, History, FileUp, Plus, Trash2, Loader2, Eye, Code, HelpCircle, Layers, Sparkles } from 'lucide-react';
import { jsPDF } from "jspdf";

import { motion, AnimatePresence } from 'framer-motion';

const Editor = () => {
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [showMdGuide, setShowMdGuide] = useState(false);
  const [selectionRange, setSelectionRange] = useState(null);
  const [loading, setLoading] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [sttModels, setSttModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedSttModel, setSelectedSttModel] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingStt, setIsProcessingStt] = useState(false);
  const [socket, setSocket] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [title, setTitle] = useState('A New Narrative');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [canvases, setCanvases] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved
  const lastSavedRef = useRef('NEW_MANUSCRIPT_INITIAL_STATE');

  // Dynamic axios instance with interceptor for fresh token
  const axiosAuth = useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_API_URL,
    });
    
    instance.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
    
    return instance;
  }, []);

  const fetchCanvases = async () => {
    try {
      const res = await axiosAuth.get('/api/canvases');
      setCanvases(res.data);
    } catch (e) { console.error("Archive inaccessible"); }
  };

  const editor = useEditor({
    extensions: [
      StarterKit,
      Typography,
      MathExtension,
      Markdown.configure({
        html: false,
        tightLists: true,
        tightListClass: 'tight',
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[60vh]',
      },
    },
    onUpdate: ({ editor }) => {
      if (saveStatus !== 'dirty') {
        setSaveStatus('dirty');
      }
    }
  });

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await axiosAuth.get('/api/admin/models');
        const textModels = res.data.filter(m => m.category === 'text' && m.isActive);
        const speechModels = res.data.filter(m => m.category === 'stt' && m.isActive);
        setAvailableModels(textModels);
        setSttModels(speechModels);
        
        const initialModel = textModels.find(m => m.isDefault)?.modelId || textModels[0]?.modelId || '';
        const initialSttModel = speechModels.find(m => m.isDefault)?.modelId || speechModels[0]?.modelId || '';
        setSelectedModel(initialModel);
        setSelectedSttModel(initialSttModel);
      } catch (e) { console.error("Neural metadata unavailable"); }
    };

    fetchModels();
    fetchCanvases();

    // Initialize Neural Socket
    const newSocket = io(import.meta.env.VITE_API_URL);
    setSocket(newSocket);

    newSocket.on('transcription-result', (data) => {
      if (editor && data.text) {
        editor.chain().focus().insertContent(data.text + ' ').run();
      }
      setIsProcessingStt(false);
      setIsRecording(false);
    });

    newSocket.on('stt-error', (err) => {
      console.error("STT Pipeline Error:", err);
      setIsProcessingStt(false);
      setIsRecording(false);
    });

    return () => newSocket.close();
  }, [editor]);

  const toggleSpeech = async () => {
    if (isRecording) {
      stopSpeech();
    } else {
      startSpeech();
    }
  };

  const startSpeech = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && socket) {
          socket.emit('audio-chunk', e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (socket) {
          socket.emit('stop-recording', { modelId: selectedSttModel });
          setIsProcessingStt(true);
        }
      };

      recorder.start(1000); // Send chunks every 1s
      setIsRecording(true);
    } catch (err) {
      alert("Microphone Access Denied: Neural link failed.");
    }
  };

  const stopSpeech = () => {
    if (mediaRecorder) {
      if (!selectedSttModel) {
        alert("Select a Speech-to-Text model in the configuration dock first.");
        mediaRecorder.stream.getTracks().forEach(t => t.stop());
        setIsRecording(false);
        return;
      }
      mediaRecorder.stop();
    }
  };

  // Trigger dirty state on title change only if we have an active session
  useEffect(() => {
    if (lastSavedRef.current !== null) {
      setSaveStatus('dirty');
    }
  }, [title]);

  // Enhanced Auto-save orchestration
  useEffect(() => {
    if (!editor || saveStatus !== 'dirty') return;

    const timer = setTimeout(() => {
      const currentMarkdown = editor.storage.markdown?.getMarkdown?.();
      if (!currentMarkdown) return;

      // Verify if there's an actual delta to save
      if (currentMarkdown === lastSavedRef.current) {
        setSaveStatus('saved');
        return;
      }

      saveCanvas();
    }, 2500); // Intelligent delay for network efficiency

    return () => clearTimeout(timer);
  }, [saveStatus, editor, title]);

  const handleAiAction = async () => {
    if (!prompt || !selectedModel) {
      if (!selectedModel) alert("Please select an AI model from the dropdown first.");
      return;
    }
    setLoading(true);
    
    let context = '';
    let isSelection = false;

    const { from, to } = editor.state.selection;
    isSelection = from !== to;
    context = isSelection 
      ? editor.state.doc.textBetween(from, to, ' ') 
      : (editor.storage.markdown?.getMarkdown?.() || editor.getText());
    setSelectionRange(isSelection ? { from, to } : null);

    try {
      const res = await axiosAuth.post('/api/ai/edit', { 
        prompt, 
        context: context, 
        modelId: selectedModel 
      });
      
      setSuggestion(res.data.suggestion);
    } catch (err) { 
      console.error("AI Protocol Error:", err);
      alert(err.response?.data?.error || "Neural link unstable."); 
    }
    setLoading(false);
  };

  const saveCanvas = async () => {
    if (!editor) return;
    const contentToSave = editor.storage.markdown.getMarkdown();
    
    // Prevent redundant network calls if content matches last successful sync
    if (contentToSave === lastSavedRef.current && saveStatus === 'saved') return;
    if (contentToSave === '' && lastSavedRef.current === 'NEW_MANUSCRIPT_INITIAL_STATE') return;

    setSaveStatus('saving');
    try {
      await axiosAuth.post('/api/canvases', { title, content: contentToSave });
      lastSavedRef.current = contentToSave;
      setSaveStatus('saved');
      // Quietly refresh canvases list to reflect updated modified timestamps
      const res = await axiosAuth.get('/api/canvases');
      setCanvases(res.data);
    } catch (err) { 
      console.error("Neural synchronization failed");
      setSaveStatus('dirty'); // Revert to dirty to retry later
    }
  };

  const createNewCanvas = () => {
    setTitle('A New Narrative');
    editor.commands.setContent('');
    lastSavedRef.current = 'NEW_MANUSCRIPT_INITIAL_STATE';
    setSaveStatus('saved');
    setIsSidebarOpen(false);
  };

  const loadCanvas = (canvas) => {
    setTitle(canvas.title);
    editor.commands.setContent(canvas.content);
    lastSavedRef.current = canvas.content;
    setSaveStatus('saved');
    setIsSidebarOpen(false);
  };

  const deleteCanvas = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Discard this manuscript forever?')) return;
    try {
      await axiosAuth.delete(`/api/canvases/${id}`);
      fetchCanvases();
    } catch (e) { console.error("Deletion failed"); }
  };

  const importFile = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (ev) => editor.commands.setContent(ev.target.result);
    reader.readAsText(file);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text(title, 20, 20);
    doc.setFontSize(12);
    const splitText = doc.splitTextToSize(editor.getText(), 170);
    doc.text(splitText, 20, 40);
    doc.save(`${title}.pdf`);
  };

  const showHistory = () => {
    setIsSidebarOpen(true);
  };

  const MarkdownGuide = () => (
    <div className="space-y-6 text-sm">
      <div className="p-4 rounded-xl bg-violet-500/5 border border-violet-500/10">
        <h4 className="text-violet-400 font-black uppercase text-[10px] mb-3 tracking-widest flex items-center gap-2">
          <Layers size={12}/> Structure
        </h4>
        <ul className="space-y-2 text-gray-300 font-mono text-[11px]">
          <li className="flex justify-between"><span># H1 Header</span><span className="text-gray-600">Main Title</span></li>
          <li className="flex justify-between"><span>## H2 Header</span><span className="text-gray-600">Section</span></li>
          <li className="flex justify-between"><span>**Bold**</span><span className="text-gray-600">Strong</span></li>
          <li className="flex justify-between"><span>*Italic*</span><span className="text-gray-600">Emphasis</span></li>
          <li className="flex justify-between"><span>- List</span><span className="text-gray-600">Bullet</span></li>
        </ul>
      </div>
      <div className="p-4 rounded-xl bg-pink-500/5 border border-pink-500/10">
        <h4 className="text-pink-400 font-black uppercase text-[10px] mb-3 tracking-widest flex items-center gap-2">
          <Code size={12}/> Programming
        </h4>
        <ul className="space-y-2 text-gray-300 font-mono text-[11px]">
          <li className="flex justify-between"><span>`code`</span><span className="text-gray-600">Inline</span></li>
          <li><span className="block mb-1">```lang</span><span className="text-gray-600">Code Block</span><span className="block mt-1">```</span></li>
          <li className="flex justify-between"><span>&gt; Quote</span><span className="text-gray-600">Blockquote</span></li>
        </ul>
      </div>
      <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
        <h4 className="text-cyan-400 font-black uppercase text-[10px] mb-3 tracking-widest flex items-center gap-2">
          <Sparkles size={12}/> Mathematics
        </h4>
        <p className="text-[9px] text-gray-500 mb-2 leading-relaxed italic">Neural Core renders LaTeX math syntax automatically.</p>
        <ul className="space-y-3 text-gray-300 font-mono text-[11px]">
          <li>
            <span className="text-cyan-500/80">$ E=mc^2 $</span>
            <span className="block text-[9px] text-gray-600 mt-1">Inline Equation</span>
          </li>
          <li>
            <span className="text-cyan-500/80">$$ \int_a^b f(x)dx $$</span>
            <span className="block text-[9px] text-gray-600 mt-1">Display Block</span>
          </li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
      {/* Floating Sidebar Toggle (Contextual Navigation) */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed left-4 bottom-20 md:left-6 md:top-32 md:bottom-auto z-50 p-3 md:p-4 glass-panel rounded-full md:rounded-xl text-violet-400 hover:text-white transition-all shadow-2xl active:scale-90"
        title="Archive Explorer"
      >
        <History size={20} className="md:w-6 md:h-6" />
      </button>

      {/* Markdown Guide Sidebar */}
      <AnimatePresence>
        {showMdGuide && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMdGuide(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full sm:w-80 glass-panel border-l border-white/10 z-[120] p-8 shadow-2xl flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-xl font-display font-black text-white uppercase tracking-tighter">Syntax Dock</h3>
                  <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mt-1">Markdown Reference</p>
                </div>
                <button onClick={() => setShowMdGuide(false)} className="p-2 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"><X size={20}/></button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <MarkdownGuide />
              </div>

              <div className="mt-8 pt-6 border-t border-white/5">
                <button 
                  onClick={() => setShowMdGuide(false)}
                  className="w-full py-4 bg-white/5 hover:bg-white/10 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                >
                  Dismiss Guide
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Contextual Navigation Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-full sm:w-80 glass-panel border-r border-white/10 z-[70] p-6 sm:p-8 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-10">
                <h3 className="text-xl font-display font-black text-white uppercase tracking-tighter">Archive</h3>
                <button onClick={() => setIsSidebarOpen(false)} className="text-gray-500 hover:text-white"><X size={20}/></button>
              </div>
              
              <div className="space-y-4">
                <button 
                  onClick={createNewCanvas}
                  className="w-full p-4 rounded-2xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-violet-600/20 active:scale-95 transition-transform"
                >
                  <Plus size={14} /> New Manuscript
                </button>
                
                <div className="mt-8">
                   <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 px-2">Recent Synchronizations</p>
                   <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-2">
                     {canvases.length > 0 ? canvases.map(c => (
                       <div 
                        key={c._id} 
                        className="w-full flex items-center gap-2 group"
                       >
                         <button 
                          onClick={() => loadCanvas(c)}
                          className="flex-1 text-left p-4 rounded-xl hover:bg-white/5 transition-all border border-transparent hover:border-white/5 overflow-hidden"
                         >
                           <p className="text-sm font-bold text-gray-300 group-hover:text-white transition-colors truncate">{c.title}</p>
                           <p className="text-[9px] font-medium text-gray-600 mt-1 uppercase tracking-widest">{new Date(c.lastModified).toLocaleDateString()}</p>
                         </button>
                         <button 
                          onClick={(e) => deleteCanvas(c._id, e)}
                          className="p-3 text-gray-700 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                         >
                           <Trash2 size={16} />
                         </button>
                       </div>
                     )) : (
                       <div className="text-center py-10 opacity-30">
                         <History size={32} className="mx-auto mb-2" />
                         <p className="text-[10px] font-black uppercase">No records</p>
                       </div>
                     )}
                   </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Workspace Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 md:gap-6 mb-8"
      >
        <div className="w-full lg:w-auto">
          <input 
            className="text-3xl sm:text-4xl lg:text-5xl font-display font-black outline-none bg-transparent text-white placeholder-white/10 w-full tracking-tighter hover:bg-white/5 px-2 rounded-lg transition-colors" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
          <div className="flex flex-wrap items-center gap-2 md:gap-4 mt-2 px-2">
            <span className={`text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded ${saveStatus === 'saved' ? 'bg-emerald-500/20 text-emerald-400' : (saveStatus === 'saving' ? 'bg-violet-500/20 text-violet-400' : 'bg-amber-500/20 text-amber-400')}`}>
              {saveStatus === 'saved' ? 'Synchronized' : (saveStatus === 'saving' ? 'Syncing...' : 'Modified')}
            </span>
            <span className="text-[8px] md:text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Autosave Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 bg-white/5 p-1 md:p-1.5 rounded-2xl border border-white/5 w-full sm:w-auto justify-end">
          <label className="p-3 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer">
            <FileUp size={18}/>
            <input type="file" className="hidden" onChange={importFile} accept=".txt,.md"/>
          </label>
          <button onClick={exportPDF} className="p-3 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all" title="Export PDF"><Download size={18}/></button>
          <button onClick={() => setShowMdGuide(true)} className="p-3 text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all" title="Markdown Guide"><HelpCircle size={18}/></button>
          <button onClick={showHistory} className="p-3 text-violet-400 hover:bg-white/10 rounded-xl transition-all" title="Manuscript History"><History size={18}/></button>
        </div>
      </motion.div>

      {/* AI command dock */}
      <div className="sticky top-20 md:top-24 z-40 mb-8 md:mb-12 px-1">
        <div className="glass-panel p-1.5 md:p-2 rounded-2xl flex flex-col lg:flex-row gap-2 shadow-2xl shadow-purple-900/20 border-white/10">
          <div className="flex flex-col sm:flex-row gap-2">
            <select 
              className="bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-300 outline-none px-3 md:px-4 py-2.5 md:py-3 rounded-xl border border-white/5 appearance-none cursor-pointer hover:bg-white/10 flex-1 lg:min-w-[140px]"
              title="Text Generation Model"
              value={selectedModel || ""}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {availableModels.length === 0 && <option value="">No Text Models</option>}
              {availableModels.map(m => (
                <option key={m.modelId} value={m.modelId} className="bg-slate-900">
                  AI: {m.displayName || m.modelId}
                </option>
              ))}
            </select>
            <select 
              className="bg-white/5 text-[9px] md:text-[10px] font-black uppercase tracking-widest text-gray-300 outline-none px-3 md:px-4 py-2.5 md:py-3 rounded-xl border border-white/5 appearance-none cursor-pointer hover:bg-white/10 flex-1 lg:min-w-[140px]"
              title="Speech-to-Text Model"
              value={selectedSttModel || ""}
              onChange={(e) => setSelectedSttModel(e.target.value)}
            >
              {sttModels.length === 0 && <option value="">Native Speech</option>}
              {sttModels.map(m => (
                <option key={m.modelId} value={m.modelId} className="bg-slate-900">
                  Mic: {m.displayName || m.modelId}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 relative flex items-center bg-white/5 rounded-xl border border-white/5">
            <input 
              className="w-full bg-transparent py-2.5 md:py-3 pl-4 md:pl-5 pr-24 md:pr-32 text-xs md:text-sm font-medium outline-none text-white placeholder-gray-500" 
              placeholder="Transform text..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiAction()}
            />
            <button 
              onClick={handleAiAction} 
              disabled={loading} 
              className="absolute right-1 top-1 bottom-1 px-3 md:px-5 rounded-lg bg-white text-black font-black text-[9px] md:text-[10px] uppercase tracking-tighter hover:bg-violet-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full"/> : <Wand2 size={12} />}
              <span className="hidden xs:inline">Transform</span>
            </button>
          </div>
          <button 
            onClick={toggleSpeech} 
            disabled={isProcessingStt}
            className={`p-2.5 md:p-3 rounded-xl transition-all relative flex items-center justify-center ${
              isRecording 
                ? 'bg-rose-500 text-white animate-pulse' 
                : 'bg-white/5 text-rose-400 hover:bg-rose-500/10'
            } ${isProcessingStt ? 'opacity-50 cursor-wait' : ''}`}
          >
            {isProcessingStt ? (
              <Loader2 size={20} className="animate-spin" />
            ) : isRecording ? (
              <MicOff size={20} />
            ) : (
              <Mic size={20} />
            )}
            
            {/* Visual Listening Ripple */}
            {isRecording && (
              <span className="absolute inset-0 rounded-xl bg-rose-500 animate-ping opacity-20 pointer-events-none" />
            )}
          </button>
        </div>
      </div>

      {/* Comparison Overlay */}
      <AnimatePresence>
        {suggestion && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl"
          >
            <div className="w-full max-w-5xl glass-panel rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 bg-white/5">
                <div>
                  <h3 className="text-lg md:text-xl font-display font-bold text-white flex items-center gap-2">
                    <Wand2 className="text-violet-500" /> Review
                  </h3>
                  <p className="text-[10px] md:text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">AI Vision Comparison</p>
                </div>
                <div className="flex gap-2 md:gap-4 w-full md:w-auto">
                  <button onClick={() => setSuggestion(null)} className="flex-1 md:flex-none px-4 md:px-6 py-2 rounded-xl text-xs md:text-sm font-bold text-gray-400 hover:bg-white/5 transition-all border border-white/5">
                    Discard
                  </button>
                  <button 
                    onClick={() => { 
                      if (selectionRange) {
                        editor.commands.insertContentAt(selectionRange, suggestion);
                      } else {
                        editor.commands.setContent(suggestion); 
                      }
                      setSuggestion(null); 
                      setSelectionRange(null);
                    }} 
                    className="flex-1 md:flex-none px-4 md:px-8 py-2 rounded-xl bg-violet-600 text-white text-xs md:text-sm font-bold shadow-lg shadow-violet-500/40 hover:bg-violet-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={18}/> Commit
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-[#050508] p-1 md:p-4 rounded-b-3xl">
                <div className="min-w-[600px] lg:min-w-0">
                  <ReactDiffViewer 
                    oldValue={selectionRange ? editor.state.doc.textBetween(selectionRange.from, selectionRange.to, ' ') : editor.storage.markdown.getMarkdown()} 
                    newValue={suggestion} 
                    splitView={window.innerWidth > 1024} 
                    useDarkTheme={true}
                    compareMethod={DiffMethod.WORDS}
                    styles={{
                      variables: {
                        dark: {
                          diffViewerBackground: 'transparent',
                          addedBackground: 'rgba(16, 185, 129, 0.1)',
                          addedColor: '#10b981',
                          removedBackground: 'rgba(239, 68, 68, 0.1)',
                          removedColor: '#ef4444',
                          wordAddedBackground: 'rgba(16, 185, 129, 0.25)',
                          wordRemovedBackground: 'rgba(239, 68, 68, 0.25)',
                          gutterBackground: 'rgba(0,0,0,0.2)',
                          gutterColor: '#4b5563',
                          codeFoldBackground: '#111827',
                          emptyLineBackground: 'transparent',
                        }
                      },
                      contentText: {
                        fontSize: '13px',
                        lineHeight: '1.6',
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                      },
                      gutter: {
                        padding: '0 15px',
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Main Stage */}
      <motion.div 
        layout
        className="glass-panel p-6 sm:p-12 rounded-3xl sm:rounded-[2.5rem] shadow-2xl min-h-[60vh] sm:min-h-[70vh] relative overflow-hidden"
      >
        <div className="absolute top-0 right-5 sm:right-10 text-[60px] sm:text-[120px] font-black text-white/[0.02] pointer-events-none select-none uppercase tracking-tighter">
          SOUL
        </div>
        <div className="relative z-10 h-full">
          <EditorContent editor={editor} />
        </div>
      </motion.div>
    </div>
  );
};

export default Editor;

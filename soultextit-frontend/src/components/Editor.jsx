import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Highlight from '@tiptap/extension-highlight';
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
      displayMode ? `$$ ${latex} $$` : `$ ${latex} $`
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
        getAttributes: match => ({ latex: match[1].trim(), displayMode: true }),
      }),
      nodeInputRule({
        find: /\$([^$]+)\$\s$/,
        type: this.type,
        getAttributes: match => ({ latex: match[1].trim(), displayMode: false }),
      }),
    ];
  },
  addPasteRules() {
    return [
      nodePasteRule({
        find: /\$\$([\s\S]+?)\$\$/g,
        type: this.type,
        getAttributes: match => ({ latex: match[1], displayMode: true }),
      }),
      nodePasteRule({
        find: /\$([\s\S]+?)\$/g,
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
          setup(markdownit) {
            markdownit.use((md) => {
              md.inline.ruler.after('escape', 'math_inline', (state, silent) => {
                if (state.src[state.pos] !== '$') return false;
                let end = state.src.indexOf('$', state.pos + 1);
                if (end === -1) return false;
                if (state.src[state.pos + 1] === '$') return false;
                if (!silent) {
                  const token = state.push('math_inline', 'span', 0);
                  token.attrs = [['data-latex', state.src.slice(state.pos + 1, end)], ['data-display', 'false']];
                }
                state.pos = end + 1;
                return true;
              });
              md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
                let pos = state.bMarks[startLine] + state.tShift[startLine];
                let max = state.eMarks[startLine];
                if (pos + 2 > max || state.src.slice(pos, pos + 2) !== '$$') return false;
                if (silent) return true;
                let nextLine = startLine + 1;
                let content = '';
                while (nextLine < endLine) {
                  pos = state.bMarks[nextLine] + state.tShift[nextLine];
                  max = state.eMarks[nextLine];
                  if (state.src.slice(pos, pos + 2) === '$$') { nextLine++; break; }
                  content += state.src.slice(pos, max) + '\n';
                  nextLine++;
                }
                state.line = nextLine;
                const token = state.push('math_block', 'div', 0);
                token.attrs = [['data-latex', content.trim()], ['data-display', 'true']];
                return true;
              });
            });
          }
        }
      }
    };
  }
});
import { io } from 'socket.io-client';
import { Download, Mic, MicOff, Wand2, Check, X, Save, History, FileUp, Plus, Trash2, Loader2, Eye, Code, HelpCircle, Layers, Sparkles, Volume2, VolumeX, FileText, FileJson, Type, Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered, Quote, SquareCode, Minus, Undo2, Redo2, Sigma, Copy, Eraser, Underline as UnderlineIcon, Subscript as SubscriptIcon, Superscript as SuperscriptIcon, Highlighter } from 'lucide-react';

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
  const [isDictating, setIsDictating] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [isProcessingStt, setIsProcessingStt] = useState(false);
  const [socket, setSocket] = useState(null);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [title, setTitle] = useState('A New Narrative');
  const lastFocusedRef = useRef({ id: 'editor', start: 0, end: 0 });
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
      try {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        console.warn("Storage access restricted by host browser.");
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
      Underline,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
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
    },
    onFocus: () => {
      lastFocusedRef.current = { id: 'editor', start: 0, end: 0 };
    }
  });

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await axiosAuth.get('/api/models');
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
      if (!data.text) {
        setIsProcessingStt(false);
        setIsRecording(false);
        return;
      }

      // Trimming removes leading spaces often returned by Whisper/STT providers
      const textToInsert = data.text.trim() + ' ';
      const target = lastFocusedRef.current;

      if (target.id === 'title') {
        setTitle(current => current.substring(0, target.start) + textToInsert + current.substring(target.end));
      } else if (target.id === 'prompt') {
        setPrompt(current => current.substring(0, target.start) + textToInsert + current.substring(target.end));
      } else if (editor) {
        editor.chain().focus().insertContent(textToInsert).run();
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
          // Fallback logic for STT model
          let sttModelToUse = selectedSttModel;
          if (!sttModelToUse && sttModels.length > 0) {
            sttModelToUse = sttModels.find(m => m.isDefault)?.modelId || sttModels[0].modelId;
            setSelectedSttModel(sttModelToUse);
          }
          
          socket.emit('stop-recording', { modelId: sttModelToUse });
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

  const handleDictate = () => {
    if (isDictating) {
      window.speechSynthesis.cancel();
      setIsDictating(false);
      return;
    }

    const { from, to } = editor.state.selection;
    const isSelection = from !== to;
    
    // Context-aware dictation: speaks selected text or the entire manuscript if no selection exists
    const textToSpeak = isSelection 
      ? editor.state.doc.textBetween(from, to, ' ') 
      : editor.getText();

    if (!textToSpeak || textToSpeak.trim().length === 0) return;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.rate = speechRate;
    
    // Neural Voice Selection Protocol
    const voices = window.speechSynthesis.getVoices();
    // Prioritize high-quality neural or natural-sounding voices provided by modern browser engines
    const neuralVoice = voices.find(v => 
      v.name.toLowerCase().includes('natural') || 
      v.name.toLowerCase().includes('neural') ||
      v.name.toLowerCase().includes('google')
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    if (neuralVoice) utterance.voice = neuralVoice;

    utterance.onstart = () => setIsDictating(true);
    utterance.onend = () => setIsDictating(false);
    utterance.onerror = (event) => {
      console.error("Neural Voice Engine Error:", event);
      setIsDictating(false);
    };

    // Force clear the speech queue to prevent collision in Chromium/WebKit engines
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  // Cleanup speech synthesis on unmount
  useEffect(() => {
    return () => window.speechSynthesis.cancel();
  }, []);

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
    if (!prompt) return;
    
    // Fallback logic if user hasn't selected a model but models exist
    let modelToUse = selectedModel;
    if (!modelToUse && availableModels.length > 0) {
      modelToUse = availableModels.find(m => m.isDefault)?.modelId || availableModels[0].modelId;
      setSelectedModel(modelToUse);
    }

    if (!modelToUse) {
      alert("Nexus Error: No active AI models detected in the current shard. Please contact an administrator.");
      return;
    }

    setLoading(true);
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

  const importFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axiosAuth.post('/api/canvases/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.text) {
        editor.commands.setContent(res.data.text);
        if (res.data.title) setTitle(res.data.title);
        setSaveStatus('dirty');
      }
    } catch (err) {
      console.error("Neural Extraction Failure:", err);
      alert("Nexus failed to decode the document structure.");
    } finally {
      setLoading(false);
      e.target.value = null; 
    }
  };

  const exportDocument = async (format) => {
    if (!editor) return;
    const content = editor.storage.markdown.getMarkdown();
    const html = editor.getHTML();
    
    setLoading(true);
    try {
      if (format === 'pdf') {
        const response = await axiosAuth.post('/api/canvases/export-pdf', { title, content }, { responseType: 'blob' });
        downloadBlob(response.data, `${title}.pdf`, 'application/pdf');
      } else if (format === 'docx') {
        const response = await axiosAuth.post('/api/canvases/export-docx', { title, content }, { responseType: 'blob' });
        downloadBlob(response.data, `${title}.docx`, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      } else if (format === 'md') {
        downloadBlob(new Blob([content]), `${title}.md`, 'text/markdown');
      } else if (format === 'txt') {
        downloadBlob(new Blob([editor.getText()]), `${title}.txt`, 'text/plain');
      } else if (format === 'html') {
        downloadBlob(new Blob([html]), `${title}.html`, 'text/html');
      }
    } catch (err) {
      console.error("Export Protocol Error:", err);
      alert(`Failed to export as ${format.toUpperCase()}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadBlob = (blob, fileName, type) => {
    const url = window.URL.createObjectURL(new Blob([blob], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const copyRawMarkdown = () => {
    const md = editor.storage.markdown.getMarkdown();
    navigator.clipboard.writeText(md);
    alert('Markdown copied to clipboard.');
  };

  const clearCanvas = () => {
    if (confirm('Clear entire manuscript? This cannot be undone.')) {
      editor.commands.clearContent();
      setSaveStatus('dirty');
    }
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
          <Sparkles size={12}/> Mathematics (KaTeX)
        </h4>
        <p className="text-[9px] text-gray-500 mb-3 leading-relaxed italic">Use standard LaTeX syntax for neural rendering.</p>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-cyan-400/60 uppercase font-black mb-1">Step 1: Syntax</p>
            <ul className="space-y-2 text-gray-300 font-mono text-[11px]">
              <li><code className="text-cyan-500">$...$</code> followed by space for inline</li>
              <li><code className="text-cyan-500">$$...$$</code> followed by space for blocks</li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] text-cyan-400/60 uppercase font-black mb-1">Step 2: Common Symbols</p>
            <ul className="space-y-1 text-gray-400 font-mono text-[10px]">
              <li>Fractions: <code className="text-gray-300">{"\\frac{a}{b}"}</code></li>
              <li>Greek: <code className="text-gray-300">{"\\alpha, \\beta, \\gamma"}</code></li>
              <li>Sum: <code className="text-gray-300">{"\\sum_{i=0}^n"}</code></li>
              <li>Matrix: <code className="text-gray-300">{"\\begin{matrix}...\\end{matrix}"}</code></li>
            </ul>
          </div>
          <div className="pt-2">
            <p className="text-[10px] text-gray-500 leading-tight">Protip: Click any rendered formula to edit the source code. The renderer triggers when you press Space after the closing symbol.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const ToolbarButton = ({ onClick, isActive, icon: Icon, title, activeClass = "text-violet-400 bg-violet-400/10 border-violet-400/20" }) => (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg transition-all border border-transparent hover:bg-white/10 hover:border-white/10 ${isActive ? activeClass : "text-gray-400"}`}
      title={title}
    >
      <Icon size={18} />
    </button>
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
            onBlur={e => lastFocusedRef.current = { id: 'title', start: e.target.selectionStart, end: e.target.selectionEnd }}
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
          <label className="p-3 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer" title="Import Document (Any Format)">
            <FileUp size={18}/>
            <input type="file" className="hidden" onChange={importFile} accept=".txt,.md,.pdf,.docx,.doc,.html,.rtf"/>
          </label>
          
          <div className="relative group/export">
            <button className="p-3 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all" title="Export Manuscript">
              <Download size={18}/>
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 glass-panel rounded-xl opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-[150] shadow-2xl p-2 border-white/10">
              <button onClick={() => exportDocument('pdf')} className="w-full flex items-center gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <FileText size={14} className="text-rose-500" /> PDF (Neural Print)
              </button>
              <button onClick={() => exportDocument('docx')} className="w-full flex items-center gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <Type size={14} className="text-blue-500" /> Word (.docx)
              </button>
              <button onClick={() => exportDocument('md')} className="w-full flex items-center gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <FileJson size={14} className="text-violet-500" /> Markdown (.md)
              </button>
              <button onClick={() => exportDocument('html')} className="w-full flex items-center gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <Code size={14} className="text-emerald-500" /> Web (.html)
              </button>
              <button onClick={() => exportDocument('txt')} className="w-full flex items-center gap-3 p-3 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <Type size={14} className="text-gray-400" /> Plain Text (.txt)
              </button>
            </div>
          </div>

          <button onClick={() => setShowMdGuide(true)} className="p-3 text-cyan-400 hover:bg-cyan-500/10 rounded-xl transition-all" title="Markdown Guide"><HelpCircle size={18}/></button>
          
          <div className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/5 overflow-hidden">
            <button 
              onClick={handleDictate} 
              className={`p-3 transition-all ${isDictating ? 'text-pink-500 animate-pulse bg-pink-500/10' : 'text-pink-400 hover:bg-pink-500/10'}`} 
              title={isDictating ? "Stop Dictation" : "Dictate (Read Aloud)"}
            >
              {isDictating ? <VolumeX size={18}/> : <Volume2 size={18}/>}
            </button>
            <select 
              value={speechRate} 
              onChange={(e) => {
                const newRate = parseFloat(e.target.value);
                setSpeechRate(newRate);
                if (isDictating) {
                  window.speechSynthesis.cancel();
                  setIsDictating(false);
                }
              }}
              className="bg-transparent text-xs font-black text-pink-400 px-3 pr-5 outline-none appearance-none cursor-pointer border-l border-white/5 hover:bg-white/5 h-full py-3"
              title="Dictation Speed"
            >
              {[0.25, 0.5, 1, 1.5, 2, 3, 4].map(r => (
                <option key={r} value={r} className="bg-slate-900">{r}x</option>
              ))}
            </select>
          </div>

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
              onBlur={e => lastFocusedRef.current = { id: 'prompt', start: e.target.selectionStart, end: e.target.selectionEnd }}
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
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-0 md:p-6 bg-black/90 backdrop-blur-2xl"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full h-full md:h-auto md:max-w-6xl glass-panel md:rounded-3xl overflow-hidden flex flex-col md:max-h-[90vh] shadow-[0_0_100px_rgba(139,92,246,0.15)]"
            >
              {/* Diff Header */}
              <div className="p-4 md:p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/10 bg-white/5 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-400">
                    <Wand2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-display font-bold text-white tracking-tight">Review Neural Shard</h3>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-0.5">Harmonizing Intelligence</p>
                  </div>
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => setSuggestion(null)} 
                    className="flex-1 md:flex-none px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/5 transition-all border border-white/5"
                  >
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
                    className="flex-1 md:flex-none px-6 py-2.5 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest shadow-xl shadow-white/5 hover:bg-violet-500 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Check size={16}/> Integrate
                  </button>
                </div>
              </div>

              {/* Diff Content Area */}
              <div className="flex-1 overflow-auto bg-[#050508] relative">
                <div className="min-w-full">
                  <ReactDiffViewer 
                    oldValue={selectionRange ? editor.state.doc.textBetween(selectionRange.from, selectionRange.to, ' ') : editor.storage.markdown.getMarkdown()} 
                    newValue={suggestion} 
                    splitView={window.innerWidth > 768} 
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
                          gutterBackground: 'rgba(255,255,255,0.02)',
                          gutterColor: '#4b5563',
                          codeFoldBackground: '#111827',
                          emptyLineBackground: 'transparent',
                          lineNumberColor: '#334155'
                        }
                      },
                      contentText: {
                        fontSize: '12px',
                        lineHeight: '1.7',
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      },
                      gutter: {
                        padding: '0 12px',
                        minWidth: '50px'
                      }
                    }}
                  />
                </div>
              </div>
              
              {/* Footer Helper for Mobile */}
              <div className="md:hidden p-3 bg-white/[0.02] border-t border-white/5 flex justify-center shrink-0">
                <span className="text-[9px] font-black text-gray-600 uppercase tracking-[0.2em]">Horizontal scroll for detail</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Main Stage */}
      <motion.div 
        layout
        className="glass-panel rounded-3xl sm:rounded-[2.5rem] shadow-2xl min-h-[60vh] sm:min-h-[70vh] relative overflow-hidden flex flex-col"
      >
        {/* Markdown Toolbar */}
        <div className="sticky top-0 z-30 p-3 sm:p-4 border-b border-white/5 bg-[#02010a]/80 backdrop-blur-xl flex flex-wrap items-center gap-1 shrink-0">
          <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
            <ToolbarButton 
              onClick={() => editor.chain().focus().undo().run()} 
              icon={Undo2} 
              title="Undo" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().redo().run()} 
              icon={Redo2} 
              title="Redo" 
            />
          </div>

          <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} 
              isActive={editor?.isActive('heading', { level: 1 })}
              icon={Heading1} 
              title="Heading 1" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} 
              isActive={editor?.isActive('heading', { level: 2 })}
              icon={Heading2} 
              title="Heading 2" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} 
              isActive={editor?.isActive('heading', { level: 3 })}
              icon={Heading3} 
              title="Heading 3" 
            />
          </div>

          <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleBold().run()} 
              isActive={editor?.isActive('bold')}
              icon={Bold} 
              title="Bold" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleItalic().run()} 
              isActive={editor?.isActive('italic')}
              icon={Italic} 
              title="Italic" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleUnderline().run()} 
              isActive={editor?.isActive('underline')}
              icon={UnderlineIcon} 
              title="Underline" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleStrike().run()} 
              isActive={editor?.isActive('strike')}
              icon={Strikethrough} 
              title="Strikethrough" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleHighlight().run()} 
              isActive={editor?.isActive('highlight')}
              icon={Highlighter} 
              title="Highlight" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleCode().run()} 
              isActive={editor?.isActive('code')}
              icon={Code} 
              title="Inline Code" 
            />
          </div>

          <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleSubscript().run()} 
              isActive={editor?.isActive('subscript')}
              icon={SubscriptIcon} 
              title="Subscript" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleSuperscript().run()} 
              isActive={editor?.isActive('superscript')}
              icon={SuperscriptIcon} 
              title="Superscript" 
            />
          </div>

          <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleBulletList().run()} 
              isActive={editor?.isActive('bulletList')}
              icon={List} 
              title="Bullet List" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleOrderedList().run()} 
              isActive={editor?.isActive('orderedList')}
              icon={ListOrdered} 
              title="Ordered List" 
            />
          </div>

          <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleBlockquote().run()} 
              isActive={editor?.isActive('blockquote')}
              icon={Quote} 
              title="Blockquote" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().toggleCodeBlock().run()} 
              isActive={editor?.isActive('codeBlock')}
              icon={SquareCode} 
              title="Code Block" 
            />
            <ToolbarButton 
              onClick={() => editor.chain().focus().setHorizontalRule().run()} 
              icon={Minus} 
              title="Horizontal Rule" 
            />
          </div>

          <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
            <ToolbarButton 
              onClick={() => {
                const latex = prompt('Enter LaTeX:');
                if (latex) editor.chain().focus().insertContent({ type: 'math', attrs: { latex, displayMode: false } }).run();
              }} 
              icon={Sigma} 
              title="Insert Math" 
              activeClass="text-cyan-400 bg-cyan-400/10 border-cyan-400/20"
            />
          </div>

          <div className="flex items-center gap-1">
            <ToolbarButton 
              onClick={copyRawMarkdown} 
              icon={Copy} 
              title="Copy Raw Markdown" 
            />
            <ToolbarButton 
              onClick={clearCanvas} 
              icon={Eraser} 
              title="Clear All" 
              activeClass="text-rose-400 bg-rose-400/10 border-rose-400/20"
            />
          </div>
        </div>

        <div className="p-6 sm:p-12 flex-1 relative">
          <div className="absolute top-0 right-5 sm:right-10 text-[60px] sm:text-[120px] font-black text-white/[0.02] pointer-events-none select-none uppercase tracking-tighter">
            SOUL
          </div>
          <div className="relative z-10 h-full">
            <EditorContent editor={editor} />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Editor;

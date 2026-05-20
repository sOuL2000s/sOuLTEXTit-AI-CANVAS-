import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ReactDiffViewer from 'react-diff-viewer-continued';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Download, Mic, MicOff, Wand2, Check, X, Save, History, FileUp, Plus, Trash2, Loader2 } from 'lucide-react';
import { jsPDF } from "jspdf";

import { motion, AnimatePresence } from 'framer-motion';

const Editor = () => {
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState(null);
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

  // Define axios instance outside or memoize to ensure consistency
  const axiosAuth = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const fetchCanvases = async () => {
    try {
      const res = await axiosAuth.get('/api/canvases');
      setCanvases(res.data);
    } catch (e) { console.error("Archive inaccessible"); }
  };

  const editor = useEditor({
    extensions: [StarterKit.configure({
      placeholder: 'Begin your journey here...',
    })],
    content: '',
    onUpdate: () => setSaveStatus('dirty')
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

  // Auto-save logic
  useEffect(() => {
    if (!editor || saveStatus !== 'dirty') return;
    const timer = setTimeout(() => {
      saveCanvas();
    }, 2000);
    return () => clearTimeout(timer);
  }, [editor?.getHTML(), title, saveStatus]);

  const handleAiAction = async () => {
    if (!prompt || !selectedModel) {
      if (!selectedModel) alert("Please select an AI model from the dropdown first.");
      return;
    }
    setLoading(true);
    
    const { from, to } = editor.state.selection;
    const isSelection = from !== to;
    const context = isSelection ? editor.state.doc.textBetween(from, to, ' ') : editor.getHTML();
    
    setSelectionRange(isSelection ? { from, to } : null);

    try {
      const res = await axiosAuth.post('/api/ai/edit', { 
        prompt, 
        context: context, 
        modelId: selectedModel 
      });
      
      const rawOutput = res.data.suggestion;
      const cleanHtml = rawOutput.includes('<p>') ? 
        rawOutput : 
        `<p>${rawOutput.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br/>')}</p>`;
        
      setSuggestion(cleanHtml);
    } catch (err) { 
      console.error("AI Protocol Error:", err);
      alert(err.response?.data?.error || "Neural link unstable."); 
    }
    setLoading(false);
  };

  const saveCanvas = async () => {
    setSaveStatus('saving');
    try {
      await axiosAuth.post('/api/canvases', { title, content: editor.getHTML() });
      setSaveStatus('saved');
      fetchCanvases();
    } catch (err) { 
      console.error("Archive failed");
      setSaveStatus('error');
    }
  };

  const createNewCanvas = () => {
    setTitle('A New Narrative');
    editor.commands.setContent('');
    setSaveStatus('idle');
    setIsSidebarOpen(false);
  };

  const loadCanvas = (canvas) => {
    setTitle(canvas.title);
    editor.commands.setContent(canvas.content);
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

  // Removed old native SpeechRecognition implementation

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
      {/* Floating Sidebar Toggle (Contextual Navigation) */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="fixed left-6 top-32 z-50 p-3 glass-panel rounded-xl text-violet-400 hover:text-white transition-colors shadow-xl"
        title="Archive Explorer"
      >
        <History size={20} />
      </button>

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
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-80 glass-panel border-r border-white/10 z-[70] p-8 shadow-2xl"
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
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8"
      >
        <div className="w-full lg:w-auto">
          <input 
            className="text-4xl sm:text-5xl font-display font-black outline-none bg-transparent text-white placeholder-white/10 w-full tracking-tighter hover:bg-white/5 px-2 rounded-lg transition-colors" 
            value={title} 
            onChange={e => setTitle(e.target.value)} 
          />
          <div className="flex items-center gap-4 mt-2 px-2">
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded ${saveStatus === 'saved' ? 'bg-emerald-500/20 text-emerald-400' : (saveStatus === 'saving' ? 'bg-violet-500/20 text-violet-400' : 'bg-amber-500/20 text-amber-400')}`}>
              {saveStatus === 'saved' ? 'Synchronized' : (saveStatus === 'saving' ? 'Syncing...' : 'Modified')}
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Autosave Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
          <label className="p-3 text-emerald-400 hover:bg-emerald-500/10 rounded-xl transition-all cursor-pointer">
            <FileUp size={18}/>
            <input type="file" className="hidden" onChange={importFile} accept=".txt,.md"/>
          </label>
          <button onClick={exportPDF} className="p-3 text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all"><Download size={18}/></button>
          <button className="p-3 text-gray-400 hover:bg-white/10 rounded-xl transition-all"><History size={18}/></button>
        </div>
      </motion.div>

      {/* AI command dock */}
      <div className="sticky top-24 z-40 mb-12">
        <div className="glass-panel p-2 rounded-2xl flex flex-col sm:flex-row gap-2 shadow-2xl shadow-purple-900/20 border-white/10">
          <div className="flex gap-2">
            <select 
              className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-300 outline-none px-4 py-3 rounded-xl border border-white/5 appearance-none cursor-pointer hover:bg-white/10 min-w-[140px]"
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
              className="bg-white/5 text-[10px] font-black uppercase tracking-widest text-gray-300 outline-none px-4 py-3 rounded-xl border border-white/5 appearance-none cursor-pointer hover:bg-white/10 min-w-[140px]"
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
          <div className="flex-1 relative">
            <input 
              className="w-full bg-transparent p-3 pl-5 pr-32 text-sm font-medium outline-none text-white placeholder-gray-500" 
              placeholder="What shall we create today?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAiAction()}
            />
            <button 
              onClick={handleAiAction} 
              disabled={loading} 
              className="absolute right-1 top-1 bottom-1 px-5 rounded-lg bg-white text-black font-black text-[10px] uppercase tracking-tighter hover:bg-violet-500 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <div className="w-3 h-3 border-2 border-current border-t-transparent animate-spin rounded-full"/> : <Wand2 size={12} />}
              Transform
            </button>
          </div>
          <button 
            onClick={toggleSpeech} 
            disabled={isProcessingStt}
            className={`p-3 rounded-xl transition-all relative ${
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
              <div className="p-6 flex justify-between items-center border-b border-white/10 bg-white/5">
                <div>
                  <h3 className="text-xl font-display font-bold text-white flex items-center gap-2">
                    <Wand2 className="text-violet-500" /> Review Suggestion
                  </h3>
                  <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-semibold">Compare Original vs AI Vision</p>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setSuggestion(null)} className="px-6 py-2 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 transition-all">
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
                    className="px-8 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold shadow-lg shadow-violet-500/40 hover:bg-violet-500 transition-all flex items-center gap-2"
                  >
                    <Check size={18}/> Commit Changes
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-diff-viewer">
                <ReactDiffViewer 
                  oldValue={selectionRange ? editor.state.doc.textBetween(selectionRange.from, selectionRange.to, ' ') : editor.getHTML()} 
                  newValue={suggestion} 
                  splitView={true} 
                  useDarkTheme={true}
                  styles={{
                    variables: {
                      dark: {
                        diffViewerBackground: 'transparent',
                        addedBackground: 'rgba(16, 185, 129, 0.1)',
                        removedBackground: 'rgba(239, 68, 68, 0.1)',
                      }
                    }
                  }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Main Stage */}
      <motion.div 
        layout
        className="glass-panel p-12 rounded-[2.5rem] shadow-2xl min-h-[70vh] relative"
      >
        <div className="absolute top-0 right-10 text-[120px] font-black text-white/[0.02] pointer-events-none select-none uppercase tracking-tighter">
          SOUL
        </div>
        <div className="relative z-10">
          <EditorContent editor={editor} />
        </div>
      </motion.div>
    </div>
  );
};

export default Editor;

import React, { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ReactDiffViewer from 'react-diff-viewer-continued';
import axios from 'axios';
import { Download, Mic, Wand2, Check, X, Save, History, FileUp } from 'lucide-react';
import { jsPDF } from "jspdf";

import { motion, AnimatePresence } from 'framer-motion';

const Editor = () => {
  const [prompt, setPrompt] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('gemini');
  const [title, setTitle] = useState('A New Narrative');
  const [isRecording, setIsRecording] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle, saving, saved

  const editor = useEditor({
    extensions: [StarterKit.configure({
      placeholder: 'Begin your journey here...',
    })],
    content: '',
    onUpdate: () => setSaveStatus('idle')
  });

  const axiosAuth = axios.create({
    baseURL: 'http://localhost:5000',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const handleAiAction = async () => {
    if (!prompt) return;
    setLoading(true);
    const selection = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, ' ') || editor.getHTML();
    try {
      const res = await axiosAuth.post('/api/ai/edit', { prompt, context: selection, provider });
      // Standardize output to HTML for Tiptap
      setSuggestion(res.data.suggestion.includes('<p>') ? res.data.suggestion : `<p>${res.data.suggestion.replace(/\n/g, '</p><p>')}</p>`);
    } catch (err) { 
      console.error(err);
      alert(err.response?.data?.error || "Connection to the Neural Mesh failed."); 
    }
    setLoading(false);
  };

  const saveCanvas = async () => {
    try {
      await axiosAuth.post('/api/canvases', { title, content: editor.getHTML() });
    } catch (err) { console.error("Archive failed"); }
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

  const startSpeech = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      editor.commands.insertContent(transcript + ' ');
    };
    recognition.start();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
            <span className={`text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded ${saveStatus === 'saved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {saveStatus === 'saved' ? 'Synchronized' : 'Draft'}
            </span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              Last modified: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-2xl border border-white/5">
          <button onClick={saveCanvas} className="p-3 text-violet-400 hover:bg-violet-500/10 rounded-xl transition-all" title="Save Draft"><Save size={18}/></button>
          <div className="w-[1px] h-4 bg-white/10 mx-1" />
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
              className="bg-white/5 text-[11px] font-black uppercase tracking-widest text-gray-300 outline-none px-4 py-3 rounded-xl border border-white/5 appearance-none cursor-pointer hover:bg-white/10"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="gemini" className="bg-slate-900">Gemini Neural</option>
              <option value="groq" className="bg-slate-900">Llama Quantum</option>
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
            onClick={startSpeech} 
            className={`p-3 rounded-xl transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/5 text-rose-400 hover:bg-rose-500/10'}`}
          >
            <Mic size={20} />
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
                  <button onClick={() => { editor.commands.setContent(suggestion); setSuggestion(null); }} className="px-8 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold shadow-lg shadow-violet-500/40 hover:bg-violet-500 transition-all flex items-center gap-2">
                    <Check size={18}/> Commit Changes
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 custom-diff-viewer">
                <ReactDiffViewer 
                  oldValue={editor.getHTML()} 
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

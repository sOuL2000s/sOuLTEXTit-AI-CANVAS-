import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, Mic, MicOff, Paperclip, Trash2, Plus, 
  History, Copy, Volume2, VolumeX, Download, 
  User, Sparkles, Loader2, X, FileText, Check,
  RotateCcw, Square, Pencil
} from 'lucide-react';
import { io } from 'socket.io-client';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const Conversations = () => {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [editingFileIndex, setEditingFileIndex] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingStt, setIsProcessingStt] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [dictatingIndex, setDictatingIndex] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [deleteConfirmIndex, setDeleteConfirmIndex] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userPrefs, setUserPrefs] = useState(null);
  const [models, setModels] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');
  
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chatEndRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const abortControllerRef = useRef(null);

  const axiosAuth = useMemo(() => {
    const instance = axios.create({ baseURL: import.meta.env.VITE_API_URL });
    instance.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, []);

  useEffect(() => {
    fetchData();
    initSocket();
    return () => {
      if (socketRef.current) socketRef.current.close();
      window.speechSynthesis.cancel();
    };
  }, []);

  // Fix: Scroll the specific container instead of the whole page to prevent jumping
  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest' 
      });
    }
  }, [messages.length, loading]);

  const fetchData = async () => {
    try {
      // Use individual try-catches or separate awaits to prevent one failure (like /me) 
      // from blocking the loading of other data (like chats).
      const [chatsRes, userRes, modelsRes] = await Promise.allSettled([
        axiosAuth.get('/api/conversations'),
        axiosAuth.get('/api/user/me'),
        axiosAuth.get('/api/models')
      ]);

      if (chatsRes.status === 'fulfilled') setChats(chatsRes.value.data);
      if (userRes.status === 'fulfilled') setUserPrefs(userRes.value.data.preferences);
      if (modelsRes.status === 'fulfilled') setModels(modelsRes.value.data);
      
      if (chatsRes.status === 'rejected') console.error("Archive Access Failed");
      if (userRes.status === 'rejected') console.error("Identity shard unreachable");
    } catch (e) { console.error("Nexus Sync Failed"); }
  };

  const initSocket = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    const socket = io(import.meta.env.VITE_API_URL, {
      query: { userId: user?._id }
    });
    socketRef.current = socket;
    socket.on('transcription-result', (data) => {
      if (data.text) {
        // Trimming removes leading/trailing spaces often returned by STT providers
        const textToInsert = data.text.trim() + ' ';
        setInput(prev => (prev ? prev.trimEnd() + ' ' : '') + textToInsert);
      }
      setIsProcessingStt(false);
      setIsRecording(false);
    });
    socket.on('stt-error', () => {
      setIsProcessingStt(false);
      setIsRecording(false);
    });
  };

  const startNewChat = async () => {
    try {
      const res = await axiosAuth.post('/api/conversations', { title: 'New Narrative' });
      setChats(prev => [res.data, ...prev]);
      setActiveChat(res.data);
      setMessages([]);
      setIsSidebarOpen(false);
      return res.data;
    } catch (e) { 
      console.error("Genesis Error");
      return null;
    }
  };

  const loadChat = async (chat) => {
    try {
      const res = await axiosAuth.get(`/api/conversations/${chat._id}`);
      setActiveChat(res.data);
      setMessages(res.data.messages || []);
      setIsSidebarOpen(false);
    } catch (e) { console.error("Archive Error"); }
  };

  const deleteChat = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Discard this timeline?')) return;
    try {
      await axiosAuth.delete(`/api/conversations/${id}`);
      setChats(prev => prev.filter(c => c._id !== id));
      if (activeChat?._id === id) {
        setActiveChat(null);
        setMessages([]);
      }
    } catch (e) { console.error("Pruning Failed"); }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    if (value.length > 800) {
      const virtualFileName = `Draft_Context_${new Date().toLocaleTimeString().replace(/:/g, '-')}.txt`;
      setAttachments(prev => [...prev, {
        name: virtualFileName,
        content: value,
        type: 'text/plain'
      }]);
      setInput('');
    } else {
      setInput(value);
    }
  };

  const handleSend = async () => {
    if (loading) {
      handleStop();
      return;
    }
    
    const finalInput = input.trim();
    if (!finalInput && attachments.length === 0) return;
    
    let currentChat = activeChat;
    if (!currentChat) {
      currentChat = await startNewChat();
    }
    if (!currentChat) return;

    const userMessage = { role: 'user', content: finalInput || "[Neural Shard Attachment]", attachments: [...attachments], timestamp: new Date() };
    const newMessages = [...messages, userMessage];
    
    // Immediate state update
    setMessages(newMessages);
    setInput('');
    setAttachments([]);
    setLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const modelId = userPrefs?.textModelId || models.find(m => m.category === 'text' && m.isDefault)?.modelId || models.find(m => m.category === 'text')?.modelId;
      
      const res = await axiosAuth.post('/api/ai/chat', 
        { messages: newMessages, modelId },
        { signal: abortControllerRef.current.signal }
      );

      const assistantMessage = { 
        role: 'assistant', 
        content: res.data.response, 
        timestamp: new Date() 
      };
      
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Prepare data for MongoDB
      const persistenceMessages = finalMessages.map(msg => {
        let dbContent = msg.content;
        if (msg.role === 'user' && msg.attachments?.length > 0) {
          dbContent += `\n\n[${msg.attachments.length} file(s) attached]`;
        }
        return {
          role: msg.role,
          content: dbContent,
          timestamp: msg.timestamp
        };
      });

      const updatedChat = await axiosAuth.patch(`/api/conversations/${currentChat._id}`, {
        messages: persistenceMessages,
        title: finalInput ? (finalInput.length > 30 ? finalInput.slice(0, 30) + "..." : finalInput) : currentChat.title
      });
      
      setActiveChat({ ...updatedChat.data, messages: finalMessages });
      fetchData();

    } catch (e) { 
      if (axios.isCancel(e)) {
        console.log("Neural stream terminated by user.");
      } else if (e.response?.status === 403) {
        alert(e.response.data.error || "Dialogue Limit Reached.");
        setMessages(messages);
      } else {
        alert("Neural Overload: Memory synchronization failed."); 
      }
    } finally { 
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const processFile = async (file) => {
    setIsExtracting(true);

    // Immediate preview and handling for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        setAttachments(prev => [...prev, { 
          name: file.name, 
          content: reader.result, // This is the Base64 DataURL for images
          type: file.type,
          isImage: true 
        }]);
        setIsExtracting(false);
      };
      reader.readAsDataURL(file);
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axiosAuth.post('/api/canvases/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.text) {
        setAttachments(prev => [...prev, { 
          name: file.name, 
          content: res.data.text, 
          type: file.type,
          isImage: false
        }]);
      }
    } catch (err) {
      console.error("Extraction failed:", err);
      const reader = new FileReader();
      reader.onload = () => setAttachments(prev => [...prev, { name: file.name, content: reader.result, type: file.type, isImage: false }]);
      reader.readAsText(file);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = null;
  };

  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) processFile(file);
      }
    }
  };

  const updateAttachment = (index, updates) => {
    const updated = [...attachments];
    updated[index] = { ...updated[index], ...updates };
    setAttachments(updated);
  };

  const openFileEditor = (index) => {
    setEditingFileIndex(index);
  };

  const saveFileEdit = (content) => {
    if (editingFileIndex !== null) {
      updateAttachment(editingFileIndex, { content });
      setEditingFileIndex(null);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => socketRef.current.emit('audio-chunk', e.data);
        recorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const sttId = userPrefs?.sttModelId || models.find(m => m.category === 'stt' && m.isDefault)?.modelId || models.find(m => m.category === 'stt')?.modelId;
            socketRef.current.emit('stop-recording', { modelId: sttId });
            setIsProcessingStt(true);
        };
        recorder.start(1000);
        setIsRecording(true);
      } catch (e) { alert("Mic Access Denied"); }
    }
  };



  const exportChat = () => {
    const content = messages.map(m => `${m.role.toUpperCase()}:\n${m.content}\n`).join('\n---\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Chat_Export.md`;
    link.click();
  };

  const dictateMessage = (text, index) => {
    if (isDictating && dictatingIndex === index) {
      window.speechSynthesis.cancel();
      setIsDictating(false);
      setDictatingIndex(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => {
        setIsDictating(true);
        setDictatingIndex(index);
      };
      utterance.onend = () => {
        setIsDictating(false);
        setDictatingIndex(null);
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const deleteMessage = async (index) => {
    if (!activeChat) return;
    const updated = messages.filter((_, i) => i !== index);
    setMessages(updated);

    const persistenceMessages = updated.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));

    await axiosAuth.patch(`/api/conversations/${activeChat._id}`, { messages: persistenceMessages });
  };

  const handleUpdateMessage = async (index) => {
    if (!editText.trim() || !activeChat) return;
    
    const truncated = messages.slice(0, index);
    const updatedUserMessage = { ...messages[index], content: editText, timestamp: new Date() };
    const newMessages = [...truncated, updatedUserMessage];
    
    setMessages(newMessages);
    setEditingIndex(null);
    setEditText('');
    setLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const modelId = userPrefs?.textModelId || models.find(m => m.category === 'text' && m.isDefault)?.modelId || models.find(m => m.category === 'text')?.modelId;
      const res = await axiosAuth.post('/api/ai/chat', 
        { messages: newMessages, modelId },
        { signal: abortControllerRef.current.signal }
      );
      const assistantMessage = { role: 'assistant', content: res.data.response, timestamp: new Date() };
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      const persistenceMessages = finalMessages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      await axiosAuth.patch(`/api/conversations/${activeChat._id}`, {
        messages: persistenceMessages,
        lastModified: Date.now()
      });
      fetchData();
    } catch (e) { 
      if (axios.isCancel(e)) {
        console.log("Neural stream terminated by user.");
      } else {
        alert("Neural Re-generation Failed"); 
      }
    } finally { 
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const regenerateLast = async () => {
    if (messages.length === 0) return;
    const lastUserMsgIndex = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserMsgIndex === -1) return;
    
    const actualIndex = messages.length - 1 - lastUserMsgIndex;
    const truncatedMessages = messages.slice(0, actualIndex + 1);
    setMessages(truncatedMessages);
    setLoading(true);
    
    try {
      const modelId = userPrefs?.textModelId || models.find(m => m.category === 'text' && m.isDefault)?.modelId;
      const res = await axiosAuth.post('/api/ai/chat', { messages: truncatedMessages, modelId });
      const assistantMessage = { role: 'assistant', content: res.data.response, timestamp: new Date() };
      const final = [...truncatedMessages, assistantMessage];
      setMessages(final);

      const persistenceMessages = final.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }));

      await axiosAuth.patch(`/api/conversations/${activeChat._id}`, { messages: persistenceMessages });
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const exportCurrentChat = async (format) => {
    if (!activeChat) return;
    if (format === 'pdf') {
        const res = await axiosAuth.post(`/api/conversations/${activeChat._id}/export-pdf`, {}, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${activeChat.title}.pdf`);
        document.body.appendChild(link);
        link.click();
    } else {
        const content = messages.map(m => `### ${m.role.toUpperCase()}\n${m.content}`).join('\n\n');
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${activeChat.title}.md`;
        link.click();
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] relative gap-6">
      <AnimatePresence>
        {isSidebarOpen && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] lg:hidden"/>}
      </AnimatePresence>

      <motion.aside className={`fixed lg:relative inset-y-0 left-0 w-80 glass-panel z-[70] lg:z-0 transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:block'}`}>
        <div className="p-6 h-full flex flex-col">
            <button onClick={startNewChat} className="w-full p-4 mb-6 rounded-2xl bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all"><Plus size={14} /> New Dialogue</button>
            <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                {chats.map(c => (
                    <div key={c._id} className="group relative">
                        <button onClick={() => loadChat(c)} className={`w-full text-left p-4 rounded-xl border ${activeChat?._id === c._id ? 'bg-white/10 border-white/10' : 'border-transparent hover:bg-white/5'}`}>
                            <p className="text-sm font-bold text-gray-300 truncate pr-8">{c.title}</p>
                            <p className="text-[9px] text-gray-600 mt-1 uppercase font-bold tracking-widest">{new Date(c.lastModified).toLocaleDateString()}</p>
                        </button>
                        <button onClick={(e) => deleteChat(c._id, e)} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14} /></button>
                    </div>
                ))}
            </div>
        </div>
      </motion.aside>

      <main className="flex-1 glass-panel rounded-[2.5rem] flex flex-col overflow-hidden relative shadow-2xl">
        <header className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#02010a]/40 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-gray-400"><History size={20}/></button>
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center text-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.2)]"><Sparkles size={20} /></div>
            <div><h2 className="text-lg font-display font-black text-white tracking-tight uppercase">{activeChat?.title || 'Neural Nexus'}</h2><p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Quantum Shard Active</p></div>
          </div>
          <div className="flex gap-2">
             <button onClick={() => exportCurrentChat('md')} className="p-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all" title="Export Markdown"><FileText size={18}/></button>
             <button onClick={() => exportCurrentChat('pdf')} className="p-3 text-violet-400 hover:text-white hover:bg-violet-500/10 rounded-xl transition-all" title="Export PDF"><Download size={18}/></button>
          </div>
        </header>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-10 custom-scrollbar scroll-smooth"
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 md:gap-5 ${m.role === 'user' ? 'flex-row-reverse' : ''} group w-full`}>
              <div className={`w-9 h-9 md:w-11 md:h-11 rounded-xl shrink-0 flex items-center justify-center border transition-all duration-500 ${m.role === 'user' ? 'bg-white text-black border-white shadow-lg' : 'bg-violet-900/20 text-violet-400 border-violet-500/20 shadow-[0_0_15px_rgba(139,92,246,0.1)]'}`}>
                {m.role === 'user' ? <User size={18}/> : <Sparkles size={18}/>}
              </div>
              
              <div className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[80%] lg:max-w-[70%] ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`w-full p-4 md:p-6 rounded-[1.5rem] shadow-xl ${m.role === 'user' ? 'bg-white/5 border border-white/10 rounded-tr-none' : 'bg-white/[0.03] border border-white/5 rounded-tl-none'} transition-all duration-300 overflow-hidden`}>
                  {m.attachments && m.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {m.attachments.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg text-[10px] font-bold text-violet-400">
                          <FileText size={12} /> {file.name}
                        </div>
                      ))}
                    </div>
                  )}

                  {editingIndex === i ? (
                    <div className="space-y-3">
                      <textarea 
                        className="w-full bg-white/5 border border-white/10 p-3 rounded-xl text-white text-sm outline-none focus:border-violet-500 min-h-[100px] resize-none"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        autoFocus
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditingIndex(null)} className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all">Cancel</button>
                        <button onClick={() => handleUpdateMessage(i)} className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-violet-500 hover:text-white transition-all">Save & Sync</button>
                      </div>
                    </div>
                  ) : (
                    <div className={`prose prose-invert prose-sm md:prose-base max-w-none break-words selection:bg-violet-500/30 ${m.role === 'user' ? 'text-right' : ''}`}>
                      <ReactMarkdown
                        components={{
                          code({ node, inline, className, children, ...props }) {
                            const match = /language-(\w+)/.exec(className || '');
                            const isBlock = !inline && match;
                            const codeText = String(children).replace(/\n$/, '');
                            const [isCopied, setIsCopied] = useState(false);

                            if (isBlock) {
                              return (
                                <div className="relative group/code my-4 rounded-xl overflow-hidden border border-white/10 text-left">
                                  <div className="flex justify-between items-center px-4 py-2 bg-white/5 border-b border-white/5">
                                    <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest">{match ? match[1] : 'code'}</span>
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(codeText);
                                        setIsCopied(true);
                                        setTimeout(() => setIsCopied(false), 2000);
                                      }} 
                                      className={`${isCopied ? 'text-emerald-400' : 'text-gray-500'} hover:text-white transition-colors`}
                                    >
                                      {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                    </button>
                                  </div>
                                  <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                                    <SyntaxHighlighter
                                      style={atomDark}
                                      language={match ? match[1] : 'text'}
                                      PreTag="div"
                                      customStyle={{ margin: 0, background: '#050508', padding: '1.25rem', minWidth: '100%', fontSize: '13px' }}
                                      {...props}
                                    >
                                      {codeText}
                                    </SyntaxHighlighter>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <code className="bg-white/10 px-1.5 py-0.5 rounded text-violet-300 font-mono text-[0.9em] inline-block align-middle overflow-x-auto whitespace-pre-wrap max-w-full scrollbar-thin" {...props}>
                                {children}
                              </code>
                            );
                          }
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                <div className={`mt-3 flex items-center gap-4 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <button 
                    onClick={() => dictateMessage(m.content, i)} 
                    className={`${isDictating && dictatingIndex === i ? 'text-pink-500' : 'text-gray-600'} hover:text-pink-400 transition-colors`} 
                    title={isDictating && dictatingIndex === i ? "Stop" : "Dictate"}
                  >
                    {isDictating && dictatingIndex === i ? <Square size={14} fill="currentColor" /> : <Volume2 size={14}/>}
                  </button>
                  
                  <button 
                    onClick={() => copyToClipboard(m.content, i)} 
                    className={`${copiedIndex === i ? 'text-emerald-500' : 'text-gray-600'} hover:text-white transition-colors`} 
                    title="Copy Markdown"
                  >
                    {copiedIndex === i ? <Check size={14} /> : <Copy size={14}/>}
                  </button>
                  
                  {m.role === 'user' && (
                    <button onClick={() => { setEditingIndex(i); setEditText(m.content); }} className="text-gray-600 hover:text-violet-400 transition-colors" title="Edit Message"><Pencil size={14}/></button>
                  )}
                  
                  <div className="relative">
                    <AnimatePresence>
                      {deleteConfirmIndex === i && (
                        <motion.div 
                          initial={{ width: 0, opacity: 0 }}
                          animate={{ width: 'auto', opacity: 1 }}
                          exit={{ width: 0, opacity: 0 }}
                          className="absolute right-full mr-2 bg-rose-500/10 border border-rose-500/20 rounded-lg flex overflow-hidden whitespace-nowrap z-10"
                        >
                          <button 
                            onClick={() => { deleteMessage(i); setDeleteConfirmIndex(null); }}
                            className="px-3 py-1 text-[9px] font-black uppercase text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                          >
                            Confirm
                          </button>
                          <button 
                            onClick={() => setDeleteConfirmIndex(null)}
                            className="px-3 py-1 text-[9px] font-black uppercase text-gray-500 hover:bg-white/5"
                          >
                            Cancel
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button 
                      onClick={() => setDeleteConfirmIndex(deleteConfirmIndex === i ? null : i)} 
                      className={`${deleteConfirmIndex === i ? 'text-rose-500' : 'text-gray-600'} hover:text-rose-500 transition-colors`} 
                      title="Prune Message"
                    >
                      <Trash2 size={14}/>
                    </button>
                  </div>
                  
                  {m.role === 'assistant' && i === messages.length - 1 && (
                    <button 
                      onClick={regenerateLast} 
                      disabled={loading}
                      className={`${loading ? 'text-emerald-400' : 'text-gray-600'} hover:text-emerald-400 transition-colors`} 
                      title="Regenerate Shard"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14}/>}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {loading && <div className="flex gap-4"><div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center"><Loader2 size={16} className="animate-spin text-violet-400" /></div></div>}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 shrink-0 relative">
          {/* Enhanced Attachment Shards */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4 px-2">
              {attachments.map((file, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={i} 
                  className="flex flex-col gap-2 p-3 bg-white/[0.03] border border-white/10 rounded-2xl min-w-[140px] max-w-[200px] group relative hover:border-violet-500/50 transition-all shadow-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between relative z-10">
                    <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
                      <FileText size={14} />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!file.isImage && <button onClick={() => openFileEditor(i)} className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white" title="Edit Content"><Pencil size={12}/></button>}
                      <button onClick={() => setAttachments(attachments.filter((_, idx) => idx !== i))} className="p-1.5 hover:bg-rose-500/10 rounded-md text-gray-400 hover:text-rose-500"><X size={12}/></button>
                    </div>
                  </div>

                  {file.isImage && (
                    <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-40 transition-opacity">
                      <img src={file.content} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="mt-1 relative z-10">
                    <p className="text-[10px] font-black text-white truncate uppercase tracking-tighter" title={file.name}>{file.name}</p>
                    <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">{Math.round(file.content.length / 1024 * 10) / 10} KB • {file.type.split('/')[1] || 'shd'}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Neural File Editor Overlay */}
          <AnimatePresence>
            {editingFileIndex !== null && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-full left-6 right-6 mb-4 glass-panel p-6 rounded-[2rem] z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] border-violet-500/30"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-500/20 rounded-lg text-violet-400"><Pencil size={16}/></div>
                    <div>
                      <input 
                        className="bg-transparent text-sm font-black text-white outline-none border-b border-transparent focus:border-violet-500 transition-colors uppercase tracking-tight"
                        value={attachments[editingFileIndex].name}
                        onChange={(e) => updateAttachment(editingFileIndex, { name: e.target.value })}
                      />
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Editing Neural Shard</p>
                    </div>
                  </div>
                  <button onClick={() => setEditingFileIndex(null)} className="p-2 text-gray-500 hover:text-white"><X size={20}/></button>
                </div>
                <textarea 
                  className="w-full h-48 bg-black/40 border border-white/5 p-4 rounded-xl text-xs font-mono text-gray-300 outline-none focus:border-violet-500/50 transition-all custom-scrollbar resize-none"
                  value={attachments[editingFileIndex].content}
                  onChange={(e) => updateAttachment(editingFileIndex, { content: e.target.value })}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <button onClick={() => setEditingFileIndex(null)} className="px-6 py-2 rounded-xl bg-white text-black text-[10px] font-black uppercase tracking-widest hover:bg-violet-500 hover:text-white transition-all shadow-lg active:scale-95">Save Changes</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`glass-panel p-2 rounded-2xl md:rounded-[2rem] border-white/10 shadow-2xl transition-all ${isExtracting ? 'opacity-50 pointer-events-none' : ''}`}>
            {isExtracting && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/20 rounded-[2rem]">
                <Loader2 className="animate-spin text-violet-500" />
              </div>
            )}
            <div className="flex items-end gap-2">
              <label className="p-3 text-gray-500 hover:text-white cursor-pointer" title="Attach any file (extracted automatically)"><Paperclip size={20} /><input type="file" className="hidden" onChange={handleFileUpload} /></label>
              <textarea 
                className="w-full bg-transparent p-3 text-sm font-medium outline-none text-white placeholder-gray-600 resize-none max-h-32 min-h-[44px]" 
                rows="1" 
                placeholder="Synchronize (Paste files here)..." 
                value={input} 
                onChange={handleInputChange} 
                onPaste={handlePaste}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())} 
              />
              <div className="flex gap-2 p-1">
                <button onClick={toggleRecording} className={`p-3 rounded-xl ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/5 text-rose-400'}`}>{isProcessingStt ? <Loader2 size={20} className="animate-spin" /> : isRecording ? <MicOff size={20}/> : <Mic size={20} />}</button>
                <button 
                  onClick={handleSend} 
                  className={`p-3 rounded-xl transition-all flex items-center justify-center ${
                    loading 
                      ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-500/20' 
                      : 'bg-white text-black hover:bg-violet-600 hover:text-white'
                  }`}
                >
                  {loading ? <X size={20} /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Conversations;
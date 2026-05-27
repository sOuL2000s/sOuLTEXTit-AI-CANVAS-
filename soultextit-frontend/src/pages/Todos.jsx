import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash2, CheckCircle2, Circle, Wand2, Mic, MicOff, 
  Loader2, AlertCircle, Calendar, Tag, ChevronRight, Sparkles,
  Search, Filter, SortAsc, MoreVertical, X, Check, Pencil
} from 'lucide-react';
import { io } from 'socket.io-client';

const Todos = () => {
  const [todos, setTodos] = useState([]);
  const [input, setInput] = useState('');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingStt, setIsProcessingStt] = useState(false);
  const [user, setUser] = useState(null);
  const [models, setModels] = useState([]);
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const inputRef = useRef(null);

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
    };
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [todosRes, userRes, modelsRes] = await Promise.all([
        axiosAuth.get('/api/todos'),
        axiosAuth.get('/api/user/me'),
        axiosAuth.get('/api/models')
      ]);
      setTodos(todosRes.data);
      setUser(userRes.data);
      setModels(modelsRes.data);
    } catch (e) { console.error("Neural Fetch Failed"); }
    setLoading(false);
  };

  const initSocket = () => {
    const userData = JSON.parse(localStorage.getItem('user'));
    const socket = io(import.meta.env.VITE_API_URL, { query: { userId: userData?._id } });
    socketRef.current = socket;
    socket.on('transcription-result', (data) => {
      if (data.text) {
        // Show the spoken text in the input area instead of sending it directly
        const textToInsert = data.text.trim();
        setInput(textToInsert);
        // Shift focus to the input field so the user can immediately press Enter/Ctrl+Enter
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      setIsProcessingStt(false);
      setIsRecording(false);
    });
    socket.on('stt-error', () => {
      setIsProcessingStt(false);
      setIsRecording(false);
    });
  };

  const handleAiCommand = async (command) => {
    setAiLoading(true);
    try {
      const modelId = user?.preferences?.textModelId || models.find(m => m.category === 'text' && m.isDefault)?.modelId;
      await axiosAuth.post('/api/ai/todos', {
        prompt: command,
        currentTodos: todos.map(t => ({ id: t._id, text: t.text, completed: t.completed, priority: t.priority })),
        modelId
      });
      fetchData();
      setInput('');
    } catch (e) {
      alert("AI Command Failure: Neural link unstable.");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleTodo = async (todo) => {
    try {
      const updated = await axiosAuth.patch(`/api/todos/${todo._id}`, { completed: !todo.completed });
      setTodos(prev => prev.map(t => t._id === todo._id ? updated.data : t));
    } catch (e) { console.error("Toggle Failed"); }
  };

  const deleteTodo = async (id) => {
    try {
      await axiosAuth.delete(`/api/todos/${id}`);
      setTodos(prev => prev.filter(t => t._id !== id));
    } catch (e) { console.error("Purge Failed"); }
  };

  const startEditing = (todo) => {
    setEditingTodoId(todo._id);
    setEditingText(todo.text);
  };

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditingText('');
  };

  const handleUpdateTodo = async (id) => {
    if (!editingText.trim()) return;
    try {
      const res = await axiosAuth.patch(`/api/todos/${id}`, { text: editingText });
      setTodos(prev => prev.map(t => t._id === id ? res.data : t));
      setEditingTodoId(null);
      setEditingText('');
    } catch (e) {
      alert("Manual Update Failed");
    }
  };

  const addTodoManual = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!input.trim()) return;
    try {
      const res = await axiosAuth.post('/api/todos', { text: input });
      setTodos(prev => [res.data, ...prev]);
      setInput('');
    } catch (e) { console.error("Manual Entry Failed"); }
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
          const sttId = user?.preferences?.sttModelId || 
                        models.find(m => m.category === 'stt' && m.isDefault)?.modelId ||
                        models.find(m => m.category === 'stt')?.modelId;
          
          if (!sttId) {
            alert("Nexus Error: No STT model detected in current shard.");
            setIsRecording(false);
            return;
          }
          
          socketRef.current.emit('stop-recording', { modelId: sttId });
          setIsProcessingStt(true);
        };
        recorder.start(1000);
        setIsRecording(true);
      } catch (e) { alert("Mic Access Denied"); }
    }
  };

  const PriorityBadge = ({ level }) => {
    const colors = {
      high: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${colors[level] || colors.medium}`}>
        {level}
      </span>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h1 className="text-4xl md:text-6xl font-display font-black text-white tracking-tighter uppercase">Neural Tasks</h1>
          <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
            <Sparkles size={12} className="text-violet-500" /> Intent-Based Task Management
          </p>
        </motion.div>
        
        <div className="flex gap-4">
          <div className="glass-panel px-4 py-2 rounded-xl border-white/5 flex items-center gap-3">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active</div>
            <div className="text-xl font-display font-bold text-white">{todos.filter(t => !t.completed).length}</div>
          </div>
          <div className="glass-panel px-4 py-2 rounded-xl border-white/5 flex items-center gap-3">
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Completed</div>
            <div className="text-xl font-display font-bold text-emerald-500">{todos.filter(t => t.completed).length}</div>
          </div>
        </div>
      </header>

      {/* Input Section */}
      <div className="mb-12 sticky top-24 z-30">
        <div className="glass-panel p-2 rounded-[2rem] border-white/10 shadow-2xl flex items-center gap-2">
          <button 
            onClick={toggleRecording}
            className={`p-4 rounded-2xl transition-all ${isRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/5 text-gray-400 hover:text-white'}`}
          >
            {isProcessingStt ? <Loader2 className="animate-spin" size={20}/> : isRecording ? <MicOff size={20}/> : <Mic size={20}/>}
          </button>
          
          <div className="flex-1 flex items-center">
            <input 
              ref={inputRef}
              className="w-full bg-transparent px-4 py-2 text-sm font-medium text-white outline-none placeholder-gray-600"
              placeholder="Enter: AI Command | Ctrl+Enter: Manual Task"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (e.ctrlKey) {
                    addTodoManual(e);
                  } else {
                    handleAiCommand(input);
                  }
                }
              }}
            />
            <div className="flex gap-2 pr-2">
              <button 
                type="button"
                onClick={() => handleAiCommand(input)}
                disabled={aiLoading || !input.trim()}
                className="p-3 rounded-xl bg-violet-600 text-white hover:bg-violet-500 transition-all disabled:opacity-50"
                title="Process with AI Intent (Enter)"
              >
                {aiLoading ? <Loader2 className="animate-spin" size={18}/> : <Wand2 size={18}/>}
              </button>
              <button 
                type="button"
                onClick={addTodoManual}
                className="p-3 rounded-xl bg-white text-black hover:bg-emerald-500 hover:text-white transition-all"
                title="Create Task Manually (Ctrl+Enter)"
              >
                <Plus size={18}/>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        <AnimatePresence mode='popLayout'>
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4 opacity-50">
              <Loader2 className="animate-spin text-violet-500" size={32} />
              <p className="text-[10px] font-black uppercase tracking-widest">Synchronizing Shard...</p>
            </div>
          ) : todos.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]"
            >
              <CheckCircle2 className="mx-auto text-gray-800 mb-4" size={48} />
              <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No tasks found in this timeline</p>
            </motion.div>
          ) : (
            todos.map(todo => (
              <motion.div 
                layout
                key={todo._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`premium-card p-5 rounded-[1.5rem] flex items-center justify-between group ${todo.completed ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-5 min-w-0">
                  <button 
                    onClick={() => toggleTodo(todo)}
                    className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${todo.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-white/10 text-gray-600 hover:border-violet-500 hover:text-violet-500'}`}
                  >
                    {todo.completed ? <Check size={18} strokeWidth={3} /> : <Circle size={18} />}
                  </button>
                  
                  <div className="min-w-0 flex-1">
                    {editingTodoId === todo._id ? (
                      <div className="flex flex-col gap-2 w-full">
                        <input
                          className="w-full bg-white/10 border border-violet-500/50 p-2 rounded-xl text-sm text-white outline-none"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateTodo(todo._id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleUpdateTodo(todo._id)}
                            className="text-[8px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20"
                          >
                            Save
                          </button>
                          <button 
                            onClick={cancelEditing}
                            className="text-[8px] font-black uppercase tracking-widest px-3 py-1 bg-white/5 text-gray-400 rounded-lg border border-white/5"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className={`text-sm md:text-base font-medium break-words ${todo.completed ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                          {todo.text}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <PriorityBadge level={todo.priority} />
                          {todo.category && (
                            <span className="flex items-center gap-1.5 text-[9px] font-black text-gray-600 uppercase tracking-widest">
                              <Tag size={10} /> {todo.category}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!todo.completed && editingTodoId !== todo._id && (
                    <button 
                      onClick={() => startEditing(todo)}
                      className="p-3 text-gray-600 hover:text-violet-400 hover:bg-violet-500/10 rounded-xl transition-all"
                    >
                      <Pencil size={18}/>
                    </button>
                  )}
                  <button 
                    onClick={() => deleteTodo(todo._id)}
                    className="p-3 text-gray-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                  >
                    <Trash2 size={18}/>
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Footer Instructions */}
      <footer className="mt-20 p-8 glass-panel rounded-[2.5rem] border-white/5 text-center">
        <div className="inline-flex p-3 rounded-2xl bg-violet-500/10 text-violet-400 mb-6">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-display font-black text-white uppercase tracking-tighter mb-4">Neural Command Guide</h3>
        <p className="text-gray-500 text-xs leading-relaxed max-w-lg mx-auto">
          Try speaking or typing commands like:<br/>
          <span className="text-gray-400">"Add a high priority task to fix the code"</span> • <br/>
          <span className="text-gray-400">"Mark the grocery task as done"</span> • <br/>
          <span className="text-gray-400">"Remove all my completed tasks"</span>
        </p>
      </footer>
    </div>
  );
};

export default Todos;
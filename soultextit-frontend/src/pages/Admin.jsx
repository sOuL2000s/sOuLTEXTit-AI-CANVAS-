import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Cpu, Key, Activity, Plus, Trash2, Power, Globe, BarChart3, AlertTriangle, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('models');
  const [models, setModels] = useState([]);
  const [keys, setKeys] = useState([]);
  const [stats, setStats] = useState({ totalKeys: 0, activeModels: 0, totalRequests: 0, systemStatus: 'Initializing' });
  const [loading, setLoading] = useState(true);

  // Form States
  const [newModel, setNewModel] = useState({ modelId: '', displayName: '', provider: 'gemini', category: 'text' });
  const [newKey, setNewKey] = useState({ key: '', provider: 'gemini', label: '' });

  const api = axios.create({
    baseURL: 'http://localhost:5000/api/admin',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [mRes, kRes, sRes] = await Promise.all([api.get('/models'), api.get('/keys'), api.get('/stats')]);
      setModels(mRes.data);
      setKeys(kRes.data);
      setStats(sRes.data);
    } catch (e) { 
      console.error("Admin Access Revoked or Server Down"); 
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddModel = async (e) => {
    e.preventDefault();
    try {
      await api.post('/models', newModel);
      setNewModel({ modelId: '', displayName: '', provider: 'gemini', category: 'text' });
      fetchData();
    } catch (err) { alert(err.response?.data?.error || "Creation failed"); }
  };

  const handleAddKey = async (e) => {
    e.preventDefault();
    try {
      await api.post('/keys', newKey);
      setNewKey({ key: '', provider: 'gemini', label: '' });
      fetchData();
    } catch (err) { alert("Key registration failed"); }
  };

  const toggleModel = async (id) => {
    await api.patch(`/models/${id}/toggle`);
    fetchData();
  };

  const toggleKey = async (id) => {
    await api.patch(`/keys/${id}/toggle`);
    fetchData();
  };

  const deleteItem = async (type, id) => {
    if (!confirm('This action will disrupt current node pathways. Proceed?')) return;
    await api.delete(`/${type}/${id}`);
    fetchData();
  };

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="glass-panel p-6 rounded-2xl border-white/5 flex items-center gap-4">
      <div className={`p-3 rounded-xl bg-${color}-500/10 text-${color}-400`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">{label}</div>
        <div className="text-2xl font-display font-bold text-white">{value}</div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <header className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <h1 className="text-6xl font-display font-black text-white tracking-tighter uppercase">Nexus Central</h1>
          <p className="text-gray-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-2 flex items-center gap-2">
            <Activity size={12} className={stats.systemStatus === 'Optimal' ? "text-emerald-500" : "text-amber-500"} /> 
            System Status: {stats.systemStatus}
          </p>
        </motion.div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full md:w-auto">
          <StatCard icon={Cpu} label="Active Models" value={stats.activeModels} color="violet" />
          <StatCard icon={Key} label="Secure Nodes" value={stats.totalKeys} color="amber" />
          <StatCard icon={BarChart3} label="Total Throughput" value={stats.totalRequests} color="emerald" />
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-10 bg-white/5 p-1.5 rounded-2xl border border-white/10 w-fit relative overflow-hidden">
        {['models', 'keys', 'metrics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative px-10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all z-10 ${activeTab === tab ? 'text-black' : 'text-gray-400 hover:text-white'}`}
          >
            {tab}
            {activeTab === tab && (
              <motion.div 
                layoutId="activeTab"
                className="absolute inset-0 bg-white rounded-xl -z-10 shadow-xl shadow-white/10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'models' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} key="models">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Add Model Side-Form */}
              <div className="glass-panel p-8 rounded-3xl border-violet-500/20 h-fit sticky top-32 shadow-2xl">
                <h3 className="text-xl font-display font-bold text-white mb-8 flex items-center gap-3">
                  <Plus size={24} className="text-violet-500"/> Model Genesis
                </h3>
                <form onSubmit={handleAddModel} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Provider Nexus</label>
                    <select 
                      value={newModel.provider}
                      onChange={e => setNewModel({...newModel, provider: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-bold focus:border-violet-500 outline-none transition-all"
                    >
                      <option value="gemini" className="bg-slate-900">Google Gemini</option>
                      <option value="groq" className="bg-slate-900">Groq Neural</option>
                      <option value="openai" className="bg-slate-900">OpenAI (Legacy)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Model Category</label>
                    <select 
                      value={newModel.category}
                      onChange={e => setNewModel({...newModel, category: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-bold focus:border-violet-500 outline-none transition-all"
                    >
                      <option value="text" className="bg-slate-900">Text Generation</option>
                      <option value="stt" className="bg-slate-900">Speech to Text</option>
                      <option value="image" className="bg-slate-900">Image Generation</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">System Identifier</label>
                    <input 
                      placeholder="gemini-1.5-pro" 
                      value={newModel.modelId}
                      onChange={e => setNewModel({...newModel, modelId: e.target.value})}
                      required
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-mono focus:border-violet-500 outline-none transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest px-1">Display Label</label>
                    <input 
                      placeholder="Pro 1.5 Ultra" 
                      value={newModel.displayName}
                      onChange={e => setNewModel({...newModel, displayName: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-bold focus:border-violet-500 outline-none transition-all" 
                    />
                  </div>
                  <button type="submit" className="w-full bg-violet-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] mt-4 hover:bg-violet-500 transition-all shadow-lg shadow-violet-600/20 active:scale-95">
                    Deploy Logic Node
                  </button>
                </form>
              </div>

              {/* Models List - Enhanced Grid */}
              <div className="xl:col-span-2 space-y-4">
                {models.length === 0 ? (
                  <div className="glass-panel p-20 text-center rounded-3xl border-dashed border-white/10">
                    <Layers className="mx-auto text-gray-700 mb-4" size={48} />
                    <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">No models active in current shard</p>
                  </div>
                ) : models.map(model => (
                  <motion.div layout key={model._id} className="premium-card p-6 rounded-2xl flex items-center justify-between group">
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-pink-600/20 border border-white/5 flex items-center justify-center text-violet-400 font-display font-black text-xl shadow-inner">
                        {model.provider[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="text-white font-bold text-lg">{model.displayName || model.modelId}</h4>
                          {model.isActive ? 
                            <span className="bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-emerald-500/20">Operational</span> :
                            <span className="bg-rose-500/10 text-rose-400 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border border-rose-500/20">Offline</span>
                          }
                        </div>
                        <div className="flex gap-4 items-center">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">{model.provider} • {model.category}</span>
                          <span className="w-1 h-1 bg-gray-700 rounded-full" />
                          <span className="text-[10px] font-mono text-violet-500/60 font-bold">{model.modelId}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => toggleModel(model._id)}
                        className={`p-3 rounded-xl transition-all ${model.isActive ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                      >
                        <Power size={20}/>
                      </button>
                      <button 
                        onClick={() => deleteItem('models', model._id)}
                        className="p-3 text-gray-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                      >
                        <Trash2 size={20}/>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'keys' && (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} key="keys">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Add Key Panel */}
              <div className="lg:col-span-4 glass-panel p-8 rounded-3xl h-fit shadow-2xl">
                <h3 className="text-xl font-display font-bold text-white mb-8 flex items-center gap-3">
                  <Globe size={24} className="text-amber-500"/> Node Registration
                </h3>
                <form onSubmit={handleAddKey} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Network Provider</label>
                    <select 
                      value={newKey.provider}
                      onChange={e => setNewKey({...newKey, provider: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-bold focus:border-amber-500 outline-none transition-all"
                    >
                      <option value="gemini" className="bg-slate-900">Google Cloud AI</option>
                      <option value="groq" className="bg-slate-900">Groq Neural</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Node Secret (API Key)</label>
                    <input 
                      type="password"
                      placeholder="••••••••••••••••" 
                      value={newKey.key}
                      onChange={e => setNewKey({...newKey, key: e.target.value})}
                      required
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-mono focus:border-amber-500 outline-none transition-all" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Shard Label</label>
                    <input 
                      placeholder="Primary Production Node" 
                      value={newKey.label}
                      onChange={e => setNewKey({...newKey, label: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-bold focus:border-amber-500 outline-none transition-all" 
                    />
                  </div>
                  <button type="submit" className="w-full bg-amber-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] mt-4 hover:bg-amber-500 transition-all shadow-lg shadow-amber-600/20 active:scale-95">
                    Authorize Node
                  </button>
                </form>
              </div>

              {/* Keys Management Table */}
              <div className="lg:col-span-8 glass-panel rounded-3xl overflow-hidden border-white/5">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    <tr>
                      <th className="px-6 py-5">Node Identity</th>
                      <th className="px-6 py-5">Usage</th>
                      <th className="px-6 py-5">Integrity</th>
                      <th className="px-6 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {keys.map(k => (
                      <tr key={k._id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-5">
                          <div className="font-bold text-white mb-0.5">{k.label}</div>
                          <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{k.provider} • Node {k._id.slice(-4)}</div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="text-sm font-mono text-gray-300">{k.usageStats?.totalRequests || 0} calls</div>
                        </td>
                        <td className="px-6 py-5">
                          {k.usageStats?.errorCount > 10 ? 
                            <div className="flex items-center gap-2 text-rose-400 font-bold text-[10px] uppercase">
                              <AlertTriangle size={12}/> Critical Failures
                            </div> :
                            <div className="flex items-center gap-2 text-emerald-500 font-bold text-[10px] uppercase">
                              <Shield size={12}/> Stable
                            </div>
                          }
                        </td>
                        <td className="px-6 py-5 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => toggleKey(k._id)} className={`p-2 rounded-lg ${k.isActive ? 'text-emerald-400 bg-emerald-400/10' : 'text-gray-500 bg-white/5 hover:text-white'}`}>
                              <Power size={16}/>
                            </button>
                            <button onClick={() => deleteItem('keys', k._id)} className="p-2 text-gray-600 hover:text-rose-500 bg-white/5 hover:bg-rose-500/10 rounded-lg">
                              <Trash2 size={16}/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'metrics' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-panel p-8 rounded-3xl">
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4">Cache Hit Rate</h4>
                <div className="text-4xl font-display font-black text-white">92.4%</div>
                <div className="w-full bg-white/5 h-1 mt-6 rounded-full overflow-hidden">
                  <div className="bg-violet-500 h-full w-[92%]" />
                </div>
              </div>
              {/* More metric cards can go here */}
            </div>
            <div className="glass-panel p-12 rounded-[2.5rem] text-center border-dashed border-white/10">
              <BarChart3 className="mx-auto text-gray-800 mb-6" size={64} />
              <h3 className="text-2xl font-display font-bold text-gray-500 mb-2 uppercase tracking-tighter">Extended Analytics Offline</h3>
              <p className="text-gray-600 max-w-md mx-auto text-sm">Connect a Promethean data source or upgrade to the Enterprise Shard to unlock real-time neural throughput visualization.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;

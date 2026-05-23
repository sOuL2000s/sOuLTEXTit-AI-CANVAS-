import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { User, Cpu, Database, Check, Loader2, Shield } from 'lucide-react';

const Profile = ({ setUser }) => {
  const [profile, setProfile] = useState(null);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({ textModelId: '', sttModelId: '' });

  const axiosAuth = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [me, allModels] = await Promise.all([axiosAuth.get('/api/user/me'), axiosAuth.get('/api/models')]);
        setProfile(me.data);
        setModels(allModels.data);
        setPrefs(me.data.preferences || { textModelId: '', sttModelId: '' });
      } catch (e) { console.error("Access Revoked"); }
      setLoading(false);
    };
    fetchData();
  }, []);

  const savePrefs = async () => {
    setSaving(true);
    try {
      const res = await axiosAuth.patch('/api/user/preferences', prefs);
      const localUser = JSON.parse(localStorage.getItem('user'));
      localStorage.setItem('user', JSON.stringify({ ...localUser, preferences: res.data.preferences }));
      alert("Neural Preferences Harmonized.");
    } catch (e) { alert("Link Failed"); }
    setSaving(false);
  };

  if (loading) return <div className="h-[60vh] flex items-center justify-center"><Loader2 className="animate-spin text-violet-500" size={48} /></div>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      <div className="glass-panel p-8 md:p-12 rounded-[2.5rem] flex items-center gap-8 relative overflow-hidden">
        <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center text-white text-4xl font-display font-black shadow-2xl">{profile?.name?.[0]}</div>
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter">{profile?.name}</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-1">{profile?.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-panel p-8 rounded-3xl space-y-6">
          <h3 className="text-lg font-display font-black text-white uppercase tracking-tight flex items-center gap-3"><Cpu size={20} className="text-violet-500"/> Logic Preference</h3>
          <select value={prefs.textModelId} onChange={e => setPrefs({...prefs, textModelId: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-bold outline-none">
            <option value="" className="bg-slate-900">System Default</option>
            {models.filter(m => m.category === 'text' && m.isActive).map(m => <option key={m.modelId} value={m.modelId} className="bg-slate-900">{m.displayName || m.modelId}</option>)}
          </select>
        </div>

        <div className="glass-panel p-8 rounded-3xl space-y-6">
          <h3 className="text-lg font-display font-black text-white uppercase tracking-tight flex items-center gap-3"><Database size={20} className="text-pink-500"/> Audio Transcriber</h3>
          <select value={prefs.sttModelId} onChange={e => setPrefs({...prefs, sttModelId: e.target.value})} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-sm font-bold outline-none">
            <option value="" className="bg-slate-900">System Default</option>
            {models.filter(m => m.category === 'stt' && m.isActive).map(m => <option key={m.modelId} value={m.modelId} className="bg-slate-900">{m.displayName || m.modelId}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end p-6 bg-white/5 rounded-[2rem] border border-white/5">
        <button onClick={savePrefs} disabled={saving} className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-violet-600 hover:text-white transition-all flex items-center gap-2">{saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save Configuration</button>
      </div>
    </div>
  );
};

export default Profile;
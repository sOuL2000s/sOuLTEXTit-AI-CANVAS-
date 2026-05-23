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

  const PLAN_LIMITS = {
    free: { aiEdits: 10, sttMinutes: 30, canvases: 5, dialogues: 5 },
    creative: { aiEdits: 100, sttMinutes: 180, canvases: 50, dialogues: 25 },
    quantum: { aiEdits: 500, sttMinutes: 600, canvases: Infinity, dialogues: 100 },
    omnicore: { aiEdits: Infinity, sttMinutes: Infinity, canvases: Infinity, dialogues: Infinity }
  };

  const getDaysLeft = (expiry) => {
    if (!expiry) return 0;
    const diff = new Date(expiry) - new Date();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const UsageMeter = ({ label, current, max, color }) => {
    const percent = max === Infinity ? 0 : Math.min(100, (current / max) * 100);
    return (
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
          <span className="text-xs font-bold text-white">{current} / {max === Infinity ? '∞' : max}</span>
        </div>
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${max === Infinity ? 100 : percent}%` }}
            className={`h-full bg-${color}-500 shadow-[0_0_10px_rgba(var(--${color}-rgb),0.5)]`}
          />
        </div>
      </div>
    );
  };

  const daysLeft = getDaysLeft(profile?.subscription?.expiry);
  const currentPlan = profile?.subscription?.plan || 'free';
  const limits = PLAN_LIMITS[currentPlan];

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      {/* Header Profile Section */}
      <div className="glass-panel p-8 md:p-12 rounded-[3rem] flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none" />
        <div className="relative">
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-3xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center text-white text-4xl font-display font-black shadow-2xl relative z-10">
            {profile?.name?.[0]}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-8 h-8 rounded-xl border-4 border-[#02010a] flex items-center justify-center text-white z-20">
            <Shield size={14} />
          </div>
        </div>
        <div className="text-center md:text-left">
          <div className="flex flex-col md:flex-row items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tighter">{profile?.name}</h1>
            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${profile?.role === 'admin' ? 'bg-amber-500 text-black' : 'bg-violet-500 text-white'}`}>
              {profile?.role === 'admin' ? 'Nexus Overlord' : `${currentPlan.toUpperCase()} Shard`}
            </span>
          </div>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">{profile?.email}</p>
          {profile?.role !== 'admin' && (
            <div className="mt-4 flex items-center justify-center md:justify-start gap-2 text-amber-400">
               <span className="text-[10px] font-black uppercase tracking-[0.2em]">Shard Stability:</span>
               <span className="text-xs font-bold">{daysLeft} Cycles Remaining</span>
            </div>
          )}
        </div>
      </div>

      {/* Subscription & Usage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-panel p-8 md:p-10 rounded-[2.5rem] border-white/5 space-y-8">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-display font-black text-white uppercase tracking-tighter">Entitlement Metrics</h3>
            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Live Shard Analytics</div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <UsageMeter 
              label="Daily AI Transmutations" 
              current={profile?.usageStats?.aiEditsToday?.count || 0} 
              max={profile?.role === 'admin' ? Infinity : limits.aiEdits} 
              color="violet"
            />
            <UsageMeter 
              label="Voice Frequency (Mins/Mo)" 
              current={Math.round(profile?.usageStats?.sttMinutesThisMonth?.count || 0)} 
              max={profile?.role === 'admin' ? Infinity : limits.sttMinutes} 
              color="pink"
            />
            <UsageMeter 
              label="Active Manuscripts" 
              current={profile?.usageStats?.totalCanvases || 0} 
              max={profile?.role === 'admin' ? Infinity : limits.canvases} 
              color="emerald"
            />
            <UsageMeter 
              label="Dialogue Timelines" 
              current={profile?.usageStats?.totalDialogues || 0} 
              max={profile?.role === 'admin' ? Infinity : limits.dialogues} 
              color="blue"
            />
          </div>
          
          {profile?.role !== 'admin' && (
            <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <p className="text-xs text-gray-500 font-medium">Resetting in <span className="text-white">Next Cycle</span> (Midnight UTC)</p>
              <a href="/pricing" className="text-[10px] font-black uppercase tracking-widest text-violet-400 hover:text-white transition-colors">Expand Shard Capacity →</a>
            </div>
          )}
        </div>

        <div className="glass-panel p-8 rounded-[2.5rem] border-white/5 flex flex-col">
          <h3 className="text-lg font-display font-black text-white uppercase tracking-tighter mb-8">Shard Config</h3>
          <div className="space-y-6 flex-1">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Cpu size={14} className="text-violet-500"/> Logic Preference</label>
              <select 
                value={prefs.textModelId} 
                onChange={e => setPrefs({...prefs, textModelId: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-xs font-bold outline-none focus:border-violet-500 transition-colors"
              >
                <option value="" className="bg-slate-900">System Default</option>
                {models.filter(m => m.category === 'text' && m.isActive).map(m => <option key={m.modelId} value={m.modelId} className="bg-slate-900">{m.displayName || m.modelId}</option>)}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><Database size={14} className="text-pink-500"/> Audio Transcriber</label>
              <select 
                value={prefs.sttModelId} 
                onChange={e => setPrefs({...prefs, sttModelId: e.target.value})} 
                className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white text-xs font-bold outline-none focus:border-pink-500 transition-colors"
              >
                <option value="" className="bg-slate-900">System Default</option>
                {models.filter(m => m.category === 'stt' && m.isActive).map(m => <option key={m.modelId} value={m.modelId} className="bg-slate-900">{m.displayName || m.modelId}</option>)}
              </select>
            </div>
          </div>
          
          <button 
            onClick={savePrefs} 
            disabled={saving} 
            className="w-full mt-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-violet-600 hover:text-white transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/5"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Save Shard Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default Profile;
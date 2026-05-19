import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Admin = () => {
  const [keys, setKeys] = useState([]);
  const [formData, setFormData] = useState({ provider: 'gemini', key: '', type: 'text' });

  const fetchKeys = async () => {
    const res = await axios.get('http://localhost:5000/api/admin/keys', {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    setKeys(res.data);
  };

  const addKey = async () => {
    await axios.post('http://localhost:5000/api/admin/keys', formData, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    fetchKeys();
  };

  useEffect(() => { fetchKeys(); }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex justify-between items-end mb-12">
        <div>
          <h1 className="text-5xl font-display font-black text-white tracking-tighter">ORBITAL CONTROL</h1>
          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mt-2">Manage Neural Providers & API Access</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-display font-bold text-violet-500">{keys.length}</div>
          <div className="text-[10px] text-gray-600 font-black uppercase tracking-widest">Active Keys</div>
        </div>
      </div>

      <div className="glass-panel p-8 rounded-[2rem] mb-12 border-white/5">
        <h3 className="text-sm font-black uppercase tracking-widest mb-6 text-gray-400">Initialize New Provider</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select 
            onChange={e => setFormData({...formData, provider: e.target.value})} 
            className="bg-white/5 border border-white/10 p-4 rounded-xl text-white text-sm font-bold focus:border-violet-500 outline-none"
          >
            <option value="gemini" className="bg-slate-900">Gemini Neural</option>
            <option value="groq" className="bg-slate-900">Groq LPU</option>
          </select>
          <select 
            onChange={e => setFormData({...formData, type: e.target.value})} 
            className="bg-white/5 border border-white/10 p-4 rounded-xl text-white text-sm font-bold focus:border-violet-500 outline-none"
          >
            <option value="text">Generative Text</option>
            <option value="image">Latent Image</option>
            <option value="stt">Acoustic Logic</option>
          </select>
          <input 
            placeholder="Key Signature (API Key)" 
            className="md:col-span-2 bg-white/5 border border-white/10 p-4 rounded-xl text-white text-sm font-mono focus:border-violet-500 outline-none"
            onChange={e => setFormData({...formData, key: e.target.value})}
          />
        </div>
        <button 
          onClick={addKey} 
          className="mt-6 w-full bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-violet-600 hover:text-white transition-all transform active:scale-[0.98]"
        >
          Activate Provider Key
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {keys.map(k => (
          <div key={k._id} className="premium-card p-6 rounded-2xl flex justify-between items-center group">
            <div className="flex items-center gap-6">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-xs ${k.provider === 'gemini' ? 'bg-blue-500/20 text-blue-400' : 'bg-orange-500/20 text-orange-400'}`}>
                {k.provider.substring(0, 1).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold uppercase text-white tracking-wider">{k.provider}</span>
                  <span className="text-[10px] text-gray-500 font-bold px-2 py-0.5 rounded-full border border-white/10">{k.type}</span>
                </div>
                <p className="text-gray-500 font-mono text-xs mt-1">••••••••••••{k.key.slice(-8)}</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className={`text-[10px] font-black uppercase tracking-widest ${k.isActive ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {k.isActive ? 'Online' : 'Offline'}
                </div>
              </div>
              <button 
                onClick={async () => {
                  await axios.delete(`http://localhost:5000/api/admin/keys/${k._id}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                  });
                  fetchKeys();
                }}
                className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Admin;

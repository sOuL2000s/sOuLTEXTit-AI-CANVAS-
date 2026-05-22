import React, { useState } from 'react';
import axios from 'axios';
import { GoogleLogin } from '@react-oauth/google';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const Auth = ({ setUser }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const endpoint = isLogin ? 'login' : 'signup';
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/${endpoint}`, form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setUser(res.data.user);
    } catch (err) { alert(err.response?.data?.error || "Access Denied"); }
  };

  const onGoogleSuccess = async (response) => {
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/google`, { credential: response.credential });
      if (res.data?.token && res.data?.user) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
      } else {
        throw new Error("Malformed Neural Data Received");
      }
    } catch (err) { 
      console.error("Auth Shard Error:", err);
      alert("Nexus Link Failed: Ensure Brave Shields are not blocking Google Identity scripts."); 
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-panel p-10 rounded-3xl w-full max-w-md relative ai-glow"
      >
        <div className="text-center mb-10">
          <h2 className="text-4xl font-display font-extrabold mb-2 tracking-tighter text-white">
            {isLogin ? 'IDENTITY AUTH' : 'GENESIS'}
          </h2>
          <p className="text-gray-400 text-sm font-medium uppercase tracking-[0.2em]">Step into the soul of AI</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {!isLogin && (
            <input 
              className="bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-violet-500 text-white transition-all" 
              placeholder="Full Entity Name" 
              onChange={e => setForm({...form, name: e.target.value})} 
            />
          )}
          <input 
            className="bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-violet-500 text-white transition-all" 
            placeholder="Digital Mail (Email)" 
            onChange={e => setForm({...form, email: e.target.value})} 
          />
          <div className="relative">
            <input 
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-violet-500 text-white transition-all pr-12" 
              type={showPassword ? "text" : "password"} 
              placeholder="Cipher (Password)" 
              onChange={e => setForm({...form, password: e.target.value})} 
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <button className="bg-white text-black font-black p-4 rounded-xl hover:bg-violet-500 hover:text-white transition-all transform active:scale-95 shadow-xl shadow-white/5 uppercase tracking-widest">
            {isLogin ? 'Sign In' : 'Create Avatar'}
          </button>
        </form>

        <div className="my-8 flex items-center gap-4 text-gray-600">
          <div className="h-[1px] flex-1 bg-white/10" />
          <span className="text-[10px] font-bold">OR LINK THROUGH</span>
          <div className="h-[1px] flex-1 bg-white/10" />
        </div>

        <div className="flex justify-center mb-8">
          <GoogleLogin onSuccess={onGoogleSuccess} theme="filled_black" shape="pill" />
        </div>

        <p className="text-center text-sm text-gray-500">
          {isLogin ? "New to the nexus?" : "Already part of the network?"} 
          <button onClick={() => setIsLogin(!isLogin)} className="text-violet-400 ml-2 font-bold hover:underline">
            {isLogin ? 'Initialize' : 'Reconnect'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

export default Auth;
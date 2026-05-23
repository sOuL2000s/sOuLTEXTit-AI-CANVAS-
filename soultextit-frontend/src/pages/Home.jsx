import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Layout, Zap, Shield, Type, Mic, FileText, Globe } from 'lucide-react';

const FeatureCard = ({ icon: Icon, title, desc }) => (
  <div className="premium-card p-8 rounded-[2rem] border-white/5 bg-white/[0.02]">
    <div className="w-12 h-12 rounded-2xl bg-violet-600/10 flex items-center justify-center text-violet-400 mb-6">
      <Icon size={24} />
    </div>
    <h3 className="text-xl font-display font-bold text-white mb-3 tracking-tight">{title}</h3>
    <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
  </div>
);

const Home = () => {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="pt-20 pb-32 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8">
            <Zap size={12} /> Version 1.0 Shard Now Live
          </div>
          <h1 className="text-6xl md:text-8xl font-display font-black text-white tracking-tighter uppercase mb-8">
            The Neural <br /> <span className="text-violet-500">Workspace</span>
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
            sOuLTEXTit is a premium, AI-powered environment for writers, coders, and creators who demand absolute synergy between thought and text.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <NavLink to="/auth" className="w-full sm:w-auto px-10 py-5 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-violet-600 hover:text-white transition-all shadow-2xl shadow-white/5">
              Initialize Nexus
            </NavLink>
            <NavLink to="/about" className="w-full sm:w-auto px-10 py-5 bg-white/5 text-white border border-white/10 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-white/10 transition-all">
              The Protocol
            </NavLink>
          </div>
        </motion.div>
      </section>

      {/* Core Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-40">
        <FeatureCard 
          icon={Layout} 
          title="Neural Canvas" 
          desc="A distraction-free Tiptap editor with integrated KaTeX math rendering and markdown mastery."
        />
        <FeatureCard 
          icon={Sparkles} 
          title="Contextual AI" 
          desc="Ask, edit, or transform. Our AI understands your document context for surgical text modifications."
        />
        <FeatureCard 
          icon={Mic} 
          title="Voice Command" 
          desc="Hands-free creation via state-of-the-art Speech-to-Text models. Dictate your narrative in real-time."
        />
      </section>

      {/* Why Section */}
      <section className="glass-panel p-12 md:p-20 rounded-[3rem] border-white/5 mb-40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-violet-600/10 blur-[100px] rounded-full -mr-48 -mt-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-8">
              Why use <span className="text-violet-500">sOuLTEXTit?</span>
            </h2>
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400"><Shield size={20}/></div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-2">Privacy First</h4>
                  <p className="text-gray-500 text-sm">Your manuscripts and dialogues are stored in your personal neural shard, encrypted and accessible only by you.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400"><Globe size={20}/></div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-2">Unified Export</h4>
                  <p className="text-gray-500 text-sm">Download your work as high-quality PDF, Word, or Markdown with professional styling built-in.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center text-pink-400"><Zap size={20}/></div>
                <div>
                  <h4 className="text-white font-bold text-lg mb-2">Multi-Model Failover</h4>
                  <p className="text-gray-500 text-sm">Our system automatically rotates between API keys and models to ensure zero downtime for your creative flow.</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative">
             <div className="aspect-square bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center p-12 overflow-hidden group">
                <div className="text-[200px] font-black text-white opacity-[0.03] group-hover:scale-110 transition-transform duration-700">SOUL</div>
                <div className="absolute inset-12 border border-white/5 rounded-2xl flex items-center justify-center">
                   <Sparkles size={80} className="text-violet-500/40" />
                </div>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
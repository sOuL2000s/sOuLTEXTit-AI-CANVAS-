import React from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Shield, Crown, Globe, Sparkles } from 'lucide-react';

const PlanCard = ({ title, price, subtitle, features, icon: Icon, color, recommended }) => (
  <motion.div 
    whileHover={{ y: -10 }}
    className={`glass-panel p-8 rounded-[2.5rem] flex flex-col relative overflow-hidden transition-all duration-500 ${recommended ? 'border-violet-500 bg-violet-500/5 shadow-[0_0_50px_rgba(139,92,246,0.1)]' : 'border-white/5'}`}
  >
    {recommended && (
      <div className="absolute top-6 right-6 px-3 py-1 bg-violet-500 rounded-full text-[8px] font-black uppercase tracking-widest text-white">
        Recommended
      </div>
    )}
    
    <div className={`w-14 h-14 rounded-2xl bg-${color}-500/10 flex items-center justify-center text-${color}-400 mb-8`}>
      <Icon size={28} />
    </div>

    <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter mb-1">{title}</h3>
    <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-6">{subtitle}</p>

    <div className="flex items-baseline gap-1 mb-8">
      <span className="text-4xl font-display font-black text-white">${price}</span>
      <span className="text-gray-600 text-sm font-bold uppercase tracking-widest">/mo</span>
    </div>

    <div className="space-y-4 flex-1 mb-10">
      {features.map((f, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`shrink-0 w-5 h-5 rounded-full bg-${color}-500/10 flex items-center justify-center text-${color}-400`}>
            <Check size={12} />
          </div>
          <span className="text-gray-400 text-sm font-medium">{f}</span>
        </div>
      ))}
    </div>

    <button className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 ${recommended ? 'bg-white text-black hover:bg-violet-500 hover:text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}>
      Initialize Shard
    </button>
  </motion.div>
);

const Pricing = () => {
  return (
    <div className="max-w-7xl mx-auto px-6 py-20">
      <div className="text-center mb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6">
            <Sparkles size={12} /> Network Capacity
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-black text-white uppercase tracking-tighter mb-6">
            Choose Your <span className="text-violet-500">Shard</span>
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto font-medium">
            Scale your creative throughput with our distributed neural network. Dedicated resources for professional digital alchemists.
          </p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
        <PlanCard 
          title="Community"
          price="0"
          subtitle="Open Source Access"
          color="blue"
          icon={Globe}
          features={[
            "Standard Neural Throughput",
            "5 Active Canvases",
            "Basic Markdown Exports",
            "Community STT Models",
            "24h Session Memory"
          ]}
        />
        <PlanCard 
          title="Professional"
          price="19"
          subtitle="The Creator's Choice"
          color="violet"
          icon={Zap}
          recommended={true}
          features={[
            "Prioritized Logic Nodes",
            "Unlimited Canvases",
            "Advanced PDF/Word Exports",
            "Full STT Pipeline Access",
            "Neural Chat History Archive",
            "Custom Logic Preferences"
          ]}
        />
        <PlanCard 
          title="Enterprise"
          price="49"
          subtitle="Corporate Shard"
          color="amber"
          icon={Crown}
          features={[
            "Dedicated Shard Environment",
            "Custom Model Fine-tuning",
            "Admin Nexus Dashboard",
            "Team Collaboration Sync",
            "API Access for Developers",
            "White-label PDF Branding"
          ]}
        />
      </div>

      <div className="glass-panel p-10 md:p-16 rounded-[3rem] border-white/5 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-violet-600/5 blur-[100px] pointer-events-none" />
        <Shield className="mx-auto text-violet-500 mb-6" size={48} />
        <h2 className="text-3xl font-display font-black text-white uppercase tracking-tighter mb-4">Integrity Guaranteed</h2>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm leading-relaxed mb-8">
          All plans include end-to-end encryption for your manuscripts. We utilize a rotation of Google Gemini and Groq nodes to ensure 99.9% uptime for your creative workflow.
        </p>
        <div className="flex flex-wrap justify-center gap-8 opacity-40 grayscale hover:grayscale-0 transition-all duration-500">
           <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Google Cloud AI</div>
           <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Groq Neural</div>
           <div className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Tiptap Core</div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
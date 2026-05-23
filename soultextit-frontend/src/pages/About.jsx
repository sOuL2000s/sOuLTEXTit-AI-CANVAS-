import React from 'react';
import { motion } from 'framer-motion';
import { Cpu, Users, Zap, ShieldCheck } from 'lucide-react';

const About = () => {
  return (
    <div className="max-w-4xl mx-auto py-20 px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-5xl font-display font-black text-white uppercase tracking-tighter mb-6">About the <span className="text-violet-500">Core</span></h1>
        <p className="text-gray-400 text-xl font-medium leading-relaxed mb-12">
          sOuLTEXTit is not just an editor. It is a digital sanctuary for creators who seek to augment their creative capabilities through the power of Artificial Intelligence.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
          <div className="space-y-4">
            <div className="text-violet-400"><Cpu size={32}/></div>
            <h3 className="text-white font-bold text-xl uppercase">The Neural Engine</h3>
            <p className="text-gray-500 text-sm leading-relaxed">Our backend leverages a distributed network of LLMs, including Gemini and Groq, to provide ultra-fast response times and high-quality creative output.</p>
          </div>
          <div className="space-y-4">
            <div className="text-pink-400"><Users size={32}/></div>
            <h3 className="text-white font-bold text-xl uppercase">Our Mission</h3>
            <p className="text-gray-500 text-sm leading-relaxed">To democratize access to elite creative tools. We believe that everyone should have a professional-grade editor that acts as a partner in their thought process.</p>
          </div>
        </div>

        <div className="glass-panel p-10 rounded-3xl border-white/5">
          <h2 className="text-2xl font-display font-bold text-white mb-6 uppercase">The Philosophy</h2>
          <p className="text-gray-500 leading-relaxed mb-6">
            In an era of information overload, clarity is the ultimate luxury. sOuLTEXTit was designed with the principle of "Invisible Complexity" – providing powerful tools that stay out of your way until you need them.
          </p>
          <div className="flex items-center gap-4 text-emerald-500">
            <ShieldCheck size={20} />
            <span className="text-xs font-black uppercase tracking-widest">Integrity Driven Protocol</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default About;
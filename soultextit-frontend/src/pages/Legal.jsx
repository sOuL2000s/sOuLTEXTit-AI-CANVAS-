import React from 'react';
import { motion } from 'framer-motion';

const Legal = ({ type }) => {
  const content = {
    privacy: {
      title: "Privacy Policy",
      updated: "October 2023",
      sections: [
        {
          h: "Data Collection",
          p: "We collect minimal metadata required for session persistence and AI context. Your manuscripts are encrypted and stored within our secure MongoDB infrastructure."
        },
        {
          h: "AI Processing",
          p: "When using AI features, text fragments are sent to our model providers (Google, Groq). This data is processed in real-time and is not used for model training by sOuLTEXTit."
        },
        {
          h: "Third Party Links",
          p: "Our service utilizes Google OAuth for identity management. Please refer to Google's privacy policy for identity data handling."
        }
      ]
    },
    terms: {
      title: "Terms and Conditions",
      updated: "October 2023",
      sections: [
        {
          h: "Usage Rights",
          p: "All content generated within sOuLTEXTit belongs entirely to the user. We claim no ownership over your manuscripts or creative output."
        },
        {
          h: "Prohibited Acts",
          p: "Users may not utilize the neural core for illegal activities, automated spam generation, or malicious code injection."
        },
        {
          h: "Liability",
          p: "sOuLTEXTit provides tools 'as-is'. We are not responsible for data loss due to model hallucinations or network interruptions."
        }
      ]
    }
  };

  const active = content[type];

  return (
    <div className="max-w-3xl mx-auto py-20 px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-4xl font-display font-black text-white uppercase tracking-tighter mb-2">{active.title}</h1>
        <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-12">Last Updated: {active.updated}</p>
        
        <div className="space-y-12">
          {active.sections.map((s, i) => (
            <div key={i}>
              <h3 className="text-white font-bold text-lg mb-4 uppercase tracking-tight">{s.h}</h3>
              <p className="text-gray-500 leading-relaxed">{s.p}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default Legal;
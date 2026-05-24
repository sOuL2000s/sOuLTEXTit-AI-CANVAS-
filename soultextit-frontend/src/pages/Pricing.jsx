import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Shield, Crown, Globe, Sparkles, Loader2 } from 'lucide-react';
import axios from 'axios';

const PLANS = [
  {
    id: 'free',
    title: "Neural Initiate",
    icon: Globe,
    color: "blue",
    features: ["10 AI Edits / Day", "5 Manuscripts", "5 Dialogue Timelines", "30m Voice Typing", "Watermarked Exports"],
    durations: [
      { id: 'monthly', label: 'Free Forever', monthlyPrice: 0, months: 1, discount: 0, recommended: false },
    ]
  },
  {
    id: 'creative',
    title: "Creative Shard",
    subtitle: "For Creators",
    icon: Zap,
    color: "violet",
    features: ["100 AI Edits / Day", "50 Manuscripts", "25 Dialogue Timelines", "180m Voice Typing", "No Watermarks"],
    durations: [
      { id: 'monthly', label: 'Monthly', monthlyPrice: 2.99, months: 1, discount: 0, recommended: false },
      { id: 'quarterly', label: 'Quarterly', monthlyPrice: 2.99, months: 3, discount: 10, recommended: false },
      { id: 'biannual', label: '6-Monthly', monthlyPrice: 2.99, months: 6, discount: 15, recommended: false },
      { id: 'annual', label: 'Yearly', monthlyPrice: 2.99, months: 12, discount: 20, recommended: true }
    ]
  },
  {
    id: 'quantum',
    title: "Quantum Nexus",
    subtitle: "Pro Performance",
    icon: Sparkles,
    color: "pink",
    features: ["500 AI Edits / Day", "Unlimited Manuscripts", "100 Dialogue Timelines", "600m Voice Typing", "Custom Branding"],
    durations: [
      { id: 'monthly', label: 'Monthly', monthlyPrice: 5.99, months: 1, discount: 0, recommended: false },
      { id: 'quarterly', label: 'Quarterly', monthlyPrice: 5.99, months: 3, discount: 10, recommended: false },
      { id: 'biannual', label: '6-Monthly', monthlyPrice: 5.99, months: 6, discount: 15, recommended: false },
      { id: 'annual', label: 'Yearly', monthlyPrice: 5.99, months: 12, discount: 20, recommended: true }
    ]
  },
  {
    id: 'omnicore',
    title: "OmniCore",
    subtitle: "The Ultimate Shard",
    icon: Crown,
    color: "amber",
    features: ["Unlimited AI Edits", "Unlimited Manuscripts", "Unlimited Dialogues", "Unlimited Voice Typing", "24/7 VIP Shard"],
    durations: [
      { id: 'monthly', label: 'Monthly', monthlyPrice: 10.99, months: 1, discount: 0, recommended: false },
      { id: 'quarterly', label: 'Quarterly', monthlyPrice: 10.99, months: 3, discount: 10, recommended: false },
      { id: 'biannual', label: '6-Monthly', monthlyPrice: 10.99, months: 6, discount: 15, recommended: false },
      { id: 'annual', label: 'Yearly', monthlyPrice: 10.99, months: 12, discount: 20, recommended: true }
    ]
  }
];

const Pricing = () => {
  const [currency, setCurrency] = useState({ code: 'USD', symbol: '$', rate: 1 });
  const [loading, setLoading] = useState(null);
  const [selectedDurations, setSelectedDurations] = useState(
    PLANS.reduce((acc, plan) => {
      const defaultDuration = plan.durations.find(d => d.recommended)?.id || 'monthly';
      return { ...acc, [plan.id]: defaultDuration };
    }, {})
  );

  useEffect(() => {
    const detectCurrency = async () => {
      try {
        // Step 1: Detect User Location and Local Currency
        const geo = await axios.get('https://ipapi.co/json/');
        const localCurrencyCode = geo.data.currency || 'USD';

        if (localCurrencyCode !== 'USD') {
          // Step 2: Synchronize with Live Market Exchange Rates (Base USD)
          // Using open.er-api.com for real-time market data synchronization
          const rateRes = await axios.get(`https://open.er-api.com/v6/latest/USD`);
          const marketRate = rateRes.data.rates[localCurrencyCode];
          
          if (marketRate) {
            const symbols = { 
              'INR': '₹', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 
              'CAD': 'C$', 'AUD': 'A$', 'CNY': '¥' 
            };
            
            setCurrency({ 
              code: localCurrencyCode, 
              symbol: symbols[localCurrencyCode] || (localCurrencyCode + ' '), 
              rate: marketRate 
            });
          }
        }
      } catch (e) { 
        console.error("Neural Currency Sync Failed: Reverting to USD Standard", e); 
      }
    };
    detectCurrency();
    
    // Load Razorpay script
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const handlePurchase = async (planId, durationId) => {
    const plan = PLANS.find(p => p.id === planId);
    const duration = plan.durations.find(d => d.id === durationId);

    if (!plan || !duration || duration.monthlyPrice === 0) return;
    
    const rawTotalPrice = duration.monthlyPrice * duration.months;
    const discountedPrice = rawTotalPrice * (1 - (duration.discount / 100));
    const finalAmount = Math.round(discountedPrice * currency.rate * 100) / 100;

    setLoading(planId);
    const token = localStorage.getItem('token');
    
    try {
      const orderRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/payments/create-order`, 
        { amount: finalAmount, currency: currency.code },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount: orderRes.data.amount,
        currency: orderRes.data.currency,
        name: "sOuLTEXTit",
        description: `Upgrade to ${plan.title} (${duration.label})`,
        order_id: orderRes.data.id,
        handler: async (response) => {
          const verifyRes = await axios.post(`${import.meta.env.VITE_API_URL}/api/payments/verify`, {
            ...response,
            plan: planId,
            duration: durationId
          }, { headers: { Authorization: `Bearer ${token}` }});
          
          if (verifyRes.data.success) {
            alert("Subscription Activated!");
            window.location.reload();
          } else {
            alert(verifyRes.data.error || "Payment verification failed.");
          }
        },
        theme: { color: "#8b5cf6" }
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (e) { 
      console.error("Payment Initialization Failed:", e);
      alert("Payment Initialization Failed."); 
    }
    setLoading(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-20">
      <div className="text-center mb-20">
        <h1 className="text-5xl md:text-7xl font-display font-black text-white uppercase tracking-tighter mb-6">
          Neural <span className="text-violet-500">Subscription</span>
        </h1>
        <p className="text-gray-500 mb-2">Detected Currency: {currency.code}</p>
        <p className="text-gray-500 max-w-xl mx-auto font-medium">
          Scale your creative throughput with our distributed neural network. Dedicated resources for professional digital alchemists.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-24">
        {PLANS.map((plan) => {
          const currentDurationId = selectedDurations[plan.id] || 'monthly';
          const currentDuration = plan.durations.find(d => d.id === currentDurationId);
          
          const rawTotalPrice = currentDuration.monthlyPrice * currentDuration.months;
          const discountedTotalPrice = rawTotalPrice * (1 - (currentDuration.discount / 100));
          const priceDisplay = Math.round(discountedTotalPrice * currency.rate);
          const monthlyEquivalent = Math.round((discountedTotalPrice / currentDuration.months) * currency.rate);

          return (
            <motion.div 
              whileHover={{ y: -10 }}
              key={plan.id} 
              className={`glass-panel p-8 rounded-[2.5rem] flex flex-col relative overflow-hidden transition-all duration-500 ${currentDuration.recommended ? 'border-violet-500 bg-violet-500/5 shadow-[0_0_50px_rgba(139,92,246,0.1)]' : 'border-white/5'}`}
            >
              {currentDuration.recommended && (
                <div className="absolute top-6 right-6 px-3 py-1 bg-violet-500 rounded-full text-[8px] font-black uppercase tracking-widest text-white">
                  Recommended
                </div>
              )}
              <div className={`w-14 h-14 rounded-2xl bg-${plan.color}-500/10 flex items-center justify-center text-${plan.color}-400 mb-8`}>
                <plan.icon size={28} />
              </div>
              <h3 className="text-2xl font-display font-black text-white uppercase tracking-tighter mb-1">{plan.title}</h3>
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-6">{currentDuration.label} Plan</p>
              
              {currentDuration.discount > 0 && plan.id !== 'free' && (
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-gray-600 line-through">{currency.symbol}{Math.round(rawTotalPrice * currency.rate)}</span>
                  <span className={`text-emerald-500 text-[10px] font-black uppercase tracking-widest`}>
                    {currentDuration.discount}% Off
                  </span>
                </div>
              )}

              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-display font-black text-white">{currency.symbol}{priceDisplay}</span>
                <span className="text-gray-600 text-sm font-bold uppercase tracking-widest">/{currentDuration.months === 1 ? 'mo' : `${currentDuration.months}mo`}</span>
              </div>
              
              {plan.id !== 'free' && currentDuration.months > 1 && (
                <p className="text-[10px] font-bold text-gray-500 mb-6 -mt-4">
                  (Equivalent to {currency.symbol}{monthlyEquivalent}/month)
                </p>
              )}

              {plan.id !== 'free' && (
                <div className="flex flex-wrap gap-2 mb-8 -mt-2">
                  {plan.durations.map(durationOpt => (
                    <button
                      key={durationOpt.id}
                      onClick={() => setSelectedDurations(prev => ({ ...prev, [plan.id]: durationOpt.id }))}
                      className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                        selectedDurations[plan.id] === durationOpt.id
                          ? `bg-${plan.color}-500 text-white`
                          : 'bg-white/5 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {durationOpt.label}
                    </button>
                  ))}
                </div>
              )}

              <ul className="flex-1 space-y-4 mb-10">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-3">
                    <div className={`shrink-0 w-5 h-5 rounded-full bg-${plan.color}-500/10 flex items-center justify-center text-${plan.color}-400`}>
                      <Check size={12} />
                    </div>
                    <span className="text-gray-400 text-sm font-medium">{f}</span>
                  </li>
                ))}
              </ul>
              <button 
                onClick={() => handlePurchase(plan.id, currentDuration.id)}
                disabled={loading === plan.id || plan.id === 'free'}
                className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 ${currentDuration.recommended ? 'bg-white text-black hover:bg-violet-500 hover:text-white' : 'bg-white/5 text-white hover:bg-white/10'}`}
              >
                {loading === plan.id ? <Loader2 className="animate-spin mx-auto" size={16}/> : plan.id === 'free' ? "Default Shard" : "Initialize Shard"}
              </button>
            </motion.div>
          );
        })}
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
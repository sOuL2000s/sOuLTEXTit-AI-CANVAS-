import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import Editor from './components/Editor';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import Conversations from './pages/Conversations';
import Todos from './pages/Todos';
import Profile from './pages/Profile';
import Home from './pages/Home';
import About from './pages/About';
import Pricing from './pages/Pricing';
import Legal from './pages/Legal';
import './App.css';

import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Layout, Shield, LogOut, Sparkles, User, Settings, Ghost, HelpCircle, Check } from 'lucide-react';
import axios from 'axios';

const ServerBootGame = () => {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [target, setTarget] = useState({ x: 80, y: 20 });
  const [glitch, setGlitch] = useState({ x: 20, y: 80 });
  const [particles, setParticles] = useState([]);
  const containerRef = useRef(null);

  const spawnPoint = () => ({ x: Math.random() * 70 + 15, y: Math.random() * 70 + 15 });

  useEffect(() => {
    const handleMove = (clientX, clientY) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 100;
      const y = ((clientY - rect.top) / rect.height) * 100;
      setPos({ 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    };

    const onMouseMove = (e) => handleMove(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (e.cancelable) e.preventDefault();
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    
    const glitchInterval = setInterval(() => {
      setGlitch(spawnPoint());
    }, 1800);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      clearInterval(glitchInterval);
    };
  }, []);

  useEffect(() => {
    const distTarget = Math.sqrt(Math.pow(pos.x - target.x, 2) + Math.pow(pos.y - target.y, 2));
    if (distTarget < 7) {
      setScore(s => {
        const newScore = s + 1;
        if (newScore > highScore) setHighScore(newScore);
        return newScore;
      });
      
      const newParticles = Array.from({ length: 6 }).map((_, i) => ({
        id: Math.random(),
        x: target.x,
        y: target.y,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15
      }));
      setParticles(prev => [...prev, ...newParticles].slice(-15));
      setTarget(spawnPoint());
    }

    const distGlitch = Math.sqrt(Math.pow(pos.x - glitch.x, 2) + Math.pow(pos.y - glitch.y, 2));
    if (distGlitch < 6) {
      if (score > 0) {
        setScore(0);
        setGlitch(spawnPoint());
      }
    }
  }, [pos, target, glitch, highScore, score]);

  useEffect(() => {
    if (particles.length === 0) return;
    const timer = setTimeout(() => setParticles([]), 1000);
    return () => clearTimeout(timer);
  }, [particles]);

  return (
    <div className="fixed inset-0 z-[200] bg-[#02010a] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-20">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.1),transparent_70%)]" />
      </div>

      <div className="max-w-md w-full relative z-10">
        <motion.div 
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: 360 
          }} 
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-16 h-16 border-t-2 border-r-2 border-violet-500 rounded-full mx-auto mb-6 shadow-[0_0_40px_rgba(139,92,246,0.2)]"
        />
        
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-black text-white mb-1 uppercase tracking-tighter">Waking the Neural Core</h2>
          <div className="flex items-center justify-center gap-3">
            <span className="w-12 h-[1px] bg-gradient-to-r from-transparent to-violet-500" />
            <p className="text-violet-400 text-[10px] font-black uppercase tracking-[0.4em] animate-pulse">Synchronizing</p>
            <span className="w-12 h-[1px] bg-gradient-to-l from-transparent to-violet-500" />
          </div>
        </div>
        
        <div 
          ref={containerRef}
          className="relative w-full aspect-square bg-white/[0.02] rounded-[2rem] border border-white/10 overflow-hidden mb-6 cursor-none group active:scale-[0.98] transition-transform duration-500 shadow-2xl"
        >
          {/* Grid lines */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

          <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20 pointer-events-none">
            <div className="flex flex-col items-start">
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Current Sync</span>
              <span className="text-xl font-display font-black text-white leading-none">{score}</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest mb-1">Peak Core</span>
              <span className="text-xl font-display font-black text-violet-400 leading-none">{highScore}</span>
            </div>
          </div>

          {/* Particles */}
          {particles.map((p, i) => (
            <motion.div
              key={i}
              initial={{ left: `${p.x}%`, top: `${p.y}%`, opacity: 1, scale: 1 }}
              animate={{ left: `${p.x + p.vx}%`, top: `${p.y + p.vy}%`, opacity: 0, scale: 0 }}
              className="absolute w-1 h-1 bg-violet-400 rounded-full pointer-events-none z-10"
            />
          ))}

          {/* Player Sparkle */}
          <motion.div 
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-white z-30 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]"
          >
            <div className="relative">
              <Sparkles size={28} />
              <motion.div 
                animate={{ scale: [1, 2], opacity: [0.5, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute inset-0 bg-white rounded-full blur-md"
              />
            </div>
          </motion.div>

          {/* Target Orb */}
          <motion.div 
            animate={{ 
              left: `${target.x}%`, 
              top: `${target.y}%`,
              scale: [1, 1.4, 1],
            }}
            transition={{ 
              left: { type: "spring", stiffness: 80, damping: 15 }, 
              top: { type: "spring", stiffness: 80, damping: 15 },
              scale: { repeat: Infinity, duration: 1.5 }
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
          >
            <div className="relative">
              <div className="w-5 h-5 bg-violet-500 rounded-full border-2 border-white shadow-[0_0_20px_rgba(139,92,246,0.8)]" />
              <motion.div 
                animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="absolute inset-0 bg-violet-500 rounded-full"
              />
            </div>
          </motion.div>

          {/* Glitch Node */}
          <motion.div 
            animate={{ 
              left: `${glitch.x}%`, 
              top: `${glitch.y}%`,
              rotate: [0, 10, -10, 0],
            }}
            transition={{ 
              left: { type: "spring", stiffness: 40, damping: 20 },
              top: { type: "spring", stiffness: 40, damping: 20 },
              rotate: { repeat: Infinity, duration: 0.5 }
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 text-rose-500 z-20"
          >
            <div className="relative">
              <Ghost size={28} className="drop-shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
              <div className="absolute inset-0 bg-rose-500/20 blur-xl rounded-full" />
            </div>
          </motion.div>

          <div className="absolute bottom-6 inset-x-0 text-[9px] font-black text-gray-600 uppercase tracking-[0.2em] pointer-events-none">
            Collect Synapses • Avoid Neural Glitches
          </div>
        </div>

        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
          The backend is preparing your creative workspace...
        </p>
      </div>
    </div>
  );
};

const AnimatedRoutes = ({ user, setUser, handleLogout }) => {
  const location = useLocation();

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]); // The effect runs whenever the pathname changes
  
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="w-full"
      >
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/editor" element={user ? <Editor key={user._id} /> : <Navigate to="/auth" />} />
          <Route path="/chat" element={user ? <Conversations /> : <Navigate to="/auth" />} />
          <Route path="/todos" element={user ? <Todos /> : <Navigate to="/auth" />} />
          <Route path="/profile" element={user ? <Profile setUser={setUser} /> : <Navigate to="/auth" />} />
          <Route path="/auth" element={!user ? <Auth setUser={setUser} /> : <Navigate to="/editor" />} />
          <Route path="/admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/" />} />
          <Route path="/about" element={<About />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/privacy" element={<Legal type="privacy" />} />
          <Route path="/terms" element={<Legal type="terms" />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      if (!saved || saved === "undefined") return null;
      return JSON.parse(saved);
    } catch (e) {
      console.error("Neural Shard Corruption: Resetting identity context.");
      localStorage.removeItem('user');
      return null;
    }
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isServerLoading, setIsServerLoading] = useState(true);

  useEffect(() => {
    const checkServer = async () => {
      try {
        await axios.get(import.meta.env.VITE_API_URL);
        setIsServerLoading(false);
      } catch (e) {
        setTimeout(checkServer, 3000);
      }
    };
    checkServer();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsMobileMenuOpen(false);
  };

  const navItems = user ? [
    { name: 'Canvas', path: '/editor', icon: Layout },
    { name: 'Tasks', path: '/todos', icon: Check },
    { name: 'Dialogues', path: '/chat', icon: Sparkles },
    ...(user.role === 'admin' ? [{ name: 'Nexus', path: '/admin', icon: Shield }] : []),
  ] : [
    { name: 'About', path: '/about', icon: HelpCircle },
  ];

  return (
    <Router>
      <AnimatePresence>
        {isServerLoading && <ServerBootGame />}
      </AnimatePresence>
      <div className="min-h-screen relative selection:bg-purple-500/30 overflow-x-hidden">
        {/* Background Ambient Glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full -z-10" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-900/10 blur-[120px] rounded-full -z-10" />

        <nav className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-7xl">
          <div className="glass-panel rounded-2xl px-4 md:px-6 py-3 flex justify-between items-center border-white/10 shadow-2xl shadow-black/50">
            <NavLink to="/" className="flex items-center gap-2 md:gap-3 group">
              <div className="w-8 h-8 md:w-9 md:h-9 bg-gradient-to-tr from-violet-600 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-500 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <h1 className="text-lg md:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tighter uppercase">
                sOuL<span className="text-violet-500">TEXT</span>it
              </h1>
            </NavLink>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => 
                    `flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 ${
                      isActive 
                        ? 'bg-white text-black shadow-xl shadow-white/5' 
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <item.icon size={14} />
                  {item.name}
                </NavLink>
              ))}
            </div>

            <div className="flex gap-4 items-center">
              {user ? (
                <>
                  <NavLink 
                    to="/profile"
                    className="hidden lg:flex items-center gap-3 px-4 py-2 glass-card rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-300 border-white/5 hover:border-violet-500/50 hover:bg-white/10 transition-all"
                  >
                    <User size={12} className="text-violet-400" />
                    {user.name}
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  </NavLink>
                  
                  <button 
                    onClick={handleLogout} 
                    className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-rose-400 hover:bg-rose-400/5 transition-all"
                  >
                    <LogOut size={14} />
                    Exit
                  </button>

                  <button 
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="md:hidden p-2.5 glass-card rounded-xl text-white"
                  >
                    {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                  </button>
                </>
              ) : (
                <NavLink 
                  to="/auth" 
                  className="bg-white text-black px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-violet-500 hover:text-white transition-all shadow-xl shadow-white/5 active:scale-95"
                >
                  Initialize Nexus
                </NavLink>
              )}
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="md:hidden absolute top-20 left-0 w-full glass-panel rounded-2xl p-6 border-white/10 shadow-2xl flex flex-col gap-4 mt-2"
              >
                <NavLink 
                  to="/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl mb-2 hover:bg-white/10 border border-transparent hover:border-white/10 transition-all"
                >
                   <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400">
                      <User size={16} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Entity</p>
                      <p className="text-sm font-bold text-white">{user?.name}</p>
                   </div>
                </NavLink>
                
                {navItems.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={({ isActive }) => 
                      `flex items-center gap-4 p-4 rounded-xl text-sm font-black uppercase tracking-widest transition-all ${
                        isActive 
                          ? 'bg-violet-600 text-white' 
                          : 'text-gray-400 hover:bg-white/5'
                      }`
                    }
                  >
                    <item.icon size={18} />
                    {item.name}
                  </NavLink>
                ))}
                
                <div className="h-[1px] bg-white/5 my-2" />
                
                <button 
                  onClick={handleLogout} 
                  className="flex items-center gap-4 p-4 rounded-xl text-sm font-black uppercase tracking-widest text-rose-400 hover:bg-rose-400/10 transition-all text-left bg-rose-400/5 border border-rose-400/10"
                >
                  <LogOut size={18} />
                  Terminate Session
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        <main className="pt-28 md:pt-32 pb-16 md:pb-20 px-3 sm:px-6 md:px-8 max-w-7xl mx-auto">
          <AnimatedRoutes user={user} setUser={setUser} handleLogout={handleLogout} />
        </main>

        <footer className="w-full py-12 px-6 border-t border-white/5 bg-[#02010a]/80">
            <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12">
              <div className="col-span-2">
                <h2 className="text-xl font-black text-white uppercase tracking-tighter mb-4">sOuL<span className="text-violet-500">TEXT</span>it</h2>
                <p className="text-gray-500 text-sm max-w-sm">The premium AI-powered workspace for modern digital alchemists. Transmuting thoughts into manuscripts through a unified neural core.</p>
              </div>
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Nexus</h3>
                <div className="flex flex-col gap-4">
                  <NavLink to="/about" className="text-xs text-gray-500 hover:text-white transition-colors">About Us</NavLink>
                  <NavLink to="/pricing" className="text-xs text-gray-500 hover:text-white transition-colors">Pricing</NavLink>
                  <NavLink to="/privacy" className="text-xs text-gray-500 hover:text-white transition-colors">Privacy Policy</NavLink>
                  <NavLink to="/terms" className="text-xs text-gray-500 hover:text-white transition-colors">Terms of Service</NavLink>
                </div>
              </div>
              <div>
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Status</h3>
                <div className="flex items-center gap-2 text-emerald-500 text-xs font-bold">
                  <div className="w-2 h-2 rounded-full bg-current animate-pulse" />
                  All Shards Operational
                </div>
                <p className="text-[8px] text-gray-600 font-black uppercase tracking-[0.4em] mt-8">© {new Date().getFullYear()} sOuLTEXTit Neural Labs</p>
              </div>
            </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;

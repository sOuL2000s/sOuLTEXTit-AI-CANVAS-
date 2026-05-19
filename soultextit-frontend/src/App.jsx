import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, NavLink, useLocation } from 'react-router-dom';
import Editor from './components/Editor';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import './App.css';

import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, Layout, Shield, LogOut, Sparkles, User, Settings } from 'lucide-react';

const AnimatedRoutes = ({ user, setUser, handleLogout }) => {
  const location = useLocation();
  
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
          <Route path="/" element={user ? <Editor /> : <Navigate to="/auth" />} />
          <Route path="/auth" element={!user ? <Auth setUser={setUser} /> : <Navigate to="/" />} />
          <Route path="/admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/" />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsMobileMenuOpen(false);
  };

  const navItems = user ? [
    { name: 'Canvas', path: '/', icon: Layout },
    ...(user.role === 'admin' ? [{ name: 'Nexus', path: '/admin', icon: Shield }] : []),
  ] : [];

  return (
    <Router>
      <div className="min-h-screen relative selection:bg-purple-500/30 overflow-x-hidden">
        {/* Background Ambient Glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/10 blur-[120px] rounded-full -z-10" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-900/10 blur-[120px] rounded-full -z-10" />

        <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-7xl">
          <div className="glass-panel rounded-2xl px-6 py-3 flex justify-between items-center border-white/10 shadow-2xl shadow-black/50">
            <NavLink to="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 bg-gradient-to-tr from-violet-600 to-pink-500 rounded-xl shadow-lg shadow-purple-500/20 group-hover:scale-110 transition-transform duration-500 flex items-center justify-center">
                <Sparkles size={18} className="text-white" />
              </div>
              <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tighter uppercase hidden sm:block">
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
                  <div className="hidden lg:flex items-center gap-3 px-4 py-2 glass-card rounded-xl text-[10px] font-black uppercase tracking-widest text-gray-300 border-white/5">
                    <User size={12} className="text-violet-400" />
                    {user.name}
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                  </div>
                  
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
                  Get Started
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
                <div className="flex items-center gap-3 px-4 py-3 bg-white/5 rounded-xl mb-2">
                   <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400">
                      <User size={16} />
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Active Entity</p>
                      <p className="text-sm font-bold text-white">{user?.name}</p>
                   </div>
                </div>
                
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
                  className="flex items-center gap-4 p-4 rounded-xl text-sm font-black uppercase tracking-widest text-rose-400 hover:bg-rose-400/5 transition-all text-left"
                >
                  <LogOut size={18} />
                  Terminate Session
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        <main className="pt-32 pb-20 px-4 md:px-8 max-w-7xl mx-auto">
          <AnimatedRoutes user={user} setUser={setUser} handleLogout={handleLogout} />
        </main>

        <footer className="fixed bottom-0 left-0 w-full p-4 pointer-events-none z-40 hidden md:block">
            <div className="max-w-7xl mx-auto flex justify-between items-center text-[8px] font-black uppercase tracking-[0.4em] text-gray-600">
                <p>System Shard: Primary-01</p>
                <p>© {new Date().getFullYear()} sOuLTEXTit Neural Labs</p>
            </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;

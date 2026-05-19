import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Editor from './components/Editor';
import Admin from './pages/Admin';
import Auth from './pages/Auth';
import './App.css';

import { motion, AnimatePresence } from 'framer-motion';

function App() {
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')));

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <Router>
      <div className="min-h-screen relative selection:bg-purple-500/30">
        {/* Background Ambient Glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full -z-10" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-pink-900/10 blur-[120px] rounded-full -z-10" />

        <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-7xl">
          <div className="glass-panel rounded-2xl px-8 py-4 flex justify-between items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-gradient-to-tr from-violet-600 to-pink-500 rounded-lg shadow-lg shadow-purple-500/20" />
              <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 tracking-tighter uppercase">
                sOuL<span className="text-violet-500">TEXT</span>it
              </h1>
            </motion.div>

            <div className="flex gap-6 items-center">
              {user ? (
                <>
                  <div className="hidden md:flex items-center gap-3 px-4 py-1.5 glass-card rounded-full text-sm font-medium">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    {user.name}
                  </div>
                  {user.role === 'admin' && (
                    <a href="/admin" className="text-sm font-semibold hover:text-violet-400 transition-colors uppercase tracking-widest">Panel</a>
                  )}
                  <button 
                    onClick={handleLogout} 
                    className="text-sm font-bold text-gray-400 hover:text-red-400 transition-colors"
                  >
                    EXIT
                  </button>
                </>
              ) : (
                <a href="/auth" className="bg-white text-black px-6 py-2 rounded-xl font-bold hover:bg-gray-200 transition-all shadow-xl shadow-white/5">
                  Get Started
                </a>
              )}
            </div>
          </div>
        </nav>

        <main className="pt-32 pb-20 px-4 md:px-8">
          <Routes>
            <Route path="/" element={user ? <Editor /> : <Navigate to="/auth" />} />
            <Route path="/auth" element={!user ? <Auth setUser={setUser} /> : <Navigate to="/" />} />
            <Route path="/admin" element={user?.role === 'admin' ? <Admin /> : <Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

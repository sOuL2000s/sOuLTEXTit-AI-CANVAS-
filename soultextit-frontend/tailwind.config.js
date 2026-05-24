/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'bg-blue-500', 'text-blue-500', 'bg-blue-500/10', 'text-blue-400',
    'bg-violet-500', 'text-violet-500', 'bg-violet-500/10', 'text-violet-400',
    'bg-pink-500', 'text-pink-500', 'bg-pink-500/10', 'text-pink-400',
    'bg-amber-500', 'text-amber-500', 'bg-amber-500/10', 'text-amber-400',
    'bg-emerald-500', 'text-emerald-500', 'bg-emerald-500/10', 'text-emerald-400',
    'bg-rose-500', 'text-rose-500', 'bg-rose-500/10', 'text-rose-400',
    'bg-cyan-500', 'text-cyan-500', 'bg-cyan-500/10', 'text-cyan-400',
    'bg-yellow-500', 'text-yellow-500', 'bg-yellow-500/10', 'text-yellow-400',
  ],
}

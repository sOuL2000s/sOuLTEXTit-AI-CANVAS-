require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, ApiKey, Canvas, Model } = require('./models/Schema');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const app = express();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.use(cors());
app.use(express.json());

// Request Logger for Debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

// Health Check
app.get('/', (req, res) => res.send('sOuLTEXTit API Active'));

// Auth Middleware
const auth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "No token" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) { res.status(401).json({ message: "Auth failed" }); }
};

const isAdmin = async (req, res, next) => {
  const user = await User.findById(req.userId);
  if (user && user.role === 'admin') next();
  else res.status(403).send("Admin access denied");
};

// Auth Routes
app.post('/api/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  const hashed = await bcrypt.hash(password, 10);
  try {
    const user = await User.create({ email, password: hashed, name });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token, user });
  } catch (e) { res.status(400).json({ error: "User exists" }); }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (user && await bcrypt.compare(password, user.password)) {
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
    res.json({ token, user });
  } else res.status(400).json({ error: "Invalid credentials" });
});

app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  const ticket = await client.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
  const { email, name, sub } = ticket.getPayload();
  let user = await User.findOne({ email });
  if (!user) user = await User.create({ email, name, googleId: sub });
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);
  res.json({ token, user });
});

// AI Core Logic with Failover and Dynamic Model selection
const callAI = async (prompt, preferredProvider, type = 'text', customModel = null) => {
  const providers = preferredProvider ? [preferredProvider, 'gemini', 'groq'] : ['gemini', 'groq'];
  const uniqueProviders = [...new Set(providers)];

  for (let provider of uniqueProviders) {
    const keys = await ApiKey.find({ provider, type, isActive: true });
    const modelConfig = await Model.findOne({ provider, type, isDefault: true });
    const modelName = customModel || modelConfig?.name || (provider === 'gemini' ? 'gemini-1.5-flash' : 'llama3-8b-8192');

    for (let apiKey of keys) {
      try {
        if (provider === 'gemini') {
          const genAI = new GoogleGenerativeAI(apiKey.key);
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent(prompt);
          return result.response.text();
        } else if (provider === 'groq') {
          const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
            model: modelName,
            messages: [{ role: "system", content: "You are a professional editor. Return only the revised text without preamble." }, { role: "user", content: prompt }]
          }, { headers: { Authorization: `Bearer ${apiKey.key}` } });
          return response.data.choices[0].message.content;
        }
      } catch (err) {
        console.error(`AI Error (${provider}):`, err.message);
        continue; 
      }
    }
  }
  throw new Error("Soul Error: All AI nodes are currently unreachable. Please check API keys in Admin Panel.");
};

// Canvas Routes
app.get('/api/canvases', auth, async (req, res) => {
  res.json(await Canvas.find({ userId: req.userId }).sort({ lastModified: -1 }));
});

app.post('/api/canvases', auth, async (req, res) => {
  const { title, content } = req.body;
  const canvas = await Canvas.findOneAndUpdate(
    { userId: req.userId, title },
    { 
      content, 
      $push: { history: { $each: [{ content, timestamp: new Date() }], $slice: -20 } }, 
      lastModified: Date.now() 
    },
    { upsert: true, new: true }
  );
  res.json(canvas);
});

// AI Processing
app.post('/api/ai/edit', auth, async (req, res) => {
  const { prompt, context, provider, model } = req.body;
  try {
    const fullPrompt = `STRICT INSTRUCTION: Rewrite or modify the following text exactly as requested. Do not explain your changes. Return ONLY the final text.\n\nCONTEXT:\n${context}\n\nUSER REQUEST:\n${prompt}`;
    const suggestion = await callAI(fullPrompt, provider, 'text', model);
    res.json({ suggestion });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin Panel Extensions
app.post('/api/admin/keys', auth, isAdmin, async (req, res) => {
  const newKey = await ApiKey.create(req.body);
  res.json(newKey);
});

app.get('/api/admin/keys', auth, isAdmin, async (req, res) => {
  res.json(await ApiKey.find().sort({ createdAt: -1 }));
});

app.delete('/api/admin/keys/:id', auth, isAdmin, async (req, res) => {
  await ApiKey.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

app.get('/api/admin/models', auth, isAdmin, async (req, res) => {
  res.json(await Model.find());
});

app.post('/api/admin/models', auth, isAdmin, async (req, res) => {
  const model = await Model.create(req.body);
  res.json(model);
});

app.listen(5000, () => console.log('sOuLTEXTit Server Running'));

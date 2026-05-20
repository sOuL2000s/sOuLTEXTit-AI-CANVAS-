require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, ApiKey, Canvas, Model } = require('./models/Schema');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

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

/**
 * PROVIDER ABSTRACTION LAYER
 */
const Providers = {
  gemini: async (apiKey, modelId, prompt) => {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId });
    const result = await model.generateContent(prompt);
    return result.response.text();
  },
  groq: async (apiKey, modelId, prompt) => {
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: modelId,
      messages: [
        { role: "system", content: "You are sOuLTEXTit, a world-class professional editor. Return refined text only." },
        { role: "user", content: prompt }
      ]
    }, { headers: { Authorization: `Bearer ${apiKey}` } });
    return response.data.choices[0].message.content;
  },
  
  /**
   * Real-time STT Provider Logic (Whisper API Example)
   * For true real-time streaming, Deepgram is recommended. 
   * This implementation handles audio chunks.
   */
  stt: {
    whisper: async (apiKey, audioBuffer) => {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', audioBuffer, { filename: 'speech.webm', contentType: 'audio/webm' });
      form.append('model', 'whisper-1');
      
      const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: { 
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}` 
        }
      });
      return response.data.text;
    }
  }
};

/**
 * Socket.io Real-time STT Pipeline
 */
io.on('connection', (socket) => {
  console.log('Voice Node Connected:', socket.id);
  let audioChunks = [];

  socket.on('audio-chunk', (data) => {
    audioChunks.push(data);
  });

  socket.on('stop-recording', async ({ modelId }) => {
    try {
      const buffer = Buffer.concat(audioChunks);
      audioChunks = []; 

      // 1. Resolve Model and its Provider from Database
      const modelConfig = await Model.findOne({ modelId, category: 'stt', isActive: true });
      if (!modelConfig) throw new Error("STT Model configuration not found or inactive in Nexus.");

      const provider = modelConfig.provider;
      const apiKeys = await ApiKey.find({ provider, isActive: true }).sort({ priority: -1 });

      if (!apiKeys.length) throw new Error(`No active API keys found for provider: ${provider}`);

      // 2. Attempt transcription with failover
      let transcript = "";
      for (const keyDoc of apiKeys) {
        try {
          // Note: Current implementation uses OpenAI Whisper logic for 'openai' provider
          if (provider === 'openai') {
             transcript = await Providers.stt.whisper(keyDoc.key, buffer);
          } else {
             throw new Error(`STT Pipeline for [${provider}] is currently under maintenance or not implemented.`);
          }
          
          await ApiKey.findByIdAndUpdate(keyDoc._id, { 
            $inc: { 'usageStats.totalRequests': 1 },
            'usageStats.lastUsed': new Date()
          });
          break; 
        } catch (e) { 
          console.error(`STT Node Fail [${keyDoc._id}]:`, e.message); 
          await ApiKey.findByIdAndUpdate(keyDoc._id, { $inc: { 'usageStats.errorCount': 1 } });
          continue; 
        }
      }

      socket.emit('transcription-result', { text: transcript });
    } catch (err) {
      socket.emit('stt-error', { message: err.message });
    }
  });

  socket.on('disconnect', () => {
    audioChunks = [];
  });
});

const callAI = async ({ prompt, category = 'text', preferredModelId = null }) => {
  // 1. Resolve Model
  let modelConfig;
  if (preferredModelId) {
    modelConfig = await Model.findOne({ modelId: preferredModelId, isActive: true });
  } else {
    modelConfig = await Model.findOne({ category, isDefault: true, isActive: true }) || 
                  await Model.findOne({ category, isActive: true }).sort({ priority: -1 });
  }

  if (!modelConfig) throw new Error(`No active models configured for ${category}`);

  // 2. Fetch Keys for the Provider (Ordered by priority)
  const apiKeys = await ApiKey.find({ 
    provider: modelConfig.provider, 
    isActive: true 
  }).sort({ priority: -1 });

  if (apiKeys.length === 0) throw new Error(`No active API keys for provider: ${modelConfig.provider}`);

  // 3. Execution with Failover across keys
  for (const keyDoc of apiKeys) {
    try {
      const output = await Providers[modelConfig.provider](keyDoc.key, modelConfig.modelId, prompt);
      
      // Update Stats
      await ApiKey.findByIdAndUpdate(keyDoc._id, { 
        $inc: { 'usageStats.totalRequests': 1 },
        'usageStats.lastUsed': new Date()
      });

      return output;
    } catch (err) {
      console.error(`Provider Error [${modelConfig.provider}]:`, err.message);
      await ApiKey.findByIdAndUpdate(keyDoc._id, { $inc: { 'usageStats.errorCount': 1 } });
      continue; // Try next key
    }
  }

  throw new Error(`Exhausted all nodes for ${modelConfig.provider}. Support requested.`);
};

// Canvas Routes
app.get('/api/canvases', auth, async (req, res) => {
  res.json(await Canvas.find({ userId: req.userId }).sort({ lastModified: -1 }));
});

app.delete('/api/canvases/:id', auth, async (req, res) => {
  try {
    await Canvas.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: "Failed to erase record" });
  }
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
  const { prompt, context, modelId } = req.body;
  try {
    const fullPrompt = `STRICT INSTRUCTION: Rewrite or modify the following text exactly as requested. Do not explain your changes. Return ONLY the final text.\n\nCONTEXT:\n${context}\n\nUSER REQUEST:\n${prompt}`;
    const suggestion = await callAI({ prompt: fullPrompt, preferredModelId: modelId });
    res.json({ suggestion });
  } catch (err) { 
    console.error("AI Error:", err);
    res.status(500).json({ error: err.message }); 
  }
});

// Admin Panel Extensions
app.get('/api/admin/stats', auth, isAdmin, async (req, res) => {
  const totalKeys = await ApiKey.countDocuments();
  const activeModels = await Model.countDocuments({ isActive: true });
  const totalRequests = await ApiKey.aggregate([{ $group: { _id: null, total: { $sum: "$usageStats.totalRequests" } } }]);
  res.json({
    totalKeys,
    activeModels,
    totalRequests: totalRequests[0]?.total || 0,
    systemStatus: 'Optimal'
  });
});

app.get('/api/admin/keys', auth, isAdmin, async (req, res) => {
  res.json(await ApiKey.find().sort({ createdAt: -1 }));
});

app.post('/api/admin/keys', auth, isAdmin, async (req, res) => {
  try {
    const newKey = await ApiKey.create(req.body);
    res.status(201).json(newKey);
  } catch (e) { res.status(400).json({ error: "Validation failed" }); }
});

app.patch('/api/admin/keys/:id/toggle', auth, isAdmin, async (req, res) => {
  const key = await ApiKey.findById(req.params.id);
  key.isActive = !key.isActive;
  await key.save();
  res.json(key);
});

app.delete('/api/admin/keys/:id', auth, isAdmin, async (req, res) => {
  await ApiKey.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

app.get('/api/admin/models', auth, isAdmin, async (req, res) => {
  res.json(await Model.find().sort({ provider: 1 }));
});

app.post('/api/admin/models', auth, isAdmin, async (req, res) => {
  try {
    const model = await Model.create(req.body);
    res.status(201).json(model);
  } catch (e) { res.status(400).json({ error: "Model ID must be unique" }); }
});

app.patch('/api/admin/models/:id/toggle', auth, isAdmin, async (req, res) => {
  const model = await Model.findById(req.params.id);
  model.isActive = !model.isActive;
  await model.save();
  res.json(model);
});

app.delete('/api/admin/models/:id', auth, isAdmin, async (req, res) => {
  await Model.findByIdAndDelete(req.params.id);
  res.sendStatus(204);
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`sOuLTEXTit Neural Core Running on Port ${PORT}`));

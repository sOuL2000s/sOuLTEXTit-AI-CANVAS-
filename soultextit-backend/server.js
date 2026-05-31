require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { User, ApiKey, Canvas, CanvasVersion, Model, Conversation, Todo } = require('./models/Schema');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const axios = require('axios');
const puppeteer = require('puppeteer');
const multer = require('multer');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 } 
});
const md = require('markdown-it')({
  html: true,
  linkify: true,
  typographer: true
});

const NodeCache = require('node-cache');
const systemCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { HarmBlockThreshold, HarmCategory } = require("@google/generative-ai");
const Razorpay = require('razorpay');
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const DURATION_TO_MONTHS = {
  monthly: 1,
  quarterly: 3,
  biannual: 6,
  annual: 12,
};

const PLAN_LIMITS = {
  free: { aiEdits: 10, sttMinutes: 30, canvases: 5, dialogues: 5 },
  creative: { aiEdits: 100, sttMinutes: 180, canvases: 50, dialogues: 25 },
  quantum: { aiEdits: 500, sttMinutes: 600, canvases: Infinity, dialogues: 100 },
  omnicore: { aiEdits: Infinity, sttMinutes: Infinity, canvases: Infinity, dialogues: Infinity }
};

/**
 * ENTITLEMENT MIDDLEWARE (THE GUARD)
 */
const checkLimits = (type) => async (req, res, next) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(404).json({ error: "Entity not found" });

  // 1. EXPIRY GUARD: If plan expired, revert to free
  if (user.subscription.plan !== 'free' && new Date() > user.subscription.expiry) {
    user.subscription.plan = 'free';
    user.subscription.duration = 'monthly';
    user.subscription.status = 'expired';
    await user.save();
  }

  // 2. Nexus Overlord (Admin) Exception: Unlimited Shard Access
  if (user.role === 'admin') {
    req.userDoc = user;
    return next();
  }

  const plan = user.subscription.plan;
  const limits = PLAN_LIMITS[plan];

  // --- QUOTA RESET LOGIC ---
  const now = new Date();
  const todayStr = now.toDateString();

  // Reset Daily AI Edits if day changed
  if (user.usageStats.aiEditsToday.date !== todayStr) {
    user.usageStats.aiEditsToday = { count: 0, date: todayStr };
    await user.save();
  }

  // Reset Monthly STT if month changed
  const currentMonth = now.getMonth();
  if (user.usageStats.sttMinutesThisMonth.month !== currentMonth) {
    user.usageStats.sttMinutesThisMonth = { count: 0, month: currentMonth };
    await user.save();
  }

  // --- ENFORCEMENT LOGIC ---
  if (type === 'aiEdit' && user.usageStats.aiEditsToday.count >= limits.aiEdits) {
    return res.status(403).json({ 
      error: "LIMIT_REACHED", 
      message: `Daily AI limit hit for ${plan.toUpperCase()} tier. Reset at midnight UTC.`,
      resetType: 'daily'
    });
  }

  if (type === 'canvas') {
    const count = await Canvas.countDocuments({ userId: req.userId });
    if (count >= limits.canvases) {
      return res.status(403).json({ error: "LIMIT_REACHED", message: `Manuscript archive limit reached for ${plan.toUpperCase()} tier.` });
    }
  }

  if (type === 'dialogue') {
    const count = await Conversation.countDocuments({ userId: req.userId });
    if (count >= limits.dialogues) {
      return res.status(403).json({ error: "LIMIT_REACHED", message: `Dialogue timeline limit reached for ${plan.toUpperCase()} tier.` });
    }
  }

  if (type === 'stt' && user.usageStats.sttMinutesThisMonth.count >= limits.sttMinutes) {
    return res.status(403).json({ error: "LIMIT_REACHED", message: `Monthly Voice Typing frequency reached for ${plan.toUpperCase()} tier.` });
  }

  req.userDoc = user; 
  next();
};

/**
 * CACHE MANAGEMENT LAYER
 */
const refreshSystemCache = async () => {
  try {
    const activeModels = await Model.find({ isActive: true }).lean();
    const activeKeys = await ApiKey.find({ isActive: true }).sort({ priority: -1 }).lean();
    systemCache.set('models', activeModels);
    systemCache.set('keys', activeKeys);
    console.log('Neural Cache Synchronized');
  } catch (err) {
    console.error('Cache Refresh Error:', err);
  }
};

const getCachedModels = async () => {
  let models = systemCache.get('models');
  if (!models) {
    await refreshSystemCache();
    models = systemCache.get('models') || [];
  }
  return models;
};

const getCachedKeys = async () => {
  let keys = systemCache.get('keys');
  if (!keys) {
    await refreshSystemCache();
    keys = systemCache.get('keys') || [];
  }
  return keys;
};

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Request Logger for Debugging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    refreshSystemCache();
  })
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
  try {
    if (!req.userId) return res.status(401).json({ message: "Unauthorized" });
    const user = await User.findById(req.userId);
    if (user && user.role === 'admin') {
      next();
    } else {
      res.status(403).json({ message: "Admin access denied" });
    }
  } catch (err) {
    res.status(500).json({ message: "Internal server error during auth" });
  }
};

// Public/User Model Discovery Route
app.get('/api/models', auth, async (req, res) => {
  try {
    const models = await Model.find({ isActive: true }).sort({ provider: 1 });
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve neural metadata" });
  }
});

// User Preference Routes
app.get('/api/user/me', auth, async (req, res) => {
  const user = await User.findById(req.userId).select('-password').lean();
  if (!user) return res.status(404).json({ error: "User not found" });

  // Dynamically calculate document counts to ensure UI accuracy against limits
  const actualCanvasCount = await Canvas.countDocuments({ userId: req.userId });
  const actualDialogueCount = await Conversation.countDocuments({ userId: req.userId });

  // Calculate Time to Midnight UTC
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const msUntilReset = midnight - now;

  res.json({
    ...user,
    usageStats: {
      ...(user.usageStats || {}),
      totalCanvases: actualCanvasCount,
      totalDialogues: actualDialogueCount
    },
    limits: PLAN_LIMITS[user.subscription?.plan || 'free'],
    resetsInMs: msUntilReset
  });
});

app.patch('/api/user/preferences', auth, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.userId, 
      { preferences: req.body }, 
      { returnDocument: 'after' }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Failed to update neural parameters." });
  }
});

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
 * TOOL DEFINITIONS
 */
const webSearchTool = {
  functionDeclarations: [{
    name: "web_search",
    description: "Search the web for up-to-date information, facts, news, or any query that requires external knowledge.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query, e.g., 'current stock price of NVDA', 'latest news on AI'."
        }
      },
      required: ["query"]
    }
  }]
};

/**
 * WEB SEARCH UTILITY (Serper API)
 */
const performWebSearch = async (query) => {
  try {
    const cachedKeys = await getCachedKeys();
    const serperKeys = cachedKeys.filter(k => k.provider === 'serper' && k.type === 'web_search' && k.isActive);

    if (serperKeys.length === 0) return "Web search service is currently unavailable (No API keys found).";

    const apiKey = serperKeys[0].key;
    const response = await axios.post('https://google.serper.dev/search', {
      q: query
    }, {
      headers: { 
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json'
      }
    });

    const organic = response.data.organic || [];
    const answerBox = response.data.answerBox;
    
    // Intelligent Scraping: Format into a highly condensed summary for LLM context
    let context = "";
    if (answerBox?.answer) context += `DIRECT ANSWER: ${answerBox.answer}\n`;
    if (answerBox?.snippet) context += `SNIPPET: ${answerBox.snippet}\n`;
    
    organic.slice(0, 4).forEach((res, i) => {
      context += `[${i+1}] ${res.title}: ${res.snippet} (Source: ${res.link})\n`;
    });

    return context || "No relevant search results found.";
  } catch (err) {
    console.error("Serper API Fail:", err.message);
    return "Search failed due to network error.";
  }
};

const executeToolCall = async (toolCall) => {
  if (toolCall.name === "web_search") {
    return await performWebSearch(toolCall.args?.query || toolCall.arguments?.query);
  }
  return "Error: Unknown tool.";
};

/**
 * PROVIDER ABSTRACTION LAYER
 */
const Providers = {
  stt: {
    whisper: async (apiKey, audioBuffer, provider = 'openai') => {
      const FormData = require('form-data');
      const { Readable } = require('stream');
      const form = new FormData();
      
      const audioStream = Readable.from(audioBuffer);
      
      form.append('file', audioStream, { 
        filename: 'speech.webm', 
        contentType: 'audio/webm',
        knownLength: audioBuffer.length 
      });
      
      let url = 'https://api.openai.com/v1/audio/transcriptions';
      let model = 'whisper-1';

      if (provider === 'groq') {
        url = 'https://api.groq.com/openai/v1/audio/transcriptions';
        model = 'whisper-large-v3';
      }
      
      form.append('model', model);
      
      const response = await axios.post(url, form, {
        headers: { 
          ...form.getHeaders(),
          Authorization: `Bearer ${apiKey}` 
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
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
    if (audioChunks.length === 0) {
      socket.emit('stt-error', { message: "No audio data received." });
      return;
    }
    try {
      const userId = socket.handshake.query.userId;
      if (!userId) throw new Error("Identity context missing for STT pipeline.");

      const user = await User.findById(userId);
      if (!user) throw new Error("Entity not found in Nexus.");

      // 1. Pre-Execution Limit Check
      if (user.role !== 'admin') {
        const plan = user.subscription.plan;
        const limits = PLAN_LIMITS[plan];
        
        // Lazy Monthly Reset
        const currentMonth = new Date().getMonth();
        if (user.usageStats.sttMinutesThisMonth.month !== currentMonth) {
          user.usageStats.sttMinutesThisMonth = { count: 0, month: currentMonth };
          await user.save();
        }

        if (user.usageStats.sttMinutesThisMonth.count >= limits.sttMinutes) {
          socket.emit('stt-error', { message: "LIMIT_REACHED", detail: "Monthly Voice Limit Reached. Upgrade for more shards." });
          audioChunks = [];
          return;
        }
      }

      const buffer = Buffer.concat(audioChunks);
      audioChunks = []; 

      // 2. Resolve Model and its Provider from Cache
      const cachedModels = await getCachedModels();
      const modelConfig = cachedModels.find(m => m.modelId === modelId && m.category === 'stt');
      
      if (!modelConfig) throw new Error("STT Model configuration not found or inactive in Nexus.");

      const provider = modelConfig.provider;
      const cachedKeys = await getCachedKeys();
      const apiKeys = cachedKeys.filter(k => k.provider === provider);

      if (!apiKeys.length) throw new Error(`No active API keys found for provider: ${provider}`);

      // 3. Attempt transcription with failover
      let transcript = "";
      for (const keyDoc of apiKeys) {
        try {
          if (provider === 'openai' || provider === 'groq') {
             transcript = await Providers.stt.whisper(keyDoc.key, buffer, provider);
          } else {
             throw new Error(`STT Pipeline for [${provider}] is currently under maintenance or not implemented.`);
          }
          
          await ApiKey.findByIdAndUpdate(keyDoc._id, { 
            $inc: { 'usageStats.totalRequests': 1 },
            'usageStats.lastUsed': new Date()
          });

          // 4. Accurate Atomic Usage tracking for Voice Shards
          if (user.role !== 'admin') {
            const estimatedMinutes = Math.max(0.1, buffer.length / (1024 * 1024 * 1.5));
            await User.findByIdAndUpdate(userId, { 
              $inc: { 'usageStats.sttMinutesThisMonth.count': estimatedMinutes } 
            });
          }

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

const callAI = async ({ prompt, category = 'text', preferredModelId = null, webSearchEnabled = false, history = [] }) => {
  const cachedModels = await getCachedModels();
  let modelConfig;

  if (preferredModelId) {
    modelConfig = cachedModels.find(m => m.modelId === preferredModelId);
  } else {
    modelConfig = cachedModels.find(m => m.category === category && m.isDefault) || 
                  [...cachedModels].filter(m => m.category === category).sort((a,b) => b.priority - a.priority)[0];
  }

  if (!modelConfig) throw new Error(`No active models configured for ${category}`);

  const cachedKeys = await getCachedKeys();
  const apiKeys = cachedKeys
    .filter(k => k.provider === modelConfig.provider)
    .sort((a, b) => (b.priority - a.priority) || (a.usageStats.totalRequests - b.usageStats.totalRequests));

  if (apiKeys.length === 0) throw new Error(`No active API keys for provider: ${modelConfig.provider}`);

  for (const keyDoc of apiKeys) {
    try {
      let finalResponse = "";

      if (modelConfig.provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(keyDoc.key);
        const model = genAI.getGenerativeModel({ 
          model: modelConfig.modelId,
          tools: webSearchEnabled ? [webSearchTool] : []
        });

        const chat = model.startChat({
          history: history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
          }))
        });

        let result = await chat.sendMessage(prompt);
        let response = result.response;

        // Handle Function Calling for Gemini
        const call = response.functionCalls()?.[0];
        if (call) {
          const toolResult = await executeToolCall(call);
          const secondResult = await chat.sendMessage([{
            functionResponse: { name: call.name, response: { content: toolResult } }
          }]);
          finalResponse = secondResult.response.text();
        } else {
          finalResponse = response.text();
        }

      } else if (modelConfig.provider === 'groq' || modelConfig.provider === 'openai') {
        const baseURL = modelConfig.provider === 'groq' ? 'https://api.groq.com/openai/v1' : 'https://api.openai.com/v1';
        const messages = [
          ...history.map(h => ({ role: h.role, content: h.content })),
          { role: "user", content: prompt }
        ];

        const payload = {
          model: modelConfig.modelId,
          messages,
          tools: webSearchEnabled ? webSearchTool.functionDeclarations.map(f => ({ type: "function", function: f })) : undefined,
          tool_choice: webSearchEnabled ? "auto" : undefined
        };

        const res = await axios.post(`${baseURL}/chat/completions`, payload, {
          headers: { Authorization: `Bearer ${keyDoc.key}` }
        });

        const message = res.data.choices[0].message;

        if (message.tool_calls) {
          const toolCall = message.tool_calls[0].function;
          const toolResult = await executeToolCall({ name: toolCall.name, args: JSON.parse(toolCall.arguments) });
          
          const secondRes = await axios.post(`${baseURL}/chat/completions`, {
            model: modelConfig.modelId,
            messages: [
              ...messages,
              message,
              { role: "tool", tool_call_id: message.tool_calls[0].id, content: toolResult }
            ]
          }, { headers: { Authorization: `Bearer ${keyDoc.key}` } });
          
          finalResponse = secondRes.data.choices[0].message.content;
        } else {
          finalResponse = message.content;
        }
      }

      await ApiKey.findByIdAndUpdate(keyDoc._id, { 
        $inc: { 'usageStats.totalRequests': 1 },
        'usageStats.lastUsed': new Date()
      });

      return finalResponse;

    } catch (err) {
      console.error(`AI Core Fail [${modelConfig.provider}]:`, err.message);
      await ApiKey.findByIdAndUpdate(keyDoc._id, { $inc: { 'usageStats.errorCount': 1 } });
      continue;
    }
  }

  throw new Error(`Exhausted all nodes for ${modelConfig.provider}.`);
};

// Advanced Document Import (Universal Extraction)
app.post('/api/canvases/import', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file provided" });

  try {
    const filename = req.file.originalname;
    const extension = filename.split('.').pop().toLowerCase();
    let text = "";

    if (extension === 'docx') {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else if (extension === 'pdf') {
      const data = await pdf(req.file.buffer);
      text = data.text;
    } else {
      // Fallback for .txt, .md, .rtf, or unknown text formats
      text = req.file.buffer.toString('utf-8');
    }

    res.json({ text, title: filename.replace(/\.[^/.]+$/, "") });
  } catch (err) {
    console.error("Extraction Error:", err);
    res.status(500).json({ error: "Failed to extract neural content from file." });
  }
});

// Advanced Export: Microsoft Word (.docx)
app.post('/api/canvases/export-docx', auth, async (req, res) => {
  const { title, content } = req.body;
  try {
    const doc = new Document({
      sections: [{
        properties: {},
        children: content.split('\n').map(line => 
          new Paragraph({
            children: [new TextRun(line)],
          })
        ),
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    res.setHeader('Content-Disposition', `attachment; filename=${title}.docx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: "Word export failed." });
  }
});

// Canvas Routes
// Get version history for a specific canvas
app.get('/api/canvases/:id/history', auth, async (req, res) => {
  const versions = await CanvasVersion.find({ canvasId: req.params.id }).sort({ timestamp: -1 });
  res.json(versions);
});

// Restore a specific version
app.post('/api/canvases/:id/restore', auth, async (req, res) => {
  const { versionId } = req.body;
  const version = await CanvasVersion.findById(versionId);
  if (!version) return res.status(404).json({ error: "Version not found" });
  
  const canvas = await Canvas.findOneAndUpdate(
    { _id: req.params.id, userId: req.userId },
    { content: version.content, lastModified: Date.now() },
    { new: true }
  );
  res.json(canvas);
});

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

app.post('/api/canvases', auth, checkLimits('canvas'), async (req, res) => {
  const { title, content } = req.body;
  if (!title) return res.status(400).json({ error: "Title required" });
  
  try {
    // Check if this is a new manuscript or updating existing
    const isNew = !(await Canvas.findOne({ userId: req.userId, title }));

    const canvas = await Canvas.findOneAndUpdate(
      { userId: req.userId, title },
      { content, lastModified: Date.now() },
      { upsert: true, returnDocument: 'after' }
    );

    // Semantic History Logic: Only create a version if significant time has passed 
    // or if the content has changed significantly (to prevent clutter from auto-saves)
    const lastVersion = await CanvasVersion.findOne({ canvasId: canvas._id }).sort({ timestamp: -1 });
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    if (!lastVersion || lastVersion.timestamp < fiveMinutesAgo) {
      await CanvasVersion.create({
        canvasId: canvas._id,
        content: canvas.content,
        label: 'Auto-save'
      });
      
      // Clean up old versions to keep DB tidy (limit to 30 per canvas)
      const versionCount = await CanvasVersion.countDocuments({ canvasId: canvas._id });
      if (versionCount > 30) {
        const oldest = await CanvasVersion.find({ canvasId: canvas._id }).sort({ timestamp: 1 }).limit(versionCount - 30);
        await CanvasVersion.deleteMany({ _id: { $in: oldest.map(v => v._id) } });
      }
    }

    // Usage stats for total documents are now dynamically calculated per request in /api/user/me

    res.json(canvas);
  } catch (err) {
    console.error("Canvas Sync Error:", err);
    res.status(500).json({ error: "Failed to synchronize manuscript" });
  }
});

// Professional Chat PDF Generation
app.post('/api/conversations/:id/export-pdf', auth, async (req, res) => {
  try {
    const chat = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
    if (!chat) return res.status(404).json({ error: "Dialogue not found" });

    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
    const messagesHtml = chat.messages.map(m => `
      <div class="message-container ${m.role}">
        <div class="role-badge">${m.role.toUpperCase()}</div>
        <div class="message-content">${md.render(m.content || '')}</div>
        <div class="timestamp">${new Date(m.timestamp).toLocaleString()}</div>
      </div>
    `).join('');

    const template = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          @page { margin: 0; size: A4; }
          body { background: #02010a; color: #e2e8f0; font-family: 'Inter', sans-serif; padding: 60px; }
          .header { border-bottom: 2px solid #8b5cf6; padding-bottom: 20px; margin-bottom: 40px; }
          h1 { color: #8b5cf6; font-size: 28pt; font-weight: 800; text-transform: uppercase; margin: 0; }
          .message-container { margin-bottom: 30px; padding: 20px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(139, 92, 246, 0.1); }
          .role-badge { font-size: 8pt; font-weight: 900; letter-spacing: 0.2em; margin-bottom: 10px; color: #8b5cf6; }
          .user { border-left: 4px solid #fff; }
          .assistant { border-left: 4px solid #8b5cf6; }
          .message-content { font-size: 11pt; line-height: 1.6; }
          .timestamp { font-size: 7pt; color: #475569; margin-top: 10px; text-align: right; }
          code { background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px; color: #f1d592; }
          pre { background: #000; padding: 15px; border-radius: 8px; font-size: 9pt; overflow-x: auto; border: 1px solid #1e293b; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${chat.title}</h1>
          <div style="font-size: 10pt; color: #64748b; margin-top: 5px;">SOULTEXTIT NEURAL DIALOGUE LOG</div>
        </div>
        ${messagesHtml}
      </body>
      </html>
    `;

    await page.setContent(template, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();
    res.contentType("application/pdf").send(pdfBuffer);
  } catch (err) { res.status(500).json({ error: "PDF Generation Failed" }); }
});

// Professional PDF Generation via Puppeteer
app.post('/api/canvases/export-pdf', auth, async (req, res) => {
  const { title, content } = req.body;
  
  try {
    const user = await User.findById(req.userId);
    const isFree = user.subscription.plan === 'free' && user.role !== 'admin';

    const browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    const htmlContent = md.render(content || '');
    
    const professionalTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Syne:wght@800&display=swap" rel="stylesheet">
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css">
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.js"></script>
        <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}] });"></script>
        <style>
          @page { 
            margin: 0; 
            size: A4;
          }
          body { 
            background-color: #02010a; 
            color: #e2e8f0; 
            font-family: 'Inter', sans-serif; 
            line-height: 1.7; 
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
          }
          .page-container {
            padding: 60px;
            min-height: 297mm; /* A4 height */
            border: 1px solid rgba(212, 175, 55, 0.15);
            box-sizing: border-box;
            position: relative;
            background: linear-gradient(135deg, #02010a 0%, #050510 100%);
          }
          .header {
            border-bottom: 2px solid #d4af37;
            padding-bottom: 25px;
            margin-bottom: 50px;
          }
          h1, h2, h3 { 
            font-family: 'Syne', sans-serif; 
            color: #d4af37; 
            text-transform: uppercase;
            letter-spacing: -0.03em;
            margin-top: 0;
          }
          h1 { font-size: 34pt; margin-bottom: 10px; font-weight: 800; line-height: 1; }
          h2 { font-size: 22pt; margin-top: 40px; margin-bottom: 15px; border-left: 4px solid #d4af37; padding-left: 20px; }
          h3 { font-size: 16pt; margin-top: 30px; margin-bottom: 12px; color: #f1d592; }
          
          .branding {
            font-family: 'Syne', sans-serif;
            font-weight: 800;
            font-size: 11pt;
            color: #d4af37;
            text-transform: uppercase;
            letter-spacing: 0.4em;
            margin-bottom: 15px;
            opacity: 0.9;
          }
          
          .content-body { font-size: 11pt; text-align: justify; color: #cbd5e1; }
          .content-body p { margin-bottom: 1.5em; }
          
          blockquote { 
            border-left: 5px solid #d4af37; 
            padding: 15px 25px; 
            background: rgba(212, 175, 55, 0.04);
            font-style: italic; 
            color: #94a3b8; 
            margin: 30px 0; 
            border-radius: 0 12px 12px 0;
          }
          
          pre { 
            background: #050508; 
            padding: 20px; 
            border-radius: 12px; 
            font-size: 9.5pt; 
            margin: 25px 0; 
            border: 1px solid rgba(212, 175, 55, 0.1);
            color: #e2e8f0;
            font-family: 'Courier New', monospace;
          }
          
          code { 
            font-family: 'Courier New', monospace; 
            background: rgba(212, 175, 55, 0.12); 
            padding: 3px 7px; 
            border-radius: 5px; 
            color: #f1d592;
            font-weight: 600;
          }
          
          .footer { 
            position: absolute;
            bottom: 40px;
            left: 60px;
            right: 60px;
            font-size: 8.5pt; 
            color: #475569; 
            text-align: center; 
            border-top: 1px solid rgba(212, 175, 55, 0.1); 
            padding-top: 25px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.2em;
          }
          
          .royal-accent-top {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 6px;
            background: linear-gradient(90deg, #8c6a1c, #d4af37, #f1d592, #d4af37, #8c6a1c);
          }
          
          .watermark {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 100pt;
            font-family: 'Syne', sans-serif;
            font-weight: 800;
            color: rgba(212, 175, 55, 0.02);
            white-space: nowrap;
            pointer-events: none;
            z-index: -1;
          }

          .free-badge {
            position: absolute;
            top: 20px;
            right: 20px;
            background: #d4af37;
            color: #000;
            font-family: 'Syne', sans-serif;
            font-weight: 800;
            font-size: 8pt;
            padding: 5px 15px;
            transform: rotate(45deg);
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            z-index: 50;
          }
        </style>
      </head>
      <body>
        <div class="page-container">
          <div class="royal-accent-top"></div>
          ${isFree ? '<div class="free-badge">FREE TIER SHARD</div>' : ''}
          <div class="watermark">${isFree ? 'SOULTEXTIT FREE' : 'SOULTEXTIT'}</div>
          <div class="header">
            <div class="branding">sOuLTEXTit Neural Core Manuscript</div>
            <h1>${title}</h1>
          </div>
          <div class="content-body">
            ${htmlContent}
          </div>
          <div class="footer">
            Protocol: Amoled Gold • Neural Shard Primus • ${new Date().toLocaleDateString()}
          </div>
        </div>
      </body>
      </html>
    `;

    await page.setContent(professionalTemplate, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
    });

    await browser.close();

    res.contentType("application/pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF Engine Failure:", err);
    res.status(500).json({ error: "Neural printing node failed." });
  }
});

// AI Processing
app.post('/api/ai/edit', auth, checkLimits('aiEdit'), async (req, res) => {
  const { prompt, context, modelId, webSearchEnabled } = req.body;
  const fullPrompt = `CONTEXT:\n${context}\n\nREQUEST: ${prompt}`;
  
  try {
    const response = await callAI({ 
      prompt: fullPrompt, 
      preferredModelId: modelId, 
      webSearchEnabled: webSearchEnabled 
    });
    const suggestion = response.trim();

    // Atomic increment usage ONLY on successful response and for non-admins
    if (req.userDoc.role !== 'admin') {
      await User.findByIdAndUpdate(req.userId, { 
        $inc: { 'usageStats.aiEditsToday.count': 1 } 
      });
    }

    res.json({ suggestion });
  } catch (err) { 
    try {
      // Failover Retry Logic
      const response = await callAI({ prompt: fullPrompt, preferredModelId: modelId });
      const suggestion = response.trim();

      if (req.userDoc.role !== 'admin') {
        await User.findByIdAndUpdate(req.userId, { 
          $inc: { 'usageStats.aiEditsToday.count': 1 } 
        });
      }

      res.json({ suggestion });
    } catch (finalErr) {
      console.error("AI Error:", finalErr);
      res.status(500).json({ error: finalErr.message }); 
    }
  }
});

app.post('/api/ai/chat', auth, async (req, res) => {
  const { messages, modelId, webSearchEnabled } = req.body;
  try {
    const history = messages.slice(0, -1).map(m => {
      let content = m.content;
      if (m.attachments?.length > 0) {
        const attachmentText = m.attachments.map(a => `FILE: ${a.name}\nCONTENT:\n${a.content}`).join('\n\n');
        content = `ATTACHMENTS:\n${attachmentText}\n\n${content}`;
      }
      return { role: m.role, content };
    });

    const lastMsg = messages[messages.length - 1];
    let currentPrompt = lastMsg.content;
    if (lastMsg.attachments?.length > 0) {
      const attachmentText = lastMsg.attachments.map(a => `FILE: ${a.name}\nCONTENT:\n${a.content}`).join('\n\n');
      currentPrompt = `ATTACHMENTS:\n${attachmentText}\n\n${currentPrompt}`;
    }
    
    let response = await callAI({ 
      prompt: currentPrompt, 
      preferredModelId: modelId, 
      history, 
      webSearchEnabled 
    });
    
    // Sanitize response to remove accidental prefixes
    response = response.replace(/^(assistant|ASSISTANT|Assistant):\s*/i, '').trim();
    
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Conversation Routes
app.get('/api/conversations', auth, async (req, res) => {
  const chats = await Conversation.find({ userId: req.userId }).sort({ lastModified: -1 }).select('title lastModified');
  res.json(chats);
});

app.get('/api/conversations/:id', auth, async (req, res) => {
  const chat = await Conversation.findOne({ _id: req.params.id, userId: req.userId });
  res.json(chat);
});

app.post('/api/conversations', auth, checkLimits('dialogue'), async (req, res) => {
  try {
    const chat = await Conversation.create({ 
      userId: req.userId, 
      messages: req.body.messages || [],
      title: req.body.title || 'New Dialogue'
    });
    
    // Usage stats for total documents are now dynamically calculated per request in /api/user/me
    
    res.json(chat);
  } catch (err) {
    res.status(500).json({ error: "Neural dialogue initialization failed." });
  }
});

app.patch('/api/conversations/:id', auth, async (req, res) => {
  try {
    const { messages, title } = req.body;
    
    // Strict sanitization to prevent CastErrors and ensure no attachments reach the DB
    const cleanedMessages = Array.isArray(messages) ? messages.map(m => ({
      role: m.role,
      content: m.content || '',
      timestamp: m.timestamp || new Date()
    })) : [];

    const chat = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { $set: { messages: cleanedMessages, lastModified: Date.now(), title } },
      { returnDocument: 'after', runValidators: true }
    );
    
    if (!chat) return res.status(404).json({ error: "Conversation not found" });
    res.json(chat);
  } catch (err) {
    console.error("Patch Error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/conversations/:id', auth, async (req, res) => {
  await Conversation.findOneAndDelete({ _id: req.params.id, userId: req.userId });
  res.sendStatus(204);
});

// Smart To-Do Routes
app.get('/api/todos', auth, async (req, res) => {
  try {
    const todos = await Todo.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(todos);
  } catch (err) { res.status(500).json({ error: "Failed to retrieve tasks" }); }
});

app.post('/api/todos', auth, async (req, res) => {
  try {
    const todo = await Todo.create({ ...req.body, userId: req.userId });
    res.status(201).json(todo);
  } catch (err) { res.status(400).json({ error: "Failed to create task" }); }
});

app.patch('/api/todos/:id', auth, async (req, res) => {
  try {
    const todo = await Todo.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      req.body,
      { new: true }
    );
    res.json(todo);
  } catch (err) { res.status(400).json({ error: "Update failed" }); }
});

app.delete('/api/todos/:id', auth, async (req, res) => {
  try {
    await Todo.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.sendStatus(204);
  } catch (err) { res.status(500).json({ error: "Deletion failed" }); }
});

app.post('/api/ai/todos', auth, async (req, res) => {
  const { prompt, currentTodos, modelId } = req.body;
  
  const systemPrompt = `
    You are a Smart To-Do Assistant. Your goal is to interpret user intentions and manage their task list.
    Current Tasks: ${JSON.stringify(currentTodos)}
    
    Interpret the user's command and return a JSON ARRAY of operations. 
    Each operation must be an object with an "action" field: "create", "update", "delete", or "clear_completed".
    
    - For "create": include "text", "priority" (low, medium, high), and "category".
    - For "update": include "id" and fields to change ("text", "completed", "priority", "category").
    - For "delete": include "id".
    - For "clear_completed": no extra fields.

    User Command: "${prompt}"
    
    IMPORTANT: The command might be from speech-to-text, so it might contain slight transcription errors, punctuation, or filler words. Ignore those and interpret the core intention.
    ONLY return the JSON array. No explanations, no markdown backticks, just the raw valid JSON array.
  `;

  try {
    const aiResponse = await callAI({ 
      prompt: systemPrompt, 
      preferredModelId: modelId,
      category: 'text'
    });

    // Sanitize AI response to extract only JSON array
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("AI failed to generate a structured command set.");
    
    const operations = JSON.parse(jsonMatch[0]);
    const results = [];

    for (const op of operations) {
      if (op.action === 'create') {
        results.push(await Todo.create({ ...op, userId: req.userId }));
      } else if (op.action === 'update' && op.id) {
        results.push(await Todo.findOneAndUpdate({ _id: op.id, userId: req.userId }, op, { new: true }));
      } else if (op.action === 'delete' && op.id) {
        await Todo.findOneAndDelete({ _id: op.id, userId: req.userId });
        results.push({ _id: op.id, deleted: true });
      } else if (op.action === 'clear_completed') {
        await Todo.deleteMany({ userId: req.userId, completed: true });
        results.push({ cleared: true });
      }
    }

    res.json({ message: "Neural intent processed", operations: results });
  } catch (err) {
    console.error("Smart Todo AI Error:", err);
    res.status(500).json({ error: "Failed to interpret neural task command." });
  }
});

// Payment Routes
app.post('/api/payments/create-order', auth, async (req, res) => {
  const { amount, currency } = req.body;
  try {
    // Razorpay requires the amount to be an INTEGER in the smallest currency unit (paise/cents).
    // JavaScript floating point math (e.g., 14.99 * 83 * 100) can create decimals that Razorpay rejects.
    const calculatedAmount = Math.round(Number(amount) * 100);

    if (isNaN(calculatedAmount) || calculatedAmount <= 0) {
      return res.status(400).json({ error: "Invalid currency amount conversion." });
    }

    const options = {
      amount: calculatedAmount,
      currency: currency || 'USD',
      receipt: `rcpt_${req.userId.toString().slice(-8)}_${Date.now()}`,
    };
    
    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (e) { 
    console.error("Razorpay Order Creation Error:", e);
    res.status(500).json({ error: e.message }); 
  }
});

app.post('/api/payments/verify', auth, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, duration } = req.body;
  
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !plan || !duration) {
    return res.status(400).json({ error: "Missing verification parameters." });
  }

  if (!DURATION_TO_MONTHS[duration]) {
    return res.status(400).json({ error: "Invalid duration provided." });
  }

  const crypto = require('crypto');
  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET);
  hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
  const generated_signature = hmac.digest('hex');

  if (generated_signature === razorpay_signature) {
    const monthsToAdd = DURATION_TO_MONTHS[duration];
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + monthsToAdd);

    const updatedUser = await User.findByIdAndUpdate(req.userId, {
      'subscription.plan': plan,
      'subscription.duration': duration,
      'subscription.status': 'active',
      'subscription.razorpay_payment_id': razorpay_payment_id,
      'subscription.expiry': expiryDate
    }, { new: true }).select('-password');
    
    res.json({ success: true, user: updatedUser });
  } else {
    res.status(400).json({ success: false, error: "Payment verification failed." });
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
    await refreshSystemCache();
    res.status(201).json(newKey);
  } catch (e) { res.status(400).json({ error: "Validation failed" }); }
});

app.patch('/api/admin/keys/:id/toggle', auth, isAdmin, async (req, res) => {
  const key = await ApiKey.findById(req.params.id);
  key.isActive = !key.isActive;
  await key.save();
  await refreshSystemCache();
  res.json(key);
});

app.delete('/api/admin/keys/:id', auth, isAdmin, async (req, res) => {
  await ApiKey.findByIdAndDelete(req.params.id);
  await refreshSystemCache();
  res.sendStatus(204);
});

// Bulk API Key Management
app.post('/api/admin/keys/bulk', auth, isAdmin, async (req, res) => {
  const { keys: keyData } = req.body;
  if (!Array.isArray(keyData)) {
    return res.status(400).json({ error: "Invalid input: expected an array of API key objects." });
  }

  const results = [];
  for (const item of keyData) {
    try {
      let key;
      if (item._id) {
        key = await ApiKey.findByIdAndUpdate(item._id, item, { new: true, runValidators: true });
        if (key) {
          results.push({ id: item._id, status: 'updated', data: key });
        } else {
          results.push({ id: item._id, status: 'failed', error: 'API Key not found for update' });
        }
      } else {
        key = await ApiKey.create(item);
        results.push({ id: key._id, status: 'created', data: key });
      }
    } catch (e) {
      results.push({ id: item._id || 'new', status: 'failed', error: e.message });
    }
  }
  await refreshSystemCache();
  res.json({ message: "Bulk key operation complete", results });
});

app.get('/api/admin/models', auth, isAdmin, async (req, res) => {
  res.json(await Model.find().sort({ provider: 1 }));
});

app.post('/api/admin/models', auth, isAdmin, async (req, res) => {
  try {
    const model = await Model.create(req.body);
    await refreshSystemCache();
    res.status(201).json(model);
  } catch (e) { res.status(400).json({ error: "Model ID must be unique" }); }
});

app.patch('/api/admin/models/:id/toggle', auth, isAdmin, async (req, res) => {
  const model = await Model.findById(req.params.id);
  model.isActive = !model.isActive;
  await model.save();
  await refreshSystemCache();
  res.json(model);
});

app.delete('/api/admin/models/:id', auth, isAdmin, async (req, res) => {
  await Model.findByIdAndDelete(req.params.id);
  await refreshSystemCache();
  res.sendStatus(204);
});

// Bulk Model Management
app.post('/api/admin/models/bulk', auth, isAdmin, async (req, res) => {
  const { models: modelData } = req.body;
  if (!Array.isArray(modelData)) {
    return res.status(400).json({ error: "Invalid input: expected an array of AI model objects." });
  }

  const results = [];
  for (const item of modelData) {
    try {
      let model;
      if (item._id) {
        model = await Model.findByIdAndUpdate(item._id, item, { new: true, runValidators: true });
        if (model) {
          results.push({ id: item._id, status: 'updated', data: model });
        } else {
          results.push({ id: item._id, status: 'failed', error: 'AI Model not found for update' });
        }
      } else {
        model = await Model.create(item);
        results.push({ id: model._id, status: 'created', data: model });
      }
    } catch (e) {
      results.push({ id: item._id || 'new', status: 'failed', error: e.message });
    }
  }
  await refreshSystemCache();
  res.json({ message: "Bulk model operation complete", results });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`sOuLTEXTit Neural Core Running on Port ${PORT}`));

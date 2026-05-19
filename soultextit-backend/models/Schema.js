const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: String,
  role: { type: String, default: 'user' }, // 'admin' or 'user'
  googleId: String
});

const ApiKeySchema = new mongoose.Schema({
  provider: { type: String, enum: ['gemini', 'groq', 'openai', 'anthropic'], required: true },
  key: { type: String, required: true },
  label: { type: String, default: 'Primary Key' },
  type: { type: String, enum: ['text', 'image', 'stt', 'general'], default: 'general' },
  isActive: { type: Boolean, default: true },
  priority: { type: Number, default: 0 }, // Higher is tried first
  usageStats: {
    totalRequests: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    lastUsed: Date
  },
  createdAt: { type: Date, default: Date.now }
});

const ModelSchema = new mongoose.Schema({
  modelId: { type: String, required: true, unique: true }, // e.g., "gemini-1.5-pro"
  displayName: String,
  provider: { type: String, enum: ['gemini', 'groq', 'openai'], required: true },
  category: { type: String, enum: ['text', 'image', 'stt'], required: true },
  capabilities: {
    vision: { type: Boolean, default: false },
    streaming: { type: Boolean, default: true },
    maxTokens: Number,
    contextWindow: Number
  },
  description: String,
  isActive: { type: Boolean, default: true },
  isDefault: { type: Boolean, default: false },
  priority: { type: Number, default: 0 }
});

const CanvasSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: { type: String, default: 'Untitled Masterpiece' },
  content: { type: String, default: '' },
  history: [{
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastModified: { type: Date, default: Date.now }
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  ApiKey: mongoose.model('ApiKey', ApiKeySchema),
  Model: mongoose.model('Model', ModelSchema),
  Canvas: mongoose.model('Canvas', CanvasSchema)
};

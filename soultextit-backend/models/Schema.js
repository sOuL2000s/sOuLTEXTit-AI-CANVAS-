const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: String,
  role: { type: String, default: 'user' }, 
  googleId: String,
  subscription: {
    plan: { type: String, enum: ['free', 'creative', 'quantum', 'omnicore'], default: 'free' },
    status: { type: String, default: 'active' },
    expiry: { type: Date, default: () => new Date(Date.now() + 3650 * 24 * 60 * 60 * 1000) },
    razorpay_payment_id: String,
    razorpay_subscription_id: String
  },
  usageStats: {
    aiEditsToday: { 
      count: { type: Number, default: 0 }, 
      date: { type: String, default: () => new Date().toDateString() } 
    },
    sttMinutesThisMonth: { 
      count: { type: Number, default: 0 }, 
      month: { type: Number, default: () => new Date().getMonth() } 
    },
    totalCanvases: { type: Number, default: 0 },
    totalDialogues: { type: Number, default: 0 }
  },
  preferences: {
    textModelId: String,
    sttModelId: String
  }
}, { minimize: false }); // Ensures empty sub-objects are persisted in DB

const ConversationSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  title: { type: String, default: 'New Conversation' },
  messages: [{
    role: { type: String, enum: ['user', 'assistant', 'system'] },
    content: String,
    timestamp: { type: Date, default: Date.now }
  }],
  lastModified: { type: Date, default: Date.now }
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
  Canvas: mongoose.model('Canvas', CanvasSchema),
  Conversation: mongoose.model('Conversation', ConversationSchema)
};

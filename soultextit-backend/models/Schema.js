const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  name: String,
  role: { type: String, default: 'user' }, // 'admin' or 'user'
  googleId: String
});

const ApiKeySchema = new mongoose.Schema({
  provider: { type: String, enum: ['gemini', 'groq'] },
  key: { type: String, required: true },
  type: { type: String, enum: ['text', 'image', 'stt'], default: 'text' },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const ModelSchema = new mongoose.Schema({
  name: String, // e.g., "gemini-1.5-pro", "llama-3.1-70b"
  provider: { type: String, enum: ['gemini', 'groq'] },
  type: { type: String, enum: ['text', 'image', 'stt'] },
  isDefault: { type: Boolean, default: false }
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

// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"], transports: ["websocket", "polling"] }
});

const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(bodyParser.json());
app.use(cors());

// ===== DATABASE CONNECTION =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// ===== SCHEMAS & MODELS =====
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  displayName: String,
  bio: String,
  gender: String,
  canPlayRecorded: { type: Boolean, default: false },
  online: { type: Boolean, default: false }
});
const User = mongoose.model('User', userSchema);

const postSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  content: String,
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  messages: [{
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: String, // 'text' or 'call'
    content: String,
    createdAt: { type: Date, default: Date.now }
  }],
  updatedAt: { type: Date, default: Date.now }
});
const Conversation = mongoose.model('Conversation', conversationSchema);

// ===== ROUTES =====

// Test endpoint
app.get("/", (req, res) => {
  res.send("Backend is working ✅");
});

// Signup
app.post("/signup", async (req, res) => {
  const { username, displayName, bio, gender } = req.body;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: "Username already taken" });

    const user = await User.create({ username, displayName, bio, gender });
    res.json({ message: "Signup successful", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
app.put("/users/:id", async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: "Profile updated", user: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a board post
app.post("/posts", async (req, res) => {
  try {
    const post = await Post.create(req.body);
    res.json({ message: "Post created", post });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all board posts
app.get("/posts", async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== SOCKET.IO CHAT =====
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Receive messages
  socket.on("send_message", async (data) => {
    const { senderId, receiverId, type, content } = data;
    try {
      // Find or create conversation
      let conversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] }
      });

      if (!conversation) {
        conversation = await Conversation.create({ participants: [senderId, receiverId], messages: [] });
      }

      const message = { senderId, type, content, createdAt: new Date() };
      conversation.messages.push(message);
      conversation.updatedAt = new Date();
      await conversation.save();

      // Emit to all clients
      io.emit("receive_message", message);
    } catch (err) {
      console.error("Error sending message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Get all conversations for a user (inbox)
app.get("/conversations/:userId", async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.params.userId
    }).sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full conversation by ID
app.get("/conversation/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    res.json(conversation);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== START SERVER =====
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

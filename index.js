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

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins; in production, set your frontend URL
    methods: ["GET", "POST"]
  },
  transports: ["websocket", "polling"]
});

const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

// ===== DATABASE CONNECTION =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
  process.exit(1); // stop server if DB connection fails
});

// ===== USER MODEL =====
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  displayName: { type: String, default: "" },
  bio: { type: String, default: "" },
  gender: { type: String, default: "" },
  canPlayRecorded: { type: Boolean, default: false }
}, { timestamps: true });

const User = mongoose.model("User", userSchema);

// ===== MESSAGE MODEL =====
const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const Message = mongoose.model("Message", messageSchema);

// ===== ROUTES =====
app.get("/", (req, res) => {
  res.send("Backend is working ✅");
});

// Signup route (now stores in MongoDB)
app.post("/signup", async (req, res) => {
  try {
    const { username, displayName, bio, gender } = req.body;

    if (!username) return res.status(400).json({ error: "Username required" });

    const existingUser = await User.findOne({ username });
    if (existingUser) return res.status(400).json({ error: "Username already taken" });

    const user = new User({ username, displayName, bio, gender });
    await user.save();

    res.json({ message: "Signup successful", user });
  } catch (err) {
    console.error("❌ Error in signup:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// Get all users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error("❌ Error fetching users:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ===== SOCKET.IO CHAT =====
io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  // Send all previous messages from MongoDB
  Message.find().then(msgs => {
    msgs.forEach(msg => socket.emit("receive_message", msg));
  });

  socket.on("send_message", async (data) => {
    try {
      const msg = new Message(data);
      await msg.save();
      io.emit("receive_message", msg);
    } catch (err) {
      console.error("❌ Error saving message:", err.message);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

// ===== START SERVER =====
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

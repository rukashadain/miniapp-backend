// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt"); // for password hashing
const User = require("./models/User"); // make sure you have this

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);

// ===== MIDDLEWARE =====
// Explicit CORS setup for mobile browsers
app.use(cors({
  origin: "*", // allow all origins
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(bodyParser.json());

// ===== SOCKET.IO =====
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type"] },
  transports: ["websocket", "polling"]
});

// ===== DATABASE CONNECTION =====
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// ===== SOCKET.IO CHAT =====
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ===== ROUTES =====

// Test endpoint
app.get("/", (req, res) => {
  res.send("Backend is running ✅");
});

// ===== BCRYPT TEST =====
app.get("/api/test-bcrypt", async (req, res) => {
  try {
    const testPassword = "123456";
    const hashed = await bcrypt.hash(testPassword, 10);
    const match = await bcrypt.compare(testPassword, hashed);

    res.json({
      success: match,
      message: match ? "Bcrypt is working ✅" : "Bcrypt failed ❌"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error testing bcrypt" });
  }
});

// Signup API
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({ email, password: hashedPassword, displayName });
    await user.save();

    res.json({ success: true, message: "Signup successful, please verify your email", userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Login API
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Incorrect password" });

    res.json({ success: true, message: "Login successful", userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Email verification placeholder
app.post("/api/verify-email", async (req, res) => {
  const { userId, code } = req.body;
  res.json({ success: true, message: "Email verified (placeholder)" });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

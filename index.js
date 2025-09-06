// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors"); // Added for REST endpoints
const http = require("http");
const { Server } = require("socket.io");

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
app.use(cors()); // enable CORS for REST routes

// ===== DATA STORAGE =====
let users = [];       // stores user profiles
let messages = [];    // stores chat messages

// ===== ROUTES =====

// Test endpoint
app.get("/", (req, res) => {
  res.send("Backend is working ✅");
});

// Signup route
app.post("/signup", (req, res) => {
  const { username, displayName, bio, gender } = req.body;

  if (!username) return res.status(400).json({ error: "Username required" });

  if (users.find(u => u.username === username)) {
    return res.status(400).json({ error: "Username already taken" });
  }

  const user = {
    id: users.length + 1,
    username,
    displayName: displayName || "",
    bio: bio || "",
    gender: gender || "",
    canPlayRecorded: false // default permission for recorded audio/video
  };

  users.push(user);
  res.json({ message: "Signup successful", user });
});

// Get all users
app.get("/users", (req, res) => {
  res.json(users);
});

// ===== SOCKET.IO CHAT =====
io.on("connection", (socket) => {
  console.log("User connected: " + socket.id);

  // Send all previous messages to newly connected user
  messages.forEach(msg => socket.emit("receive_message", msg));

  // Listen for new messages
  socket.on("send_message", (data) => {
    messages.push(data);
    io.emit("receive_message", data); // broadcast to all connected clients
  });

  socket.on("disconnect", () => {
    console.log("User disconnected: " + socket.id);
  });
});

// ===== START SERVER =====
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // for Daily.co API requests

// ===== FIREBASE ADMIN INIT WITH ENV VARS =====
admin.initializeApp({
  credential: admin.credential.cert({
    type: process.env.FB_TYPE,
    project_id: process.env.FB_PROJECT_ID,
    private_key_id: process.env.FB_PRIVATE_KEY_ID,
    private_key: process.env.FB_PRIVATE_KEY.replace(/\\n/g, "\n"), // fix newlines
    client_email: process.env.FB_CLIENT_EMAIL,
    client_id: process.env.FB_CLIENT_ID,
    auth_uri: process.env.FB_AUTH_URI,
    token_uri: process.env.FB_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.FB_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.FB_CLIENT_X509_CERT_URL,
  }),
});

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());
app.use(bodyParser.json());

// ===== SIMPLE TEST ROUTE =====
app.get("/", (req, res) => {
  res.send("Miniapp backend is running 🚀");
});

// ===== DAILY.CO ROOM CREATION =====
app.post("/api/create-room", async (req, res) => {
  try {
    const DAILY_API_KEY = process.env.DAILY_API_KEY;
    const roomName = "single-room"; // single room for all users

    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          enable_screenshare: true,
          start_video_off: true,
          start_audio_off: false
        }
      })
    });

    const data = await response.json();

    if (!response.ok) return res.status(400).json({ success: false, error: data });

    res.json({ success: true, room: data });
  } catch (err) {
    console.error("Error creating room:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== SOCKET.IO =====
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

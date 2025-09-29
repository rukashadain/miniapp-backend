// ===== IMPORTS =====
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // ensure installed: npm install node-fetch
require("dotenv").config();

// ===== APP SETUP =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== DAILY.CO CONFIG =====
const DAILY_API_KEY = process.env.DAILY_API_KEY; // put your Daily.co API key in Render env

// ===== ROUTES =====

// Health check
app.get("/", (req, res) => res.send("✅ Backend running for Daily.co calls"));

// Create Daily.co room
app.post("/api/create-room", async (req, res) => {
  const { roomName } = req.body;

  if (!roomName) {
    return res.status(400).json({ error: "Missing roomName" });
  }

  try {
    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          enable_screenshare: false,
          enable_chat: false,
          start_audio_off: false,
          start_video_off: true
        }
      })
    });

    const data = await response.json();
    res.json({ success: true, room: data });
  } catch (err) {
    console.error("Error creating Daily.co room:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Daily.co backend running on port ${PORT}`));

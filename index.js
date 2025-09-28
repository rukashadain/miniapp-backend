// ===== IMPORTS =====
const express = require("express");
const cors = require("cors");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
require("dotenv").config();

// ===== APP SETUP =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== AGORA CONFIG =====
const APP_ID = process.env.AGORA_APP_ID;               // from Render env
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE; // from Render env

// ===== ROUTES =====

// Health check
app.get("/", (req, res) => res.send("✅ Backend running for Agora calls"));

// Generate Agora token for client
app.post("/api/token", (req, res) => {
  const { channelName, uid } = req.body;

  if (!channelName || !uid) {
    return res.status(400).json({ error: "Missing channelName or uid" });
  }

  try {
    const expireTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      expireTime
    );

    res.json({ success: true, token, expireAt: expireTime });
  } catch (err) {
    console.error("Error generating token:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Agora backend running on port ${PORT}`));

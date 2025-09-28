// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const crypto = require("crypto");

// ===== FIREBASE SETUP =====
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ===== APP SETUP =====
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== ZEGOCLOUD CONFIG =====
const APP_ID = process.env.ZEGO_APP_ID;           // Set in Render env
const SERVER_SECRET = process.env.ZEGO_SERVER_SECRET; // Set in Render env

// ===== ROUTES =====

// Health check
app.get("/", (req, res) => res.send("Backend running ✅"));

// Fetch chat messages
app.get("/api/chats/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  const chatId = user1 < user2 ? `${user1}_${user2}` : `${user2}_${user1}`;
  try {
    const snapshot = await db
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .orderBy("timestamp")
      .get();
    const messages = snapshot.docs.map((doc) => doc.data());
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generate ZEGOCLOUD token for client
app.post("/api/generate-token", (req, res) => {
  const { userId, roomId } = req.body;
  if (!userId || !roomId) return res.status(400).json({ error: "Missing userId or roomId" });

  try {
    const now = Math.floor(Date.now() / 1000);
    const effectiveTimeInSeconds = 3600;

    // Create token (HMAC-SHA256)
    const message = `${APP_ID}${userId}${now + effectiveTimeInSeconds}${roomId}`;
    const token = crypto.createHmac("sha256", SERVER_SECRET).update(message).digest("base64");

    res.json({ success: true, token, expire: now + effectiveTimeInSeconds });
  } catch (err) {
    console.error("Error generating token:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

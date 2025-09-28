// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const admin = require("firebase-admin");
const { ZegoServerAssistant } = require("zego-express-engine-webrtc"); // Correct SDK for Node + WebRTC

// ===== FIREBASE SETUP =====
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);

// ===== MIDDLEWARE =====
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

// ===== ZEGOCLOUD CONFIG =====
const APP_ID = parseInt(process.env.ZEGO_APP_ID);
const SERVER_SECRET = process.env.ZEGO_SERVER_SECRET;

// ===== ROUTES =====

// Health check
app.get("/", (req, res) => {
  res.send("Backend running ✅");
});

// Fetch chat messages between two users
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

// Generate Zego token for client
app.post("/api/generate-token", (req, res) => {
  const { userId, roomId } = req.body;

  if (!userId || !roomId) {
    return res.status(400).json({ success: false, error: "Missing userId or roomId" });
  }

  try {
    const effectiveTimeInSeconds = 3600; // token valid 1 hour
    const payload = "";
    const token = ZegoServerAssistant.generateToken04(
      APP_ID,
      userId,
      SERVER_SECRET,
      effectiveTimeInSeconds,
      payload
    );
    res.json({ success: true, token });
  } catch (err) {
    console.error("Error generating token:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

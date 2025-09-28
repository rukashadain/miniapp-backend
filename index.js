// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const ZeCloud = require("zecloud");
const admin = require("firebase-admin");

// ===== FIREBASE SETUP =====
// Make sure you set FIREBASE_SERVICE_ACCOUNT as env variable on Render
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const chatsCollection = db.collection("chats");

// ===== ZECloud SETUP =====
// Use your ZeCloud App ID and Server Secret
const ZECLOUD_APP_ID = "1152199605";
const ZECLOUD_SERVER_SECRET = "92b71f7fd91ce7b37c4c94759405fd7b";

const zecloud = new ZeCloud({
  appId: ZECLOUD_APP_ID,
  serverSecret: ZECLOUD_SERVER_SECRET
});

// ===== APP SETUP =====
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== ROUTES =====
app.get("/", (req, res) => res.send("Backend running ✅"));

// Generate ZeCloud token for a call
app.post("/api/zecloud/token", (req, res) => {
  const { userId, channel } = req.body;
  if (!userId || !channel) return res.status(400).json({ error: "Missing userId or channel" });

  try {
    const token = zecloud.generateToken({
      uid: userId.toString(),
      channelName: channel,
      role: "publisher",
      expireTime: 3600 // seconds
    });
    res.json({ token });
  } catch (err) {
    console.error("ZeCloud token error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Fetch chat messages from Firestore
app.get("/api/chats/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  const chatId = user1 < user2 ? `${user1}_${user2}` : `${user2}_${user1}`;

  try {
    const snapshot = await chatsCollection.doc(chatId).collection("messages")
      .orderBy("timestamp").get();
    const messages = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save chat message
app.post("/api/chats/send", async (req, res) => {
  const { senderId, receiverId, type, text, url } = req.body;
  if (!senderId || !receiverId) return res.status(400).json({ error: "Missing sender or receiver" });

  const chatId = senderId < receiverId ? `${senderId}_${receiverId}` : `${receiverId}_${senderId}`;
  const chatRef = chatsCollection.doc(chatId).collection("messages");

  try {
    await chatRef.add({
      senderId,
      receiverId,
      type: type || "text",
      text: text || "",
      url: url || "",
      timestamp: Date.now()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

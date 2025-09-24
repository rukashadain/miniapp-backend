// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const admin = require("firebase-admin");

// ===== FIREBASE SETUP =====
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const usersCollection = db.collection("users"); // for user info
const messagesCollection = db.collection("messages"); // for chat messages

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);

// ===== MIDDLEWARE =====
app.use(cors({ origin: "*", methods: ["GET","POST"], allowedHeaders: ["Content-Type"] }));
app.use(bodyParser.json());

// ===== SOCKET.IO =====
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

// Map userId → socket.id
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Track user when they join
  socket.on("join", ({ userId }) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} connected with socket ${socket.id}`);
  });

  // Receive chat message
  socket.on("chat-message", async ({ userId, targetUid, message }) => {
    const timestamp = Date.now();

    // Save to Firestore
    try {
      await messagesCollection.add({ userId, targetUid, message, timestamp });
    } catch (err) {
      console.error("Error saving message:", err);
    }

    // Send message to recipient if online
    const targetSocket = onlineUsers.get(targetUid);
    if (targetSocket) {
      io.to(targetSocket).emit("chat-message", { userId, message, timestamp });
    }

    // Also send to sender
    socket.emit("chat-message", { userId, message, timestamp });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Remove disconnected socket from map
    for (let [uid, sId] of onlineUsers) {
      if (sId === socket.id) onlineUsers.delete(uid);
    }
  });
});

// ===== ROUTES =====
app.get("/", (req, res) => res.send("Backend running ✅"));

// Fetch chat history between two users
app.get("/api/messages/:uid1/:uid2", async (req, res) => {
  const { uid1, uid2 } = req.params;
  try {
    const snapshot = await messagesCollection
      .where("userId", "in", [uid1, uid2])
      .orderBy("timestamp")
      .get();

    const messages = snapshot.docs
      .map(doc => doc.data())
      .filter(m => (m.userId === uid1 && m.targetUid === uid2) || (m.userId === uid2 && m.targetUid === uid1));

    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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
const chatsCollection = db.collection("chats");

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);

// ===== MIDDLEWARE =====
app.use(cors({ origin: "*", methods: ["GET","POST"] }));
app.use(bodyParser.json());

// ===== SOCKET.IO =====
const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

// Map userId → socket.id
const onlineUsers = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", ({ userId }) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} connected`);
  });

  socket.on("send-message", async ({ senderId, receiverId, message }) => {
    const timestamp = Date.now();
    const chatId = senderId < receiverId ? `${senderId}_${receiverId}` : `${receiverId}_${senderId}`;
    const chatRef = chatsCollection.doc(chatId).collection("messages");

    // Save message
    try {
      await chatRef.add({ senderId, message, timestamp });
    } catch (err) {
      console.error("Error saving message:", err);
    }

    // Emit to sender & receiver
    const payload = { senderId, message, timestamp };
    socket.emit("receive-message", payload);
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) io.to(receiverSocket).emit("receive-message", payload);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (let [uid, sId] of onlineUsers) {
      if (sId === socket.id) onlineUsers.delete(uid);
    }
  });
});

// ===== ROUTES =====
app.get("/", (req, res) => res.send("Backend running ✅"));

// Fetch chat messages
app.get("/api/chats/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;
  const chatId = user1 < user2 ? `${user1}_${user2}` : `${user2}_${user1}`;
  try {
    const snapshot = await chatsCollection.doc(chatId).collection("messages").orderBy("timestamp").get();
    const messages = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Receive chat message
  socket.on("chat-message", async (data) => {
    const { userId, message } = data;

    // Broadcast to everyone
    io.emit("chat-message", { userId, message, timestamp: Date.now() });

    // Save to Firestore
    try {
      await messagesCollection.add({
        userId,
        message,
        timestamp: Date.now()
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

// ===== ROUTES =====
app.get("/", (req, res) => res.send("Backend running ✅"));

// Fetch chat history
app.get("/api/messages", async (req, res) => {
  try {
    const snapshot = await messagesCollection.orderBy("timestamp").get();
    const messages = snapshot.docs.map(doc => doc.data());
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

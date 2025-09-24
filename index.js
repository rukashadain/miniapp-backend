// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const admin = require("firebase-admin");

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
app.use(cors({
  origin: "*",
  methods: ["GET","POST","PUT","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(bodyParser.json());

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"], allowedHeaders: ["Content-Type"] },
  transports: ["websocket","polling"]
});

// ===== SOCKET.IO CHAT LOGIC =====
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join a room
  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId}`);
  });

  // Receive chat message
  socket.on("chatMessage", async ({ roomId, senderId, message }) => {
    try {
      const timestamp = Date.now();

      // Store message in Firestore
      await db.collection("chats").doc(roomId)
              .collection("messages").add({ senderId, message, timestamp });

      // Broadcast to room
      io.to(roomId).emit("chatMessage", { senderId, message, timestamp });
    } catch(err) {
      console.error("Error saving message:", err);
    }
  });

  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

// ===== HELPER TO GET USER COLLECTION BASED ON GENDER =====
const getUserCollection = (gender) => {
  if (!gender) return db.collection("users");
  return gender.toLowerCase() === "male" ? db.collection("maleUsers") : db.collection("femaleUsers");
};

// ===== ROUTES =====
app.get("/", (req, res) => res.send("Backend is running ✅"));

// ===== SIGNUP =====
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, displayName, gender } = req.body;
    if (!email || !password || !gender)
      return res.status(400).json({ success: false, message: "Email, password and gender required" });

    const usersCollection = getUserCollection(gender);
    const snapshot = await usersCollection.where("email", "==", email).get();
    if (!snapshot.empty) return res.status(400).json({ success: false, message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const userRef = await usersCollection.add({
      email,
      password: hashedPassword,
      displayName: displayName || "",
      gender
    });

    res.json({ success: true, message: "Signup successful!", userId: userRef.id });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== LOGIN =====
app.post("/api/login", async (req, res) => {
  try {
    const { email, password, gender } = req.body;
    if (!email || !password || !gender)
      return res.status(400).json({ success: false, message: "Email, password and gender required" });

    const usersCollection = getUserCollection(gender);
    const snapshot = await usersCollection.where("email", "==", email).get();
    if (snapshot.empty) return res.status(400).json({ success: false, message: "User not found" });

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const isMatch = await bcrypt.compare(password, userData.password || "");
    if (!isMatch) return res.status(400).json({ success: false, message: "Incorrect password" });

    res.json({ success: true, message: "Login successful", userId: userDoc.id });
  } catch(err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== GET USER PROFILE =====
app.get("/api/user/:gender/:userId", async (req, res) => {
  try {
    const { gender, userId } = req.params;
    const usersCollection = getUserCollection(gender);
    const userDoc = await usersCollection.doc(userId).get();
    if (!userDoc.exists) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, data: userDoc.data() });
  } catch(err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== FIRESTORE TEST =====
app.get("/api/test-firestore", async (req, res) => {
  try {
    const testDoc = db.collection("test").doc("ping");
    await testDoc.set({ message: "Hello from Render", timestamp: Date.now() });
    const snap = await testDoc.get();
    res.json({ success: true, data: snap.data() });
  } catch(err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Firestore test failed", error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

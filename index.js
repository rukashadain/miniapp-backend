// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const admin = require("firebase-admin");

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);

// ===== MIDDLEWARE =====
app.use(cors());
app.use(bodyParser.json());

// ===== SOCKET.IO SETUP =====
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET","POST"], allowedHeaders: ["Content-Type"] },
  transports: ["websocket","polling"]
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.on("disconnect", () => console.log("User disconnected:", socket.id));
});

// ===== FIREBASE INIT =====
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ===== ROUTES =====
app.get("/", (req, res) => res.send("Backend is running ✅"));

// ===== SIGNUP API =====
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });

    const userRef = db.collection("users").doc(email);
    const doc = await userRef.get();
    if (doc.exists) return res.status(400).json({ success: false, message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await userRef.set({ email, password: hashedPassword, displayName });

    res.json({ success: true, message: "Signup successful!", userId: email });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== LOGIN API =====
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });

    const userRef = db.collection("users").doc(email);
    const doc = await userRef.get();
    if (!doc.exists) return res.status(400).json({ success: false, message: "User not found" });

    const user = doc.data();
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Incorrect password" });

    res.json({ success: true, message: "Login successful", userId: email });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;

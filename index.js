// ===== IMPORTS =====
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcrypt");
const admin = require("firebase-admin");

// ===== FIREBASE SETUP =====
// Ensure your Render environment variable FBASE_KEY contains the full JSON string of your service account
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FBASE_KEY);
} catch (err) {
  console.error("❌ Failed to parse FBASE_KEY:", err);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const usersCollection = db.collection("users");

// ===== APP SETUP =====
const app = express();
const server = http.createServer(app);

// ===== MIDDLEWARE =====
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
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

// ===== ROUTES =====
app.get("/", (req, res) => res.send("Backend is running ✅"));

// ===== SIGNUP API =====
app.post("/api/signup", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });

    const snapshot = await usersCollection.where("email", "==", email).get();
    if (!snapshot.empty) return res.status(400).json({ success: false, message: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRef = await usersCollection.add({ email, password: hashedPassword, displayName });

    res.json({ success: true, message: "Signup successful! Proceed to verify your email.", userId: userRef.id });
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

    const snapshot = await usersCollection.where("email", "==", email).get();
    if (snapshot.empty) return res.status(400).json({ success: false, message: "User not found" });

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const isMatch = await bcrypt.compare(password, userData.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Incorrect password" });

    res.json({ success: true, message: "Login successful", userId: userDoc.id });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== EMAIL VERIFICATION PLACEHOLDER =====
app.post("/api/verify-email", async (req, res) => {
  res.json({ success: true, message: "Email verified (placeholder)" });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;

// ===== IMPORTS =====
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch"); // npm install node-fetch
const admin = require("firebase-admin");
require("dotenv").config();

// ===== APP SETUP =====
const app = express();
app.use(cors());
app.use(express.json());

// ===== FIREBASE ADMIN =====
const serviceAccount = require("./serviceAccountKey.json"); // your Firebase Admin SDK JSON
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// ===== DAILY.CO CONFIG =====
const DAILY_API_KEY = process.env.DAILY_API_KEY;

// ===== ROUTES =====

// Health check
app.get("/", (req, res) => res.send("✅ Backend running"));

// Fetch users for Home page
app.get("/api/users/:uid", async (req, res) => {
  const currentUid = req.params.uid;
  try {
    // Determine current user's collection
    let meDoc = await db.collection("maleUsers").doc(currentUid).get();
    let currentCollection = "maleUsers";
    let oppositeCollection = "femaleUsers";

    if (!meDoc.exists) {
      meDoc = await db.collection("femaleUsers").doc(currentUid).get();
      currentCollection = "femaleUsers";
      oppositeCollection = "maleUsers";
    }

    if (!meDoc.exists) {
      return res.status(404).json({ success: false, error: "Current user not found" });
    }

    const me = meDoc.data();

    // Update lastActive
    await db.collection(currentCollection).doc(currentUid).update({
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });

    // Fetch opposite users
    const snapshot = await db.collection(oppositeCollection).get();
    const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

    res.json({ success: true, me, users });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create Daily.co room
app.post("/api/create-room", async (req, res) => {
  const { roomName } = req.body;

  if (!roomName) {
    return res.status(400).json({ error: "Missing roomName" });
  }

  try {
    const response = await fetch("https://api.daily.co/v1/rooms", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${DAILY_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: roomName,
        properties: {
          enable_screenshare: false,
          enable_chat: false,
          start_audio_off: false,
          start_video_off: true
        }
      })
    });

    const data = await response.json();
    res.json({ success: true, room: data });
  } catch (err) {
    console.error("Error creating Daily.co room:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));

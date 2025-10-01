// index.js
// Backend for signaling + Agora token generation (audio call flow)
// Uses: express, socket.io, agora-access-token
// npm install express socket.io cors body-parser agora-access-token

const express = require("express");
const http = require("http");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Server } = require("socket.io");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");

// ---- CONFIG ----
// Use env vars if present, otherwise fall back to provided values.
// IMPORTANT: In production, set AGORA_APP_ID and AGORA_APP_CERT in env vars.
const APP_ID = process.env.AGORA_APP_ID || "16076b5386474034b54ea79a663c7106";
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE || "b93ed45b7e0e4b6e8eaf37ef55a4205b";

// Port
const PORT = process.env.PORT || 5000;

// ---- APP SETUP ----
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(bodyParser.json());

// ---- In-memory store (simple) ----
// For production use a persistent DB to avoid loss on restart.
const calls = {}; // { callId: { channelName, callerId, calleeId, status } }
// Socket user map: userId -> socket.id(s)
// We'll allow multiple sockets per user (e.g. multiple tabs / devices)
const userSockets = {}; // { userId: Set(socketId) }

function registerSocketForUser(userId, socketId) {
  if (!userSockets[userId]) userSockets[userId] = new Set();
  userSockets[userId].add(socketId);
}
function unregisterSocketForUser(userId, socketId) {
  if (!userSockets[userId]) return;
  userSockets[userId].delete(socketId);
  if (userSockets[userId].size === 0) delete userSockets[userId];
}
function emitToUser(userId, event, payload) {
  const set = userSockets[userId];
  if (!set) return;
  for (const sId of set) {
    io.to(sId).emit(event, payload);
  }
}

// ---- Helpers: Agora token generation ----
function generateAgoraToken(channelName, uid) {
  // uid can be string or number. For buildTokenWithUid, pass number or 0 for app certificateless.
  const ttl = 3600; // token lifetime in seconds
  const now = Math.floor(Date.now() / 1000);
  const privilegeExpireTs = now + ttl;
  // If uid is numeric string, convert to number, otherwise pass 0 and generate token with account? We'll use buildTokenWithUid and pass uid as integer if possible.
  let uidNum = 0;
  if (typeof uid === "number") uidNum = uid;
  else if (!isNaN(Number(uid))) uidNum = Number(uid);
  else uidNum = 0; // fallback
  return RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uidNum,
    RtcRole.PUBLISHER,
    privilegeExpireTs
  );
}

// ---- REST endpoints ----

// Health
app.get("/", (req, res) => res.send("✅ Agora-call backend running"));

// Optional: token-only endpoint (client can request token for a given channel+uid)
app.post("/api/token", (req, res) => {
  const { channelName, uid } = req.body || {};
  if (!channelName || typeof uid === "undefined") {
    return res.status(400).json({ success: false, error: "Missing channelName or uid" });
  }
  try {
    const token = generateAgoraToken(channelName, uid);
    return res.json({ success: true, token, expireAt: Math.floor(Date.now()/1000) + 3600 });
  } catch (err) {
    console.error("Token error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start a call: caller requests backend to create call and notify callee
// Body: { callerId, calleeId, requestedChannel }  (requestedChannel optional)
app.post("/api/start-call", (req, res) => {
  const { callerId, calleeId, requestedChannel } = req.body || {};
  if (!callerId || !calleeId) {
    return res.status(400).json({ success: false, error: "Missing callerId or calleeId" });
  }

  // create channel name (deterministic or unique)
  const channelName = requestedChannel || `call_${callerId}_${calleeId}_${Date.now()}`;
  const callId = channelName; // using channelName as callId for simplicity

  // create token for caller (uid = callerId)
  const token = generateAgoraToken(channelName, callerId);

  // store call
  calls[callId] = {
    channelName,
    callerId,
    calleeId,
    status: "ringing", // ringing | accepted | rejected | ended
    createdAt: Date.now()
  };

  // notify callee via sockets (if online)
  emitToUser(calleeId, "incomingCall", {
    callId,
    channelName,
    from: callerId,
    timestamp: Date.now()
  });

  // respond to caller with call info and token
  return res.json({ success: true, callId, channelName, token });
});

// Callee accepts call: callee asks backend for token and the backend broadcasts accepted
// Body: { callId, calleeId }
app.post("/api/accept-call", (req, res) => {
  const { callId, calleeId } = req.body || {};
  if (!callId || !calleeId) return res.status(400).json({ success: false, error: "Missing callId or calleeId" });
  const call = calls[callId];
  if (!call) return res.status(404).json({ success: false, error: "Call not found" });
  if (call.calleeId !== calleeId) return res.status(403).json({ success: false, error: "Not callee" });

  call.status = "accepted";
  call.acceptedAt = Date.now();

  // generate token for callee
  const token = generateAgoraToken(call.channelName, calleeId);

  // notify caller that callee accepted
  emitToUser(call.callerId, "callAccepted", { callId, channelName: call.channelName, from: calleeId });

  return res.json({ success: true, callId, channelName: call.channelName, token });
});

// Callee rejects call
// Body: { callId, calleeId }
app.post("/api/reject-call", (req, res) => {
  const { callId, calleeId } = req.body || {};
  if (!callId || !calleeId) return res.status(400).json({ success: false, error: "Missing callId or calleeId" });
  const call = calls[callId];
  if (!call) return res.status(404).json({ success: false, error: "Call not found" });
  if (call.calleeId !== calleeId) return res.status(403).json({ success: false, error: "Not callee" });

  call.status = "rejected";
  call.endedAt = Date.now();

  // notify caller
  emitToUser(call.callerId, "callRejected", { callId, from: calleeId });
  return res.json({ success: true });
});

// End call (either side)
// Body: { callId, userId }
app.post("/api/end-call", (req, res) => {
  const { callId, userId } = req.body || {};
  if (!callId || !userId) return res.status(400).json({ success: false, error: "Missing callId or userId" });
  const call = calls[callId];
  if (!call) return res.status(404).json({ success: false, error: "Call not found" });

  call.status = "ended";
  call.endedAt = Date.now();

  // notify both sides
  emitToUser(call.callerId, "callEnded", { callId, by: userId });
  emitToUser(call.calleeId, "callEnded", { callId, by: userId });

  return res.json({ success: true });
});

// ---- Socket.IO signaling ----
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // client should register with its userId after connecting:
  // socket.emit('register', { userId: 'firebaseUid' })
  socket.on("register", (payload) => {
    const userId = (payload && payload.userId) || payload; // accept plain or object
    if (!userId) return;
    registerSocketForUser(userId, socket.id);
    socket.data.userId = userId;
    console.log(`Socket ${socket.id} registered for user ${userId}`);
  });

  // Dial using sockets directly (alternative to REST /start-call)
  // payload: { callerId, calleeId, channelName? }
  socket.on("call-user", (payload) => {
    const { callerId, calleeId, channelName } = payload || {};
    if (!callerId || !calleeId) return;
    const channel = channelName || `call_${callerId}_${calleeId}_${Date.now()}`;
    const callId = channel;
    // create token for caller
    const token = generateAgoraToken(channel, callerId);
    calls[callId] = { channelName: channel, callerId, calleeId, status: "ringing", createdAt: Date.now() };
    // notify callee
    emitToUser(calleeId, "incomingCall", { callId, channelName: channel, from: callerId });
    // ack to caller with token + callId
    socket.emit("call-initiated", { callId, channelName: channel, token });
  });

  // Accept via sockets
  socket.on("accept-call", (payload) => {
    const { callId, calleeId } = payload || {};
    if (!callId || !calleeId) return;
    const call = calls[callId];
    if (!call) return;
    call.status = "accepted";
    call.acceptedAt = Date.now();
    // generate token for callee
    const token = generateAgoraToken(call.channelName, calleeId);
    // notify caller and callee
    emitToUser(call.callerId, "callAccepted", { callId, channelName: call.channelName, from: calleeId });
    emitToUser(call.calleeId, "callAccepted", { callId, channelName: call.channelName, from: calleeId, token });
  });

  // Reject via sockets
  socket.on("reject-call", (payload) => {
    const { callId, calleeId } = payload || {};
    if (!callId || !calleeId) return;
    const call = calls[callId];
    if (!call) return;
    call.status = "rejected";
    call.endedAt = Date.now();
    emitToUser(call.callerId, "callRejected", { callId, from: calleeId });
  });

  // Leave / disconnect
  socket.on("disconnect", () => {
    const uid = socket.data && socket.data.userId;
    if (uid) unregisterSocketForUser(uid, socket.id);
    console.log("Socket disconnected:", socket.id, "user:", uid);
  });
});

// ---- Start server ----
server.listen(PORT, () => {
  console.log(`Agora call backend listening on port ${PORT}`);
  console.log(`APP_ID: ${APP_ID} (hide certificate in env for production)`);
});

import express from "express";
import { RtcTokenBuilder, RtcRole } from "agora-access-token";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// ===== Simple health check =====
app.get("/", (req, res) => {
  res.send("Agora backend running 🚀");
});

// ===== RTC Token generation =====
app.get("/rtc-token/:channelName/:uid", (req, res) => {
  try {
    const { channelName, uid } = req.params;
    const role = RtcRole.PUBLISHER; // users can speak/send video
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);

    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.AGORA_APP_ID,
      process.env.AGORA_APP_CERTIFICATE,
      channelName,
      parseInt(uid),
      role,
      currentTimestamp + expirationTimeInSeconds
    );

    res.json({ token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate token" });
  }
});

// ===== Start server =====
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

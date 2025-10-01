import express from 'express';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const { AGORA_APP_ID, AGORA_APP_CERTIFICATE } = process.env;

// Token generation endpoint
app.get('/rtc-token/:channelName/:uid', (req, res) => {
  const { channelName, uid } = req.params;
  const role = RtcRole.PUBLISHER;       // role = publisher (can speak)
  const expirationTime = 3600;           // 1 hour
  const currentTimestamp = Math.floor(Date.now() / 1000);

  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERTIFICATE,
    channelName,
    parseInt(uid),
    role,
    currentTimestamp + expirationTime
  );

  res.json({ token });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

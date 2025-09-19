const mongoose = require("mongoose");

// Define the User schema
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password: { type: String },       // hashed password for email signup
  displayName: { type: String, default: "" },
  socialId: { type: String },       // for Telegram/Google login
  verified: { type: Boolean, default: false }, // email verified
  createdAt: { type: Date, default: Date.now }
});

// Ensure unique index for email
UserSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model("User", UserSchema);

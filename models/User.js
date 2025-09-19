// /models/User.js
const mongoose = require("mongoose");

// Define the User schema
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true }, // user email
  password: { type: String },       // hashed password for email signup
  displayName: { type: String },    // user profile name
  socialId: { type: String },       // for Telegram/Google login
  verified: { type: Boolean, default: false }, // email verified status
  createdAt: { type: Date, default: Date.now } // signup timestamp
});

// Export the model
module.exports = mongoose.model("User", UserSchema);

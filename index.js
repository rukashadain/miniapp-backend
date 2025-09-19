// ===== SIGNUP API =====
app.post("/api/signup", async (req, res) => {
  try {
    let { email, password, displayName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    // Normalize email
    email = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashedPassword, displayName: displayName || "" });

    await user.save();
    res.json({ success: true, message: "Signup successful, please verify your email", userId: user._id });

  } catch (err) {
    console.error("Signup error:", err);

    // Catch duplicate key error safely
    if (err.code === 11000 && err.keyPattern.email) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ===== LOGIN API =====
app.post("/api/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    // Normalize email
    email = email.trim().toLowerCase();

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Incorrect password" });

    res.json({ success: true, message: "Login successful", userId: user._id });

  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

const express = require('express');
const router = express.Router();
const User = require('../models/User'); 

// --- 🚨 THE FIX: KILL THE GHOST INDEX 🚨 ---
// We wrap this in a small timeout or wait for the connection in server.js 
// but keeping it here is fine for a quick fix to remove 'mobile' requirements.
User.collection.dropIndex('mobile_1').catch(err => {
    // If the index doesn't exist, we just ignore the error.
});

// 1. SIGNUP
router.post('/signup', async (req, res) => {
  console.log("📝 Signup Attempt:", req.body);
  
  try {
    const { username, name, email, password, secretKey } = req.body;

    // Map username/name so the database always gets a valid string
    const finalUsername = username || name;

    // 🚨 SAFETY NET: Validation
    if (!finalUsername || !email || !password) {
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // DETERMINE ROLE (Secret key for 2024 Admin)
    let role = 'user';
    if (secretKey === 'feedtrace_admin_2024') { 
      role = 'admin';
      console.log("🔐 Admin Secret Key Matched!");
    }

    const newUser = new User({
      username: finalUsername,
      email,
      password, // Note: In production, use bcrypt to hash this!
      role: role
    });

    await newUser.save();
    console.log(`✅ User Created: ${newUser.username} | Role: ${newUser.role}`);
    
    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("❌ Signup Error:", err);
    res.status(500).json({ error: "Server error during signup" });
  }
});

// 2. LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });
    if (password !== user.password) return res.status(400).json({ error: "Invalid password" });

    console.log("✅ Login Success:", user.username);

    res.json({
      message: "Login Successful",
      username: user.username,
      role: user.role, 
      userId: user._id
    });
  } catch (err) {
    res.status(500).json({ error: "Server error during login" });
  }
});

// 3. GET ALL USERS (Fixes Dashboard 404 & Count)
// This route is called by Dashboard.jsx to show the Total Users count
router.get('/users', async (req, res) => {
  try {
    // We select everything EXCEPT the password for security
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    console.error("❌ Fetch Users Error:", err);
    res.status(500).json({ error: "Failed to fetch users list" });
  }
});

module.exports = router;
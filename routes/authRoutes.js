const express = require('express');
const router = express.Router();
const User = require('../models/User'); 

// --- 🚨 THE FIX: KILL THE GHOST INDEX 🚨 ---
// This silently removes the old 'mobile' requirement from MongoDB's memory
User.collection.dropIndex('mobile_1').catch(err => {
  // We ignore errors here because if the index is already gone, we don't care!
});
// ------------------------------------------

// 1. SIGNUP
router.post('/signup', async (req, res) => {
  console.log("📝 Signup Attempt:", req.body);
  
  try {
    // 1. Destructure 'name' as well, just in case the frontend sends the old format
    const { username, name, email, password, secretKey } = req.body;

    // 2. Map it so the database always gets what it expects
    const finalUsername = username || name;

    // 🚨 SAFETY NET: Prevent the 500 Crash!
    if (!finalUsername || !email || !password) {
      console.log("❌ Missing required fields");
      return res.status(400).json({ error: "Username, email, and password are required." });
    }

    // 3. Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists with this email" });
    }

    // 4. DETERMINE ROLE
    let role = 'user';
    if (secretKey === 'feedtrace_admin_2024') { 
      role = 'admin';
      console.log("🔐 Admin Secret Key Matched! Creating Admin Account...");
    }

    // 5. Create New User 
    const newUser = new User({
      username: finalUsername, // Guaranteed to have a value now
      email,
      password, 
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

// 2. LOGIN (Unchanged)
router.post('/login', async (req, res) => {
  console.log("🔑 Login Attempt:", req.body);

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found in DB");
      return res.status(404).json({ error: "User not found" });
    }

    if (password !== user.password) {
      console.log("❌ Password mismatch");
      return res.status(400).json({ error: "Invalid password" });
    }

    console.log("✅ Login Success for:", user.username);

    res.json({
      message: "Login Successful",
      username: user.username,
      role: user.role, 
      userId: user._id
    });

  } catch (err) {
    console.error("❌ Login Error:", err);
    res.status(500).json({ error: "Server error during login" });
  }
});

// 3. GET ALL USERS (For Admin Dashboard)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
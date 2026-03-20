const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');

// 1. GET ACTIVE ADS (For the User Frontend)
router.get('/active', async (req, res) => {
  try {
    // 🌟 Sort by newest first
    const activeAds = await Ad.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(activeAds || []); // Always return an array
  } catch (err) {
    console.error("❌ Fetch Active Ads Error:", err);
    res.status(500).json({ error: "Failed to fetch active ads" });
  }
});

// 2. GET ALL ADS (For Admin Dashboard)
router.get('/all', async (req, res) => {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 });
    res.status(200).json(ads || []);
  } catch (err) { 
    console.error("❌ Fetch All Ads Error:", err);
    res.status(500).json({ error: "Failed to fetch all ads" }); 
  }
});

// 3. ADD NEW AD (Admin)
router.post('/add', async (req, res) => {
  try {
    const { title, imageUrl, link } = req.body;

    // 🚨 VALIDATION: Ensure we don't save broken data to Atlas
    if (!title || !imageUrl) {
      return res.status(400).json({ error: "Title and Image URL are required." });
    }

    const newAd = new Ad({
      title,
      imageUrl,
      link: link || '',
      isActive: true // Default to active on creation
    });

    await newAd.save();
    console.log("✅ Ad Created Successfully");
    res.status(201).json({ message: "Ad created successfully", ad: newAd });
  } catch (err) { 
    console.error("❌ Create Ad Error:", err);
    res.status(500).json({ error: "Server error while creating ad" }); 
  }
});

// 4. DELETE AD (Admin)
router.delete('/:id', async (req, res) => {
  try {
    const deletedAd = await Ad.findByIdAndDelete(req.params.id);
    if (!deletedAd) {
      return res.status(404).json({ error: "Ad not found" });
    }
    res.json({ message: "Ad deleted successfully" });
  } catch (err) { 
    res.status(500).json({ error: "Error deleting ad" }); 
  }
});

// 5. TOGGLE STATUS (Admin)
router.put('/:id/toggle', async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ error: "Ad not found" });
    }

    ad.isActive = !ad.isActive;
    await ad.save();
    
    res.json({ 
      message: `Ad is now ${ad.isActive ? 'Active' : 'Inactive'}`, 
      isActive: ad.isActive 
    });
  } catch (err) { 
    res.status(500).json({ error: "Error toggling ad status" }); 
  }
});

module.exports = router;
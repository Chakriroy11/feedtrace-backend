const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');

// 1. GET ACTIVE ADS (For User Frontend)
router.get('/active', async (req, res) => {
  try {
    const activeAds = await Ad.find({ isActive: true }).sort({ createdAt: -1 });
    res.status(200).json(activeAds || []);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch active ads" });
  }
});

// 2. GET ALL ADS (For Admin Dashboard)
router.get('/all', async (req, res) => {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 });
    res.status(200).json(ads || []);
  } catch (err) { 
    res.status(500).json({ error: "Failed to fetch all ads" }); 
  }
});

// 3. ADD NEW AD (Admin) - FIXED NAMES HERE 🚀
router.post('/add', async (req, res) => {
  try {
    // We pull the exact names sent by the frontend
    const { sponsorName, bannerImage, couponCode, discountText } = req.body;

    // Validation using the correct schema names
    if (!sponsorName || !bannerImage || !couponCode || !discountText) {
      return res.status(400).json({ error: "All fields (Sponsor, Logo, Code, and Offer) are required." });
    }

    const newAd = new Ad({
      sponsorName,
      bannerImage,
      couponCode,
      discountText,
      isActive: true 
    });

    await newAd.save();
    res.status(201).json({ message: "Campaign launched successfully!", ad: newAd });
  } catch (err) { 
    console.error("Create Ad Error:", err);
    res.status(500).json({ error: "Server error while creating ad" }); 
  }
});

// 4. DELETE AD
router.delete('/:id', async (req, res) => {
  try {
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ message: "Ad deleted successfully" });
  } catch (err) { 
    res.status(500).json({ error: "Error deleting ad" }); 
  }
});

// 5. TOGGLE STATUS
router.put('/:id/toggle', async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) return res.status(404).json({ error: "Ad not found" });

    ad.isActive = !ad.isActive;
    await ad.save();
    res.json({ message: "Status updated", isActive: ad.isActive });
  } catch (err) { 
    res.status(500).json({ error: "Error toggling status" }); 
  }
});

module.exports = router;
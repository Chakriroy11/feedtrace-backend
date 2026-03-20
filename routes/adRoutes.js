const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');

// 1. GET ACTIVE ADS (For the User Frontend)
router.get('/active', async (req, res) => {
  try {
    const activeAds = await Ad.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(activeAds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET ALL ADS (For Admin Dashboard)
router.get('/all', async (req, res) => {
  try {
    const ads = await Ad.find().sort({ createdAt: -1 });
    res.json(ads);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 3. ADD NEW AD (Admin)
router.post('/add', async (req, res) => {
  try {
    const newAd = new Ad(req.body);
    await newAd.save();
    res.status(201).json({ message: "Ad created successfully" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4. DELETE AD (Admin)
router.delete('/:id', async (req, res) => {
  try {
    await Ad.findByIdAndDelete(req.params.id);
    res.json({ message: "Ad deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 5. TOGGLE STATUS (Admin)
router.put('/:id/toggle', async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    ad.isActive = !ad.isActive;
    await ad.save();
    res.json({ message: "Status updated", isActive: ad.isActive });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
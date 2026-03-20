const express = require('express');
const router = express.Router();
const Voucher = require('../models/Voucher');

// 1. GET ALL (For Admin & User Footer)
router.get('/all', async (req, res) => {
  try {
    const vouchers = await Voucher.find();
    res.json(vouchers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. GET ACTIVE ONLY (Optional optimization for Users)
router.get('/active', async (req, res) => {
  try {
    const today = new Date();
    const vouchers = await Voucher.find({ expiry: { $gte: today } });
    res.json(vouchers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ADD VOUCHER (Admin)
router.post('/add', async (req, res) => {
  try {
    const newVoucher = new Voucher(req.body);
    await newVoucher.save();
    res.status(201).json({ message: "Voucher Added!", voucher: newVoucher });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DELETE VOUCHER (Admin)
router.delete('/delete/:id', async (req, res) => {
  try {
    await Voucher.findByIdAndDelete(req.params.id);
    res.json({ message: "Voucher Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
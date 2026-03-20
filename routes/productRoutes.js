const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2; // <--- 1. Import Cloudinary

// --- 2. Configure Cloudinary ---
// (Make sure these are in your .env file!)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- UPDATED PRODUCT SCHEMA ---
const productSchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  brand: { type: String, required: true },
  category: { type: String, required: true },     
  subCategory: { type: String, required: true },  
  
  // Pricing
  price: { type: Number, required: true },
  mrp: { type: Number },
  discount: { type: Number, default: 0 },
  
  // Details
  description: { type: String },
  image: { type: String, required: true }, // Will now store Cloudinary URL
  inStock: { type: Boolean, default: true },

  // --- 🚨 NEW FIELDS FOR VARIANTS & SPECS 🚨 ---
  modelNumber: { type: String },
  releaseYear: { type: Number },
  
  // Variants Array (Colors, Storage, specific Prices & Images)
  variants: [{
    color: { type: String },
    storage: { type: String },
    price: { type: Number },
    image: { type: String } // Will now store Cloudinary URL
  }],

  // Dynamic Map to hold unlimited key-value pairs (e.g., "RAM": "8GB")
  specifications: { type: Map, of: String }
});

// Prevent "OverwriteModelError" if model is already compiled
const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// --- ROUTES ---

// 1. GET ALL PRODUCTS
router.get('/all', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. ADD PRODUCT (Admin) - WITH CLOUDINARY UPLOAD
router.post('/add', async (req, res) => {
  try {
    const productData = req.body;

    // --- CLOUDINARY MAGIC STARTS HERE ---
    
    // Upload Main Image
    if (productData.image && productData.image.startsWith('data:image')) {
      const uploadRes = await cloudinary.uploader.upload(productData.image, {
        folder: 'feedtrace_products',
      });
      productData.image = uploadRes.secure_url; // Replace Base64 with URL
    }

    // Upload Variant Images (Loops through colors/storages)
    if (productData.variants && productData.variants.length > 0) {
      for (let i = 0; i < productData.variants.length; i++) {
        if (productData.variants[i].image && productData.variants[i].image.startsWith('data:image')) {
          const varUploadRes = await cloudinary.uploader.upload(productData.variants[i].image, {
            folder: 'feedtrace_variants',
          });
          productData.variants[i].image = varUploadRes.secure_url; // Replace Base64 with URL
        }
      }
    }
    // --- CLOUDINARY MAGIC ENDS HERE ---

    // req.body (productData) now has short Cloudinary URLs instead of huge Base64 strings!
    const newProduct = new Product(productData);
    await newProduct.save();
    
    console.log("✅ Product Added with Cloudinary:", newProduct.name);
    res.status(201).json({ message: 'Product Added Successfully!', product: newProduct });
  } catch (err) {
    console.error("❌ Add Product Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 3. DELETE PRODUCT (Admin)
router.delete('/delete/:id', async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product Deleted Successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. GET PRODUCTS BY CATEGORY & SUBCATEGORY
router.get('/category/:category/:subCategory', async (req, res) => {
  try {
    const { category, subCategory } = req.params;
    
    const products = await Product.find({
      category: { $regex: new RegExp(`^${category}$`, 'i') },
      subCategory: { $regex: new RegExp(`^${subCategory}$`, 'i') }
    });

    if (products.length === 0) {
      return res.status(404).json({ message: "No products found in this category" });
    }

    res.json(products);
  } catch (err) {
    console.error("Fetch Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 5. GET SINGLE PRODUCT (Crucial for ProductDetails.jsx to load!)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
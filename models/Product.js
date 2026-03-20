const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },    
  subCategory: { type: String, required: true }, 
  
  // Base price for the Home page listing
  price: { type: Number, required: true },
  brand: { type: String, required: true },
  image: { type: String }, 
  
  modelNumber: { type: String }, 
  releaseYear: { type: Number }, 
  
  // --- NEW: VARIANTS ARRAY ---
  variants: [{
    color: { type: String },     // e.g., "Phantom Grey"
    storage: { type: String },   // e.g., "256 GB + 12 GB"
    price: { type: Number },     // e.g., 28999
    image: { type: String }      // URL for the variant image
  }],

  specifications: { type: Map, of: String }, 
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// --- 1. LOAD ENVIRONMENT VARIABLES ---
dotenv.config(); 

// Import Routes
const productRoutes = require('./routes/productRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const authRoutes = require('./routes/authRoutes'); 
const voucherRoutes = require('./routes/voucherRoutes');
const adRoutes = require('./routes/adRoutes');

const app = express();

// --- 2. CONFIGURE MIDDLEWARE ---
app.use(cors({
  origin: true, 
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// CRITICAL: Handle large Base64 OCR images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- 3. DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
    // Log the database name to verify environment
    console.log(`📡 DB Name: ${mongoose.connection.name}`);
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    process.exit(1); 
  });

// --- 4. REGISTER API ROUTES ---
app.use('/api/products', productRoutes);
app.use('/api/reviews', reviewRoutes); 
app.use('/api/auth', authRoutes); 
app.use('/api/vouchers', voucherRoutes);
app.use('/api/ads', adRoutes);

// --- 5. HEALTH CHECK & ROUTE VERIFIER ---
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    message: '🚀 FeedTrace AI Backend is Live!',
    database: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString()
  });
});

// --- 6. CATCH-ALL 404 HANDLER ---
// This will tell you if the frontend is calling the wrong URL
app.use((req, res) => {
  console.log(`⚠️ 404 - Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Route ${req.url} not found on this server.` });
});

// --- 7. GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
  console.error('🔥 Server Error:', err.stack);
  res.status(500).json({ error: 'Something went wrong on the server!' });
});

// --- 8. BIND TO PORT ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('--------------------------------------------------');
  console.log(`🚀 Server running on Port ${PORT}`);
  console.log(`🏠 Local: http://localhost:${PORT}`);
  console.log(`📡 Remote: https://feedtrace-api.onrender.com`);
  console.log('--------------------------------------------------');
});
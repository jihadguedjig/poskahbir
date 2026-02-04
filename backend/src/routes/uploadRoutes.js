/**
 * Upload Routes - Product image upload
 */

const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { authenticate, requirePermission } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'products');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.jpg').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const safeExt = allowed.includes(ext) ? ext : '.jpg';
    cb(null, `${uuidv4()}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase();
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Invalid image type. Use JPG, PNG, GIF or WebP.'), false);
  }
});

router.use(authenticate);

router.post('/product-image', requirePermission('products', 'update'), upload.single('image'), uploadController.uploadProductImage);
router.post('/category-image', requirePermission('categories', 'update'), upload.single('image'), uploadController.uploadProductImage);

module.exports = router;

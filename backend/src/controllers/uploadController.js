/**
 * Upload Controller - Product image upload
 */

const path = require('path');
const { ApiError } = require('../middleware/errorHandler');
const { logger } = require('../utils/logger');

/**
 * POST /api/uploads/product-image
 * Multer saves file; we return URL path for storing in product.image_url.
 */
const uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      throw ApiError.badRequest('No image file provided');
    }
    const urlPath = `/uploads/products/${req.file.filename}`;
    logger.info(`Product image uploaded: ${req.file.filename}`);
    res.json({
      success: true,
      data: { url: urlPath }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { uploadProductImage };

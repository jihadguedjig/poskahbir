-- Add image_url to categories for category image
ALTER TABLE categories
ADD COLUMN image_url VARCHAR(500) NULL AFTER icon;

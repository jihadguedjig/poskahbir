-- Add variable_price to products so server can set price when adding to order
ALTER TABLE products
ADD COLUMN variable_price BOOLEAN DEFAULT FALSE AFTER is_available;

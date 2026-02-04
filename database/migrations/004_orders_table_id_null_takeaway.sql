-- Allow takeaway orders without a table (table_id NULL)
ALTER TABLE orders
MODIFY COLUMN table_id INT UNSIGNED NULL;

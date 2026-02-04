-- ============================================
-- SHOWAYA POS SYSTEM - DATABASE SCHEMA
-- Production-Ready MySQL Schema
-- ============================================

-- Create database
CREATE DATABASE IF NOT EXISTS showaya_pos
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE showaya_pos;

-- ============================================
-- ROLES TABLE
-- ============================================
CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    permissions JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_role_name (name)
) ENGINE=InnoDB;

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    pin_hash VARCHAR(255) NOT NULL,
    role_id INT UNSIGNED NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
    INDEX idx_user_username (username),
    INDEX idx_user_role (role_id),
    INDEX idx_user_active (is_active)
) ENGINE=InnoDB;

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    display_order INT DEFAULT 0,
    color VARCHAR(7) DEFAULT '#3B82F6',
    icon VARCHAR(50),
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_category_active (is_active),
    INDEX idx_category_order (display_order)
) ENGINE=InnoDB;

-- ============================================
-- PRODUCTS TABLE
-- ============================================
CREATE TABLE products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    category_id INT UNSIGNED NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    cost_price DECIMAL(10, 2) DEFAULT 0.00,
    sku VARCHAR(50) UNIQUE,
    stock_quantity INT DEFAULT NULL,
    track_stock BOOLEAN DEFAULT FALSE,
    min_stock_alert INT DEFAULT 10,
    image_url VARCHAR(500),
    is_available BOOLEAN DEFAULT TRUE,
    variable_price BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    INDEX idx_product_category (category_id),
    INDEX idx_product_available (is_available),
    INDEX idx_product_active (is_active),
    INDEX idx_product_sku (sku),
    FULLTEXT INDEX idx_product_search (name, description)
) ENGINE=InnoDB;

-- ============================================
-- TABLES TABLE (Restaurant Tables)
-- ============================================
CREATE TABLE restaurant_tables (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    table_number INT NOT NULL UNIQUE,
    capacity INT DEFAULT 4,
    status ENUM('available', 'occupied', 'reserved', 'maintenance') DEFAULT 'available',
    section VARCHAR(50),
    position_x INT DEFAULT 0,
    position_y INT DEFAULT 0,
    current_order_id INT UNSIGNED NULL,
    locked_by_user_id INT UNSIGNED NULL,
    locked_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_table_number (table_number),
    INDEX idx_table_status (status),
    INDEX idx_table_active (is_active),
    INDEX idx_table_locked (locked_by_user_id)
) ENGINE=InnoDB;

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL UNIQUE,
    table_id INT UNSIGNED NULL,
    server_id INT UNSIGNED NOT NULL,
    status ENUM('open', 'served', 'paid', 'cancelled', 'void') DEFAULT 'open',
    subtotal DECIMAL(12, 2) DEFAULT 0.00,
    tax_amount DECIMAL(12, 2) DEFAULT 0.00,
    discount_amount DECIMAL(12, 2) DEFAULT 0.00,
    total_amount DECIMAL(12, 2) DEFAULT 0.00,
    guest_count INT DEFAULT 1,
    notes TEXT,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (table_id) REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
    FOREIGN KEY (server_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_order_number (order_number),
    INDEX idx_order_table (table_id),
    INDEX idx_order_server (server_id),
    INDEX idx_order_status (status),
    INDEX idx_order_opened (opened_at),
    INDEX idx_order_table_status (table_id, status)
) ENGINE=InnoDB;

-- Add foreign key for current_order_id in restaurant_tables
ALTER TABLE restaurant_tables
ADD CONSTRAINT fk_table_current_order
FOREIGN KEY (current_order_id) REFERENCES orders(id) ON DELETE SET NULL;

ALTER TABLE restaurant_tables
ADD CONSTRAINT fk_table_locked_user
FOREIGN KEY (locked_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- ORDER ITEMS TABLE
-- ============================================
CREATE TABLE order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    discount_amount DECIMAL(10, 2) DEFAULT 0.00,
    notes VARCHAR(500),
    status ENUM('pending', 'preparing', 'ready', 'served', 'cancelled') DEFAULT 'pending',
    added_by_user_id INT UNSIGNED NOT NULL,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    served_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (added_by_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_item_order (order_id),
    INDEX idx_item_product (product_id),
    INDEX idx_item_status (status),
    INDEX idx_item_added_by (added_by_user_id)
) ENGINE=InnoDB;

-- ============================================
-- PAYMENT METHODS TABLE
-- ============================================
CREATE TABLE payment_methods (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payment_number VARCHAR(20) NOT NULL UNIQUE,
    order_id INT UNSIGNED NOT NULL,
    payment_method_id INT UNSIGNED NOT NULL,
    cashier_id INT UNSIGNED NOT NULL,
    amount_due DECIMAL(12, 2) NOT NULL,
    amount_paid DECIMAL(12, 2) NOT NULL,
    change_amount DECIMAL(12, 2) DEFAULT 0.00,
    tip_amount DECIMAL(10, 2) DEFAULT 0.00,
    status ENUM('pending', 'completed', 'refunded', 'void') DEFAULT 'pending',
    reference_number VARCHAR(100),
    notes TEXT,
    paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
    FOREIGN KEY (payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
    FOREIGN KEY (cashier_id) REFERENCES users(id) ON DELETE RESTRICT,
    INDEX idx_payment_number (payment_number),
    INDEX idx_payment_order (order_id),
    INDEX idx_payment_cashier (cashier_id),
    INDEX idx_payment_status (status),
    INDEX idx_payment_date (paid_at)
) ENGINE=InnoDB;

-- ============================================
-- AUDIT LOG TABLE (For tracking all actions)
-- ============================================
CREATE TABLE audit_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT UNSIGNED,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_user (user_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_entity (entity_type, entity_id),
    INDEX idx_audit_date (created_at)
) ENGINE=InnoDB;

-- ============================================
-- SESSIONS TABLE (For PIN authentication)
-- ============================================
CREATE TABLE user_sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token VARCHAR(255) NOT NULL UNIQUE,
    device_info VARCHAR(500),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_session_token (token),
    INDEX idx_session_user (user_id),
    INDEX idx_session_expires (expires_at)
) ENGINE=InnoDB;

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Insert default roles with permissions
INSERT INTO roles (name, description, permissions) VALUES
('admin', 'Full system access', JSON_OBJECT(
    'users', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'products', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'categories', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'orders', JSON_ARRAY('create', 'read', 'update', 'delete', 'void'),
    'payments', JSON_ARRAY('create', 'read', 'update', 'refund'),
    'tables', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'reports', JSON_ARRAY('view', 'export'),
    'settings', JSON_ARRAY('read', 'update')
)),
('moderator', 'Manage products, view reports, assist servers', JSON_OBJECT(
    'users', JSON_ARRAY('read'),
    'products', JSON_ARRAY('create', 'read', 'update'),
    'categories', JSON_ARRAY('create', 'read', 'update'),
    'orders', JSON_ARRAY('read', 'update'),
    'payments', JSON_ARRAY('read'),
    'tables', JSON_ARRAY('read', 'update'),
    'reports', JSON_ARRAY('view')
)),
('server', 'Take orders and manage assigned tables', JSON_OBJECT(
    'products', JSON_ARRAY('read'),
    'categories', JSON_ARRAY('read'),
    'orders', JSON_ARRAY('create', 'read', 'update'),
    'tables', JSON_ARRAY('read', 'update')
)),
('cashier', 'Process payments and view orders', JSON_OBJECT(
    'products', JSON_ARRAY('read'),
    'orders', JSON_ARRAY('read'),
    'payments', JSON_ARRAY('create', 'read'),
    'tables', JSON_ARRAY('read', 'update')
));

-- Insert default payment methods
INSERT INTO payment_methods (name, description) VALUES
('cash', 'Cash payment'),
('card', 'Credit/Debit card payment'),
('mobile', 'Mobile payment (Apple Pay, Google Pay, etc.)');

-- Insert default categories for Showaya restaurant
INSERT INTO categories (name, description, display_order, color, icon) VALUES
('Grills & BBQ', 'Grilled meats and barbecue dishes', 1, '#EF4444', 'flame'),
('Skewers', 'Meat and vegetable skewers', 2, '#F97316', 'utensils'),
('Sides', 'Side dishes and accompaniments', 3, '#22C55E', 'leaf'),
('Salads', 'Fresh salads', 4, '#10B981', 'salad'),
('Desserts', 'Sweet treats and desserts', 5, '#EC4899', 'cake'),
('Hot Drinks', 'Coffee, tea, and hot beverages', 6, '#8B5CF6', 'coffee'),
('Cold Drinks', 'Soft drinks, juices, and cold beverages', 7, '#3B82F6', 'glass'),
('Specials', 'Chef specials and seasonal items', 8, '#F59E0B', 'star');

-- Insert sample products
INSERT INTO products (name, description, category_id, price, is_available) VALUES
-- Grills & BBQ
('Mixed Grill Platter', 'Assorted grilled meats with vegetables', 1, 45.00, TRUE),
('Beef Ribeye Steak', 'Premium 300g ribeye, grilled to perfection', 1, 38.00, TRUE),
('Lamb Chops', 'Tender lamb chops with herbs', 1, 42.00, TRUE),
('Grilled Chicken', 'Half chicken, marinated and grilled', 1, 25.00, TRUE),
('Beef Kofta', 'Seasoned ground beef skewers', 1, 22.00, TRUE),

-- Skewers
('Chicken Skewers', '3 pieces of marinated chicken', 2, 18.00, TRUE),
('Beef Skewers', '3 pieces of premium beef', 2, 22.00, TRUE),
('Lamb Skewers', '3 pieces of tender lamb', 2, 24.00, TRUE),
('Shrimp Skewers', '4 pieces of grilled shrimp', 2, 26.00, TRUE),
('Vegetable Skewers', 'Grilled seasonal vegetables', 2, 14.00, TRUE),

-- Sides
('French Fries', 'Crispy golden fries', 3, 8.00, TRUE),
('Rice Pilaf', 'Seasoned basmati rice', 3, 7.00, TRUE),
('Grilled Vegetables', 'Seasonal grilled vegetables', 3, 10.00, TRUE),
('Hummus', 'Creamy chickpea dip with pita', 3, 9.00, TRUE),
('Baba Ganoush', 'Smoky eggplant dip', 3, 9.00, TRUE),

-- Salads
('Garden Salad', 'Fresh mixed greens', 4, 12.00, TRUE),
('Caesar Salad', 'Classic caesar with croutons', 4, 14.00, TRUE),
('Greek Salad', 'Tomatoes, cucumber, feta, olives', 4, 13.00, TRUE),
('Fattoush', 'Lebanese salad with crispy pita', 4, 12.00, TRUE),

-- Desserts
('Baklava', 'Sweet pastry with nuts and honey', 5, 8.00, TRUE),
('Kunafa', 'Cheese pastry with syrup', 5, 10.00, TRUE),
('Ice Cream', 'Three scoops, choice of flavors', 5, 9.00, TRUE),
('Fruit Platter', 'Fresh seasonal fruits', 5, 12.00, TRUE),

-- Hot Drinks
('Turkish Coffee', 'Traditional Turkish coffee', 6, 5.00, TRUE),
('Arabic Coffee', 'Cardamom-spiced coffee', 6, 5.00, TRUE),
('Tea', 'Black or mint tea', 6, 4.00, TRUE),
('Cappuccino', 'Espresso with steamed milk', 6, 6.00, TRUE),

-- Cold Drinks
('Soft Drinks', 'Coca-Cola, Sprite, Fanta', 7, 4.00, TRUE),
('Fresh Juice', 'Orange, apple, or mixed', 7, 7.00, TRUE),
('Lemonade', 'Fresh squeezed lemonade', 7, 6.00, TRUE),
('Water', 'Bottled mineral water', 7, 3.00, TRUE),
('Ayran', 'Traditional yogurt drink', 7, 5.00, TRUE);

-- Insert 50 restaurant tables
INSERT INTO restaurant_tables (table_number, capacity, section, position_x, position_y) VALUES
(1, 2, 'Window', 0, 0), (2, 2, 'Window', 1, 0), (3, 2, 'Window', 2, 0), (4, 2, 'Window', 3, 0), (5, 2, 'Window', 4, 0),
(6, 4, 'Main', 0, 1), (7, 4, 'Main', 1, 1), (8, 4, 'Main', 2, 1), (9, 4, 'Main', 3, 1), (10, 4, 'Main', 4, 1),
(11, 4, 'Main', 0, 2), (12, 4, 'Main', 1, 2), (13, 4, 'Main', 2, 2), (14, 4, 'Main', 3, 2), (15, 4, 'Main', 4, 2),
(16, 4, 'Main', 0, 3), (17, 4, 'Main', 1, 3), (18, 4, 'Main', 2, 3), (19, 4, 'Main', 3, 3), (20, 4, 'Main', 4, 3),
(21, 6, 'Center', 0, 4), (22, 6, 'Center', 1, 4), (23, 6, 'Center', 2, 4), (24, 6, 'Center', 3, 4), (25, 6, 'Center', 4, 4),
(26, 6, 'Center', 0, 5), (27, 6, 'Center', 1, 5), (28, 6, 'Center', 2, 5), (29, 6, 'Center', 3, 5), (30, 6, 'Center', 4, 5),
(31, 4, 'Back', 0, 6), (32, 4, 'Back', 1, 6), (33, 4, 'Back', 2, 6), (34, 4, 'Back', 3, 6), (35, 4, 'Back', 4, 6),
(36, 4, 'Back', 0, 7), (37, 4, 'Back', 1, 7), (38, 4, 'Back', 2, 7), (39, 4, 'Back', 3, 7), (40, 4, 'Back', 4, 7),
(41, 8, 'VIP', 0, 8), (42, 8, 'VIP', 1, 8), (43, 8, 'VIP', 2, 8), (44, 8, 'VIP', 3, 8), (45, 8, 'VIP', 4, 8),
(46, 10, 'Private', 0, 9), (47, 10, 'Private', 1, 9), (48, 10, 'Private', 2, 9), (49, 12, 'Private', 3, 9), (50, 12, 'Private', 4, 9);

-- Insert default admin user (PIN: 1234)
-- Note: In production, use proper bcrypt hashing. This is SHA256 for demo.
INSERT INTO users (username, full_name, pin_hash, role_id) VALUES
('admin', 'System Administrator', '$2b$10$rQZ8K.QvQ1Q1Q1Q1Q1Q1Qe1Q1Q1Q1Q1Q1Q1Q1Q1Q1Q1Q1Q1Q1Q1Q', 1);

-- ============================================
-- STORED PROCEDURES
-- ============================================

DELIMITER //

-- Generate unique order number
CREATE FUNCTION generate_order_number() 
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE new_number VARCHAR(20);
    SET new_number = CONCAT('ORD-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(FLOOR(RAND() * 10000), 4, '0'));
    RETURN new_number;
END //

-- Generate unique payment number
CREATE FUNCTION generate_payment_number() 
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE new_number VARCHAR(20);
    SET new_number = CONCAT('PAY-', DATE_FORMAT(NOW(), '%Y%m%d'), '-', LPAD(FLOOR(RAND() * 10000), 4, '0'));
    RETURN new_number;
END //

-- Procedure to create a new order
CREATE PROCEDURE create_order(
    IN p_table_id INT UNSIGNED,
    IN p_server_id INT UNSIGNED,
    IN p_guest_count INT,
    OUT p_order_id INT UNSIGNED,
    OUT p_order_number VARCHAR(20)
)
BEGIN
    DECLARE v_table_status VARCHAR(20);
    DECLARE v_existing_order INT UNSIGNED;
    
    -- Check if table exists and is available
    SELECT status, current_order_id INTO v_table_status, v_existing_order
    FROM restaurant_tables WHERE id = p_table_id FOR UPDATE;
    
    IF v_table_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table not found';
    END IF;
    
    IF v_table_status = 'occupied' AND v_existing_order IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Table already has an active order';
    END IF;
    
    -- Generate order number
    SET p_order_number = generate_order_number();
    
    -- Create the order
    INSERT INTO orders (order_number, table_id, server_id, guest_count, status, opened_at)
    VALUES (p_order_number, p_table_id, p_server_id, p_guest_count, 'open', NOW());
    
    SET p_order_id = LAST_INSERT_ID();
    
    -- Update table status
    UPDATE restaurant_tables 
    SET status = 'occupied', 
        current_order_id = p_order_id,
        locked_by_user_id = p_server_id,
        locked_at = NOW()
    WHERE id = p_table_id;
END //

-- Procedure to add item to order
CREATE PROCEDURE add_order_item(
    IN p_order_id INT UNSIGNED,
    IN p_product_id INT UNSIGNED,
    IN p_quantity INT,
    IN p_user_id INT UNSIGNED,
    IN p_notes VARCHAR(500)
)
BEGIN
    DECLARE v_unit_price DECIMAL(10, 2);
    DECLARE v_subtotal DECIMAL(12, 2);
    DECLARE v_product_available BOOLEAN;
    DECLARE v_track_stock BOOLEAN;
    DECLARE v_stock_qty INT;
    
    -- Get product info
    SELECT price, is_available, track_stock, stock_quantity 
    INTO v_unit_price, v_product_available, v_track_stock, v_stock_qty
    FROM products WHERE id = p_product_id;
    
    IF v_unit_price IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Product not found';
    END IF;
    
    IF NOT v_product_available THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Product is not available';
    END IF;
    
    IF v_track_stock AND v_stock_qty < p_quantity THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock';
    END IF;
    
    -- Calculate subtotal
    SET v_subtotal = v_unit_price * p_quantity;
    
    -- Insert order item
    INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal, notes, added_by_user_id)
    VALUES (p_order_id, p_product_id, p_quantity, v_unit_price, v_subtotal, p_notes, p_user_id);
    
    -- Update stock if tracking
    IF v_track_stock THEN
        UPDATE products SET stock_quantity = stock_quantity - p_quantity WHERE id = p_product_id;
    END IF;
    
    -- Update order totals
    CALL update_order_totals(p_order_id);
END //

-- Procedure to update order totals
CREATE PROCEDURE update_order_totals(IN p_order_id INT UNSIGNED)
BEGIN
    DECLARE v_subtotal DECIMAL(12, 2);
    DECLARE v_tax_rate DECIMAL(5, 4) DEFAULT 0.0000;
    
    -- Calculate subtotal from items
    SELECT COALESCE(SUM(subtotal - discount_amount), 0) INTO v_subtotal
    FROM order_items 
    WHERE order_id = p_order_id AND status != 'cancelled';
    
    -- Update order
    UPDATE orders 
    SET subtotal = v_subtotal,
        tax_amount = v_subtotal * v_tax_rate,
        total_amount = v_subtotal + (v_subtotal * v_tax_rate) - discount_amount
    WHERE id = p_order_id;
END //

-- Procedure to process payment
CREATE PROCEDURE process_payment(
    IN p_order_id INT UNSIGNED,
    IN p_payment_method_id INT UNSIGNED,
    IN p_cashier_id INT UNSIGNED,
    IN p_amount_paid DECIMAL(12, 2),
    IN p_tip_amount DECIMAL(10, 2),
    IN p_reference_number VARCHAR(100),
    OUT p_payment_id INT UNSIGNED,
    OUT p_payment_number VARCHAR(20),
    OUT p_change_amount DECIMAL(12, 2)
)
BEGIN
    DECLARE v_order_total DECIMAL(12, 2);
    DECLARE v_order_status VARCHAR(20);
    DECLARE v_table_id INT UNSIGNED;
    
    -- Get order info
    SELECT total_amount, status, table_id 
    INTO v_order_total, v_order_status, v_table_id
    FROM orders WHERE id = p_order_id FOR UPDATE;
    
    IF v_order_total IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order not found';
    END IF;
    
    IF v_order_status = 'paid' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order is already paid';
    END IF;
    
    IF v_order_status = 'cancelled' OR v_order_status = 'void' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot pay for cancelled/void order';
    END IF;
    
    -- Calculate change
    SET p_change_amount = p_amount_paid - (v_order_total + p_tip_amount);
    
    IF p_change_amount < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient payment amount';
    END IF;
    
    -- Generate payment number
    SET p_payment_number = generate_payment_number();
    
    -- Create payment record
    INSERT INTO payments (
        payment_number, order_id, payment_method_id, cashier_id,
        amount_due, amount_paid, change_amount, tip_amount,
        reference_number, status, paid_at
    ) VALUES (
        p_payment_number, p_order_id, p_payment_method_id, p_cashier_id,
        v_order_total, p_amount_paid, p_change_amount, p_tip_amount,
        p_reference_number, 'completed', NOW()
    );
    
    SET p_payment_id = LAST_INSERT_ID();
    
    -- Update order status
    UPDATE orders SET status = 'paid', closed_at = NOW() WHERE id = p_order_id;
    
    -- Free up the table
    UPDATE restaurant_tables 
    SET status = 'available', 
        current_order_id = NULL,
        locked_by_user_id = NULL,
        locked_at = NULL
    WHERE id = v_table_id;
END //

DELIMITER ;

-- ============================================
-- VIEWS FOR REPORTING
-- ============================================

-- Active orders view
CREATE VIEW v_active_orders AS
SELECT 
    o.id AS order_id,
    o.order_number,
    t.table_number,
    u.full_name AS server_name,
    o.guest_count,
    o.total_amount,
    o.opened_at,
    TIMESTAMPDIFF(MINUTE, o.opened_at, NOW()) AS duration_minutes,
    COUNT(oi.id) AS item_count
FROM orders o
JOIN restaurant_tables t ON o.table_id = t.id
JOIN users u ON o.server_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id AND oi.status != 'cancelled'
WHERE o.status = 'open'
GROUP BY o.id;

-- Daily sales summary view
CREATE VIEW v_daily_sales AS
SELECT 
    DATE(p.paid_at) AS sale_date,
    COUNT(DISTINCT p.order_id) AS total_orders,
    SUM(p.amount_due) AS gross_sales,
    SUM(p.tip_amount) AS total_tips,
    AVG(p.amount_due) AS average_order_value
FROM payments p
WHERE p.status = 'completed'
GROUP BY DATE(p.paid_at);

-- Product sales view
CREATE VIEW v_product_sales AS
SELECT 
    p.id AS product_id,
    p.name AS product_name,
    c.name AS category_name,
    SUM(oi.quantity) AS total_quantity_sold,
    SUM(oi.subtotal) AS total_revenue
FROM order_items oi
JOIN products p ON oi.product_id = p.id
JOIN categories c ON p.category_id = c.id
JOIN orders o ON oi.order_id = o.id
WHERE o.status = 'paid' AND oi.status != 'cancelled'
GROUP BY p.id;

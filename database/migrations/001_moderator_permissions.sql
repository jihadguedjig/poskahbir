-- Give Moderator full management: users (create/update/delete), payments (create), tables (create/delete)
-- So Moderator can manage products, servers, cashiers, tables, and process payments like Cashier

USE showaya_pos;

UPDATE roles
SET permissions = JSON_OBJECT(
    'users', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'products', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'categories', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'orders', JSON_ARRAY('create', 'read', 'update', 'delete', 'void'),
    'payments', JSON_ARRAY('create', 'read', 'update'),
    'tables', JSON_ARRAY('create', 'read', 'update', 'delete'),
    'reports', JSON_ARRAY('view')
)
WHERE name = 'moderator';

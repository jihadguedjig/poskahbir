# Showaya POS System

A production-ready Point of Sale system for Showaya grill/barbecue restaurant.

## Features

### Core Functionality
- **PIN-based Authentication** - Secure login with 4-8 digit PINs
- **Role-based Access Control** - Admin, Moderator, Server, and Cashier roles
- **Table Management** - 50 tables with real-time status tracking
- **Order Management** - Full order lifecycle from creation to payment
- **Payment Processing** - Cash, card, and mobile payments with change calculation
- **Sales Reports** - Daily summaries and detailed reports

### User Roles
| Role | Permissions |
|------|-------------|
| Admin | Full system access, user management, reports |
| Moderator | Product management, order oversight, reports |
| Server | Table selection, order creation/modification |
| Cashier | Payment processing, order viewing |

### Technical Features
- Real-time table status updates
- Order locking to prevent conflicts
- Audit logging for all actions
- Touch-friendly UI for tablets
- Responsive design for all devices

## Tech Stack

### Backend
- Node.js with Express.js
- MySQL database
- JWT authentication
- bcrypt for PIN hashing

### Frontend
- React 18 with Vite
- Tailwind CSS
- React Router v6
- Axios for API calls

## Installation

### Prerequisites
- Node.js 18+ 
- MySQL 8.0+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)

### 1. Database Setup

```bash
# Login to MySQL
mysql -u root -p

# Run the schema file
source database/schema.sql
```

This creates:
- Database `showaya_pos`
- All tables with proper indexes
- Default roles and permissions
- 50 restaurant tables
- Sample product catalog
- Payment methods

**Optional (Moderator full access):** To give Moderators user/product/table management and payment rights, run:
`database/migrations/001_moderator_permissions.sql` in phpMyAdmin or MySQL.

### 2. Install & Run (One Command)

From the project root:

```bash
# Install all dependencies (backend + frontend)
pnpm install

# Create backend .env file
cp backend/.env.example backend/.env
# Edit backend/.env with your database credentials

# Seed default users (one-time)
pnpm db:seed

# Start both backend and frontend together
pnpm dev
```

- **Backend** runs on `http://localhost:3001`
- **Frontend** runs on `http://localhost:3000`

**Access from your phone (same Wi‑Fi):** After `pnpm dev`, the frontend listens on all interfaces. Find your computer’s local IP (e.g. `192.168.1.10`) and open `http://<your-local-ip>:3000` in your phone’s browser. API calls are proxied through the dev server, so no extra backend config is needed.

### Scripts Reference

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies for all packages |
| `pnpm dev` | Start both backend and frontend |
| `pnpm dev:backend` | Start backend only |
| `pnpm dev:frontend` | Start frontend only |
| `pnpm db:seed` | Seed default users |
| `pnpm build` | Build frontend for production |
| `pnpm start` | Start backend (production) |

## Default Credentials

After running the seed script:

| Role | Username | PIN |
|------|----------|-----|
| Admin | admin | 1234 |
| Moderator | manager | 5678 |
| Server | server1 | 1111 |
| Server | server2 | 2222 |
| Cashier | cashier1 | 9999 |

**Important:** Change these PINs in production!

## Logging & error tracking

The backend logs errors and important events so you can track issues.

### Where logs go

| Output | When | What |
|--------|------|------|
| **Console** | Always | All messages at `LOG_LEVEL` (default: `info`) |
| **`backend/logs/error.log`** | Always | Errors only (5xx and `logger.error`) |
| **`backend/logs/combined.log`** | Production only | All levels (info, warn, error) |

- **Server errors (5xx)** and uncaught errors are logged with `logger.error` (message, stack, path, method).
- **Client errors (4xx)** are logged with `logger.warn` (message, statusCode, path, method).
- **Database** failures (connection, query, transaction) are logged in the same way.

### Optional env vars (in `backend/.env`)

- **`LOG_LEVEL`** – `debug` \| `info` \| `warn` \| `error` (default: `info`). Use `debug` for more detail.
- **`LOGS_DIR`** – Folder for log files (default: `backend/logs`).

### Audit log (database)

User actions (login, orders, payments, profile/PIN changes, etc.) are stored in the **`audit_log`** table. Use it to see who did what and when; it does not store stack traces or technical errors. Query it in MySQL or from an admin report.

### Quick check for errors

```bash
# Watch backend errors in real time (run from project root)
tail -f backend/logs/error.log
```

## API Endpoints

### Authentication
```
POST /api/auth/login      - Login with username/PIN
GET  /api/auth/verify     - Verify token
POST /api/auth/change-pin - Change PIN
POST /api/auth/logout     - Logout
```

### Tables
```
GET  /api/tables          - Get all tables
GET  /api/tables/:id      - Get table by ID
GET  /api/tables/summary  - Get status summary
POST /api/tables/:id/lock - Lock table for server
```

### Orders
```
GET  /api/orders          - Get all orders
GET  /api/orders/active   - Get active orders
POST /api/orders          - Create order
POST /api/orders/:id/items - Add item to order
PATCH /api/orders/:id/items/:itemId - Update item
DELETE /api/orders/:id/items/:itemId - Remove item
```

### Payments
```
GET  /api/payments/methods - Get payment methods
POST /api/payments        - Process payment
GET  /api/payments/summary/daily - Daily summary
GET  /api/payments/report - Sales report
```

### Products
```
GET  /api/products           - Get all products
GET  /api/products/by-category - Products by category
POST /api/products           - Create product
PUT  /api/products/:id       - Update product
```

## Order Flow

1. **Server selects table** → Table locks to prevent conflicts
2. **Server creates order** → Order linked to table and server
3. **Server adds items** → Real-time total updates
4. **Server can modify** → Add/remove/update quantities
5. **Customer finishes** → Goes to cashier
6. **Cashier selects table** → Loads order details
7. **Cashier processes payment** → Order closed, table freed

## Production Deployment

### Environment Variables
```env
NODE_ENV=production
PORT=3001

DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=showaya_pos
DB_USER=your-db-user
DB_PASSWORD=your-db-password

JWT_SECRET=use-a-long-random-string
JWT_EXPIRES_IN=8h

BCRYPT_ROUNDS=12
```

### Security Checklist
- [ ] Change all default PINs
- [ ] Use strong JWT_SECRET
- [ ] Enable HTTPS
- [ ] Configure CORS properly
- [ ] Set up database backups
- [ ] Enable rate limiting
- [ ] Use environment-specific configs

### Receipt (80mm thermal printer)

The payment ticket is laid out for **80mm** thermal receipt printers. It includes:
- **Top:** Logo (optional) and restaurant name
- **Contact:** Address and phone (optional, from env)
- **Body:** Date, table, order, items, totals, change

To customize logo and contact, create a `.env` in `frontend/` (or set at build time):

```env
VITE_RESTAURANT_NAME=Showaya
VITE_RESTAURANT_LOGO_URL=https://yoursite.com/logo.png
VITE_RESTAURANT_ADDRESS=123 Main St, City
VITE_RESTAURANT_PHONE=+212 5XX XX XX XX
```

Leave any variable unset to use the default (name "Showaya") or hide that line.

### Build for Production

```bash
# From project root
pnpm build          # Build frontend
pnpm start          # Start backend

# Or run backend directly
cd backend && pnpm start
# Serve frontend 'dist' folder with nginx or similar
```

## Project Structure

```
pos/
├── database/
│   └── schema.sql          # Database schema
├── backend/
│   ├── src/
│   │   ├── config/         # Database config
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Auth, validation
│   │   ├── routes/         # API routes
│   │   ├── utils/          # Helpers, logger
│   │   └── server.js       # Entry point
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── context/        # React context
│   │   ├── pages/          # Page components
│   │   ├── services/       # API client
│   │   └── main.jsx        # Entry point
│   └── package.json
└── README.md
```

## Troubleshooting

### "Table is locked by another server"
- Another server is currently using this table
- Ask them to finish or have admin unlock it

### "Order already has an active order"
- Table has an unpaid order
- Process payment first or cancel the order

### Database connection errors
- Verify MySQL is running
- Check credentials in .env
- Ensure database exists

### Authentication errors
- Clear localStorage
- Check if token expired
- Verify user is active

## License

Proprietary - Showaya Restaurant © 2024

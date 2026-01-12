# PTGR API Backend

Complete Node.js/Express API backend for PTGR platform.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy and configure `.env` file (see `DATABASE_SETUP.md` for details):
```bash
# Database
DB_HOST=localhost
DB_USER=hive888_user
DB_PASSWORD=your_password
DB_NAME=ptgr_db

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=notification@ptgr.org
EMAIL_PASS=your_app_password

# JWT
JWT_SECRET=your_secret_key
JWT_REFRESH_SECRET=your_refresh_secret

# Redis
REDIS_URL=redis://localhost:6379

# Google OAuth (for Google signup/login)
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
# Optional: only needed if you use server-side OAuth code exchange
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### 3. Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server runs on: `http://localhost:3000`

---

## 📚 Documentation

- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete API reference
- **[API_TESTING_GUIDE.md](./API_TESTING_GUIDE.md)** - Step-by-step testing guide
- **[API_QUICK_REFERENCE.md](./API_QUICK_REFERENCE.md)** - Quick reference card
- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Database setup instructions

---

## 🧪 Testing

### Test Database Connection
```bash
npm run test-db
```

### Test Email Configuration
```bash
npm run test-email your-email@example.com
```

### Test API Endpoints
```bash
# Make sure server is running first!
npm start

# In another terminal:
npm run test-api
```

---

## 📋 Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run test-db` - Test database connection
- `npm run test-email` - Test email configuration
- `npm run test-api` - Run API endpoint tests

---

## 🏗️ Project Structure

```
hive888/
├── config/          # Configuration files (database, S3, Stripe)
├── controllers/     # Request handlers
├── middleware/      # Express middleware (auth, validation, error handling)
├── models/          # Database models
├── routes/          # API route definitions
├── services/        # Business logic services
├── utils/           # Utility functions (email, logger, etc.)
├── validators/      # Input validation schemas
├── scripts/         # Utility scripts
├── logs/            # Application logs
└── uploads/         # File uploads directory
```

---

## 🔑 Key Features

- ✅ JWT-based authentication with refresh tokens
- ✅ Google OAuth login
- ✅ Customer management with referral system
- ✅ Course access management with access codes
- ✅ Trading contest system
- ✅ Talent pool registration
- ✅ Quiz system for course content
- ✅ Email notifications (welcome, password reset, verification)
- ✅ Phone OTP verification
- ✅ Payment integration (Stripe)
- ✅ File uploads (S3)
- ✅ Role-based access control

---

## 🔐 Authentication Flow

1. **Login** → Get `accessToken` (15min) and `refreshToken` (7 days)
2. **Use Token** → Include in header: `Authorization: Bearer <accessToken>`
3. **Refresh** → Use `refreshToken` to get new `accessToken`
4. **Logout** → Revoke both tokens

---

## 📧 Email System

All emails are sent from: **notification@ptgr.org**

Email types:
- Welcome email (on customer creation)
- Password reset email
- Email verification
- Purchase confirmations
- Token interest notifications
- Talent pool confirmations

---

## 🗄️ Database

- **Database:** MySQL (ptgr_db)
- **Tables:** 33 active tables
- **Connection Pool:** Configured with connection limits

See `DATABASE_SETUP.md` for setup instructions.

---

## 🌐 API Endpoints Summary

### Public Endpoints
- Health check
- Customer registration
- Login/Google login
- Password reset
- Contest listing
- Course structure (chapters/sections/subsections)

### Protected Endpoints (Require Auth)
- Customer profile management
- Course access registration
- Quiz submission
- Contest joining
- User management (admin only)

---

## 🛠️ Development

### Environment Variables
See `.env.example` or `DATABASE_SETUP.md` for all required variables.

### Logging
Logs are written to `logs/` directory using Winston logger.

### Error Handling
All errors are handled by centralized error handler middleware.

---

## 📝 API Testing

### Using curl
```bash
# Health check
curl http://localhost:3000/api/health

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@example.com","password":"pass"}'
```

### Using Test Script
```bash
npm run test-api
```

### Using Postman
Import endpoints from `API_DOCUMENTATION.md` or use the testing guide.

---

## 🐛 Troubleshooting

### Database Connection Failed
- Check MySQL is running: `sudo systemctl status mysql`
- Verify credentials in `.env`
- Test connection: `npm run test-db`

### Email Not Sending
- Verify Gmail App Password is set in `.env`
- Test email: `npm run test-email`
- Check email logs in console

### Authentication Errors
- Verify JWT_SECRET is set in `.env`
- Check token expiration
- Use refresh token endpoint

---

## 📞 Support

For issues or questions:
1. Check documentation files
2. Review error logs in `logs/` directory
3. Test individual endpoints using testing guide

---

## 📄 License

ISC

---

**Last Updated:** 2025-01-XX


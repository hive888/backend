# Database Setup Instructions

This guide will help you set up the MySQL database for the PTGR API application.

## Prerequisites

- MySQL Server installed (version 5.7+ or 8.0+)
- MySQL client/command line access
- Root or admin access to MySQL

## Step 1: Create the Database

1. **Login to MySQL:**
```bash
mysql -u root -p
```

2. **Create the database:**
```sql
CREATE DATABASE IF NOT EXISTS ptgr_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. **Create a database user (recommended):**
```sql
-- Create user
CREATE USER 'hive888_user'@'localhost' IDENTIFIED BY 'PTGR#1sdflksdf0h';

-- Grant privileges
GRANT ALL PRIVILEGES ON ptgr_db.* TO 'hive888_user'@'localhost';

-- Apply changes
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

## Step 2: Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# ===========================================
# Database Configuration (REQUIRED)
# ===========================================
DB_HOST=localhost
DB_PORT=3306
DB_USER=ptgr_user
DB_PASSWORD=your_secure_password_here
DB_NAME=ptgr_db
DB_CONNECTION_LIMIT=10

# ===========================================
# Server Configuration
# ===========================================
PORT=3000
NODE_ENV=development

# ===========================================
# JWT Configuration (REQUIRED)
# ===========================================
# Generate strong secrets for production!
# You can generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here_change_in_production

# ===========================================
# Redis Configuration (REQUIRED)
# ===========================================
REDIS_URL=redis://localhost:6379

# ===========================================
# Google OAuth (for Google signup/login)
# ===========================================
# Used to verify Google ID tokens sent from frontend/Postman
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
# Optional: only needed if you use server-side OAuth code exchange
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ===========================================
# CORS Configuration
# ===========================================
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# ===========================================
# AWS S3 Configuration (For file uploads)
# ===========================================
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=ptgr-bucket

# ===========================================
# Stripe Payment Configuration
# ===========================================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_SECRET_KEY_TEST=sk_test_your_stripe_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# ===========================================
# Frontend URLs (For payment callbacks)
# ===========================================
FRONTENDHIVE_URL=http://localhost:3000
SUCCESS_CALLBACK_URL=/payment/success
CANCEL_CALLBACK_URL=/payment/cancel

# ===========================================
# Encryption Key (Optional - for crypto vault)
# ===========================================
# Must be 32 bytes base64 encoded
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
ENCRYPTION_KEY=

# ===========================================
# Country Default (Optional)
# ===========================================
COUNTRY_DEFAULT=ET

# ===========================================
# Email Configuration (REQUIRED)
# ===========================================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=notification@ptgr.org
EMAIL_PASS=your_email_password_here

# ===========================================
# Twilio SMS Configuration (Optional - for OTP)
# ===========================================
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# ===========================================
# Base URL (Optional - for email links)
# ===========================================
BASE_URL=http://localhost:3000
```

**Note:** SMS service will work in simulation mode if Twilio credentials are not configured (logs SMS instead of sending).

## Step 3: Required Database Tables

Based on the application models, you'll need to create the following tables. **Important:** You'll need to create these tables based on your existing database schema. If you have a database dump or migration files, use those instead.

### Core Tables

The application expects these main tables:

1. **customers** - Customer/user information
2. **users** - Authentication users
3. **chapters** - Course chapters
4. **sections** - Course sections (under chapters)
5. **subsections** - Course subsections (under sections)
6. **subsection_quiz_questions** - Quiz questions for subsections
7. **subsection_quiz_options** - Quiz answer options
8. **customer_section_quiz_status** - Quiz completion status (note: uses section_id but stores subsection_id)
9. **customer_progress** - Customer progress tracking
10. **access_codes** - Course access codes
11. **self_study_registrations** - Self-study course registrations
12. **contests** - Trading contests
13. **contest_registrations** - Contest participant registrations
14. **contest_metrics_current** - Current contest metrics
15. **reservations** - Course reservations
20. **customer_registrations** - Customer course registrations
21. **payment_screenshots** - Payment proof screenshots
22. **payment_tracking** - Payment tracking records
23. **talent_pool_registration** - Talent pool applications
24. **addresses** - Customer addresses
25. **products** - Products catalog
26. **bundle_products** - Product bundles mapping
27. **product_bundles** - Bundle information
28. **product_promos** - Promotional codes
29. **payment_method_networks** - Payment method networks
30. **payment_method_currencies** - Payment method currencies
31. **customer_products** - Customer product purchases

### Academy (Multi-course) Tables (NEW)

If you want multiple courses (academy catalog + per-course access), run the migration:
- `migrations/academy_courses.sql`

This will create:
- `courses` (course catalog)
- `customer_course_access` (which customer has access to which course)
- Adds `course_id` to `access_codes` to make access codes course-specific

## Step 4: Test Database Connection

1. **Test connection from command line:**
```bash
mysql -u ptgr_user -p ptgr_db
```

2. **Test from Node.js application:**
```bash
npm start
```

You should see in the logs: "Database connection established"

## Step 5: Verify Setup

Run a simple query to verify:

```sql
-- In MySQL console
USE ptgr_db;
SHOW TABLES;
```

## Important Notes

1. **Schema Creation:** This application doesn't include SQL migration files. You'll need to:
   - Export schema from your existing database (if you have one)
   - OR create tables manually based on your application requirements
   - OR ask your DBA/team for the database schema

2. **Data Migration:** If you're migrating from an existing database:
   ```bash
   mysqldump -u root -p old_database > backup.sql
   mysql -u ptgr_user -p ptgr_db < backup.sql
   ```

3. **Redis Setup:** Make sure Redis is running:
   ```bash
   # Check if Redis is running
   redis-cli ping
   # Should return: PONG
   ```

4. **Security:** 
   - Never commit `.env` file to version control
   - Use strong passwords in production
   - Restrict database user privileges to only what's needed

## Troubleshooting

### Connection Refused
- Check MySQL is running: `sudo systemctl status mysql`
- Verify credentials in `.env`
- Check firewall settings

### Authentication Error
- Verify user has correct privileges
- Check password is correct
- Ensure user is allowed to connect from your host

### Table Doesn't Exist
- Verify all tables are created
- Check table names match exactly (case-sensitive on Linux)

### Character Encoding Issues
- Ensure database uses `utf8mb4` character set
- Verify connection uses `utf8mb4` charset (already set in database.js)

## Next Steps

After database setup:
1. Verify all environment variables are set
2. Start the application: `npm start`
3. Test API endpoints
4. Check logs for any errors


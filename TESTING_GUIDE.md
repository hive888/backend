# Testing Guide: Exit Exam Payment & University Management

This guide will help you verify that the exit exam payment and university management features have been successfully implemented.

## Prerequisites

1. **Database Migration**: Ensure the migration has been run
2. **Backend Server**: Ensure the backend is running
3. **Admin Token**: Have a valid admin token with `developer` role
4. **Stripe**: Ensure Stripe is configured (for payment testing)

---

## Step 1: Verify Database Migration

### Check if tables exist:

```sql
-- Connect to your database
mysql -u your_user -p your_database

-- Check if universities table exists
SHOW TABLES LIKE 'universities';

-- Check if exit_exam_payments table exists
SHOW TABLES LIKE 'exit_exam_payments';

-- Check if access_codes has new columns
DESCRIBE access_codes;
-- Should show: exit_exam_fee, university_id
```

### Run migration if needed:

```bash
mysql -u your_user -p your_database < migrations/exit_exam_and_universities.sql
```

---

## Step 2: Test University Management

### 2.1 Create a University

```bash
curl -X POST http://localhost:3000/api/admin/universities \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "university_name": "Test University",
    "stamp_image_url": "https://example.com/stamp.png",
    "is_active": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "University created successfully",
  "data": {
    "id": 1
  }
}
```

**Save the university_id for later use.**

### 2.2 Get All Universities

```bash
curl -X GET http://localhost:3000/api/admin/universities \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2.3 Get University by ID

```bash
curl -X GET http://localhost:3000/api/admin/universities/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2.4 Update University

```bash
curl -X PUT http://localhost:3000/api/admin/universities/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stamp_image_url": "https://example.com/new-stamp.png"
  }'
```

---

## Step 3: Test Access Code with Exit Exam Fee and University

### 3.1 Create Access Code with Exit Exam Fee

```bash
curl -X POST http://localhost:3000/api/admin/access-codes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "TEST2024",
    "payment_amount": 18.00,
    "payment_currency": "USD",
    "exit_exam_fee": 25.00,
    "university_id": 1,
    "max_uses": 100,
    "is_active": true
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Access code created successfully",
  "data": {
    "id": 1
  }
}
```

### 3.2 Get Access Code Details (Verify Fields)

```bash
curl -X GET http://localhost:3000/api/admin/access-codes/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response should include:**
```json
{
  "success": true,
  "data": {
    "access_code": {
      "id": 1,
      "code": "TEST2024",
      "exit_exam_fee": 25.00,
      "university_id": 1,
      "university_full_name": "Test University",
      "stamp_image_url": "https://example.com/stamp.png",
      ...
    }
  }
}
```

### 3.3 Update Access Code Exit Exam Fee

```bash
curl -X PUT http://localhost:3000/api/admin/access-codes/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "exit_exam_fee": 30.00
  }'
```

---

## Step 4: Test Exit Exam Payment Flow

### 4.1 Check Exit Exam Payment Status (Before Payment)

**Prerequisites:** 
- Customer must be registered with the access code
- Customer must have completed all subsections except the final quiz (subsection 259)

```bash
curl -X GET http://localhost:3000/api/course-access/exit-exam/payment/status \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
```

**Expected Response (if payment required):**
```json
{
  "success": true,
  "data": {
    "payment_required": true,
    "exit_exam_fee": 25.00,
    "currency": "USD",
    "payment_status": "not_started",
    "payment_id": null,
    "transaction_id": null
  }
}
```

**Expected Response (if free):**
```json
{
  "success": true,
  "data": {
    "payment_required": false,
    "payment_status": "free"
  }
}
```

### 4.2 Create Exit Exam Payment Session

```bash
curl -X POST http://localhost:3000/api/course-access/exit-exam/payment \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "success_url": "http://localhost:3000/payment/success",
    "cancel_url": "http://localhost:3000/payment/cancel"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Payment session created",
  "data": {
    "session_id": "cs_test_1234567890",
    "checkout_url": "https://checkout.stripe.com/...",
    "amount": 25.00,
    "currency": "USD",
    "payment_id": 1
  }
}
```

**Save the `checkout_url` and complete the payment in Stripe test mode.**

### 4.3 Verify Payment Status (After Payment)

```bash
curl -X GET http://localhost:3000/api/course-access/exit-exam/payment/status \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "payment_required": true,
    "exit_exam_fee": 25.00,
    "currency": "USD",
    "payment_status": "completed",
    "payment_id": 1,
    "transaction_id": "cs_test_1234567890"
  }
}
```

---

## Step 5: Test Final Quiz Access Control

### 5.1 Try to Access Final Quiz Without Payment

**Prerequisites:** 
- Customer has NOT completed exit exam payment
- Customer has completed all subsections before final quiz

```bash
curl -X GET http://localhost:3000/api/course-access/sections/259/quiz \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
```

**Expected Response (Payment Required):**
```json
{
  "success": false,
  "code": "EXIT_EXAM_PAYMENT_REQUIRED",
  "message": "Exit exam payment required to access final quiz",
  "data": {
    "exit_exam_fee": 25.00,
    "currency": "USD",
    "access_code_id": 1,
    "payment_required": true
  }
}
```

**Status Code:** `402 Payment Required`

### 5.2 Try to Submit Final Quiz Without Payment

```bash
curl -X POST http://localhost:3000/api/course-access/sections/259/quiz/submit \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [...]
  }'
```

**Expected Response:** Same as above (402 Payment Required)

### 5.3 Access Final Quiz After Payment

**After completing payment, try again:**

```bash
curl -X GET http://localhost:3000/api/course-access/sections/259/quiz \
  -H "Authorization: Bearer CUSTOMER_TOKEN"
```

**Expected Response:** Quiz data should be returned (200 OK)

---

## Step 6: Test Certificate Generation with University Stamp

### 6.1 Complete Final Quiz (After Payment)

```bash
curl -X POST http://localhost:3000/api/course-access/sections/259/quiz/submit \
  -H "Authorization: Bearer CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "answers": [
      {"question_id": 1, "option_id": 1},
      {"question_id": 2, "option_id": 3}
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "passed": true,
  "score": 85,
  "certificate_url": "https://s3.amazonaws.com/.../certificate.pdf"
}
```

### 6.2 Verify Certificate Includes University Stamp

1. Download the certificate from `certificate_url`
2. Open the PDF
3. Verify that the university stamp appears on the certificate
4. Verify student name is correctly displayed

---

## Step 7: Test Admin Exit Exam Payment Management

### 7.1 Get All Exit Exam Payments

```bash
curl -X GET http://localhost:3000/api/admin/exit-exam-payments \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": 1,
        "customer_id": 123,
        "access_code_id": 1,
        "amount": 25.00,
        "currency": "USD",
        "payment_status": "completed",
        "transaction_id": "cs_test_1234567890",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com",
        "access_code": "TEST2024",
        "university_name": "Test University"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 50
  }
}
```

### 7.2 Get Exit Exam Payment by ID

```bash
curl -X GET http://localhost:3000/api/admin/exit-exam-payments/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 7.3 Filter Exit Exam Payments

```bash
# By customer
curl -X GET "http://localhost:3000/api/admin/exit-exam-payments?customer_id=123" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# By access code
curl -X GET "http://localhost:3000/api/admin/exit-exam-payments?access_code_id=1" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# By payment status
curl -X GET "http://localhost:3000/api/admin/exit-exam-payments?payment_status=completed" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Step 8: Test Webhook Processing

### 8.1 Simulate Stripe Webhook

**Note:** In production, Stripe sends webhooks automatically. For testing, you can use Stripe CLI:

```bash
# Install Stripe CLI if not installed
# https://stripe.com/docs/stripe-cli

# Forward webhooks to local server
stripe listen --forward-to http://localhost:3000/api/webhook/stripe-webhook

# Trigger a test payment completion
stripe trigger checkout.session.completed
```

### 8.2 Verify Payment Status Updated

After webhook processing, check the payment status:

```bash
curl -X GET http://localhost:3000/api/admin/exit-exam-payments/1 \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Verify:**
- `payment_status` is `completed`
- `payment_date` is set
- `transaction_id` matches Stripe session ID

---

## Step 9: Test Edge Cases

### 9.1 Access Code with Zero Exit Exam Fee

```bash
# Create access code with free exit exam
curl -X POST http://localhost:3000/api/admin/access-codes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "FREE2024",
    "exit_exam_fee": 0.00,
    "payment_amount": 18.00
  }'
```

**Test:** Customer should be able to access final quiz without payment.

### 9.2 Access Code Without University

```bash
# Create access code without university_id
curl -X POST http://localhost:3000/api/admin/access-codes \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "NOUNIV2024",
    "exit_exam_fee": 25.00,
    "payment_amount": 18.00
  }'
```

**Test:** Certificate should generate without university stamp.

### 9.3 Multiple Payments Attempt

```bash
# Try to create payment session twice
curl -X POST http://localhost:3000/api/course-access/exit-exam/payment \
  -H "Authorization: Bearer CUSTOMER_TOKEN"

# Should return existing session if pending
```

---

## Step 10: Database Verification

### 10.1 Check Exit Exam Payments Table

```sql
SELECT * FROM exit_exam_payments;
```

**Verify:**
- Records are created correctly
- Payment status updates correctly
- Transaction IDs are stored

### 10.2 Check Access Codes Table

```sql
SELECT id, code, exit_exam_fee, university_id FROM access_codes;
```

**Verify:**
- `exit_exam_fee` values are correct
- `university_id` foreign keys are valid

### 10.3 Check Universities Table

```sql
SELECT * FROM universities;
```

**Verify:**
- Universities are created correctly
- Stamp URLs are stored

---

## Common Issues & Troubleshooting

### Issue 1: Migration Fails

**Error:** `Table 'universities' already exists`

**Solution:** 
```sql
-- Check if tables exist
SHOW TABLES LIKE 'universities';

-- If exists, check structure
DESCRIBE universities;

-- If missing columns, add them manually
ALTER TABLE access_codes ADD COLUMN exit_exam_fee DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE access_codes ADD COLUMN university_id BIGINT NULL;
```

### Issue 2: Payment Status Not Updating

**Check:**
1. Webhook endpoint is accessible
2. Stripe webhook secret is configured
3. Payment tracking record exists
4. Check server logs for webhook processing

### Issue 3: Certificate Not Generating with Stamp

**Check:**
1. University stamp_image_url is valid and accessible
2. Access code has university_id set
3. Certificate generation logs for errors
4. S3 upload permissions

### Issue 4: Quiz Still Accessible Without Payment

**Check:**
1. Access code has `exit_exam_fee > 0`
2. Customer has completed all previous subsections
3. Payment status check is working
4. Backend server restarted after code changes

---

## Testing Checklist

- [ ] Database migration completed successfully
- [ ] Universities table created
- [ ] Exit exam payments table created
- [ ] Access codes table has new columns
- [ ] Can create university via admin API
- [ ] Can create access code with exit_exam_fee
- [ ] Can create access code with university_id
- [ ] Exit exam payment status endpoint works
- [ ] Exit exam payment session creation works
- [ ] Final quiz blocked without payment (402 error)
- [ ] Final quiz accessible after payment
- [ ] Certificate generated with university stamp
- [ ] Admin can view exit exam payments
- [ ] Webhook processes exit exam payments
- [ ] Payment status updates correctly
- [ ] Free exit exam (fee = 0) allows access
- [ ] Certificate without university works

---

## Quick Test Script

Save this as `test_exit_exam.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
ADMIN_TOKEN="YOUR_ADMIN_TOKEN"
CUSTOMER_TOKEN="YOUR_CUSTOMER_TOKEN"

echo "=== Testing University Management ==="
curl -X POST "$BASE_URL/api/admin/universities" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"university_name": "Test University", "stamp_image_url": "https://example.com/stamp.png"}'

echo -e "\n=== Testing Access Code with Exit Exam Fee ==="
curl -X POST "$BASE_URL/api/admin/access-codes" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "TEST2024", "exit_exam_fee": 25.00, "university_id": 1, "payment_amount": 18.00}'

echo -e "\n=== Testing Exit Exam Payment Status ==="
curl -X GET "$BASE_URL/api/course-access/exit-exam/payment/status" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN"

echo -e "\n=== Testing Exit Exam Payment Creation ==="
curl -X POST "$BASE_URL/api/course-access/exit-exam/payment" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"success_url": "http://localhost:3000/success", "cancel_url": "http://localhost:3000/cancel"}'

echo -e "\n=== Testing Admin Exit Exam Payments ==="
curl -X GET "$BASE_URL/api/admin/exit-exam-payments" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

echo -e "\n=== Testing Complete ==="
```

Make it executable:
```bash
chmod +x test_exit_exam.sh
./test_exit_exam.sh
```

---

## Support

If you encounter issues:
1. Check server logs: `docker compose logs backend`
2. Check database: Verify tables and data
3. Check Stripe dashboard: Verify payment sessions
4. Review API responses: Check error codes and messages

For additional help, contact: info@hive888.org


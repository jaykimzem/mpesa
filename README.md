# M-Pesa STK Push Integration for Vercel

This is a serverless backend for handling M-Pesa Lipa Na M-Pesa Online (STK Push) payments.

## Deployment to Vercel

1. **Install Vercel CLI**: `npm i -g vercel`
2. **Login**: `vercel login`
3. **Deploy**: `vercel`
4. **Environment Variables**: Add the following keys in your Vercel Dashboard:
   - `MPESA_CONSUMER_KEY`
   - `MPESA_CONSUMER_SECRET`
   - `MPESA_PASSKEY`
   - `MPESA_SHORTCODE`
   - `CALLBACK_URL` (e.g., `https://your-app.vercel.app/api/callback`)
   - `SUPABASE_URL`
   - `SUPABASE_KEY`

## API Endpoints

### 1. Initiate STK Push
**POST** `/api/stkpush`
```json
{
  "amount": 1,
  "phone": "2547XXXXXXXX",
  "reference": "Order123"
}
```

### 2. Callback Handler
**POST** `/api/callback`
(Called automatically by Safaricom)

## Local Testing
1. Install dependencies: `npm install`
2. Run locally using Vercel CLI: `vercel dev`

## Database Setup
Run this in Supabase to create the payments log:
```sql
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkout_request_id TEXT UNIQUE,
    amount DECIMAL,
    receipt_number TEXT,
    phone_number TEXT,
    status TEXT,
    raw_callback JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

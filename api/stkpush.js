// REQUIRED: Forces Vercel to use Node.js runtime, NOT Edge Runtime.
// Buffer, crypto, and other Node.js globals are unavailable in Edge Runtime.
// Without this, Buffer.from(...).toString('base64') throws ReferenceError.
export const runtime = 'nodejs';

import axios from 'axios';

export default async function handler(req, res) {
    console.log('[stkpush] ====== FUNCTION INVOKED ======');
    console.log('[stkpush] Method:', req.method);

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── ENV VAR AUDIT ──────────────────────────────────────────────────────
    // These will print 'undefined' if not set in Vercel Dashboard.
    // Vercel does NOT read .env files in production.
    console.log('[stkpush] ENV CHECK:');
    console.log('  MPESA_CONSUMER_KEY    :', process.env.MPESA_CONSUMER_KEY    ? '[SET]' : '*** UNDEFINED ***');
    console.log('  MPESA_CONSUMER_SECRET :', process.env.MPESA_CONSUMER_SECRET ? '[SET]' : '*** UNDEFINED ***');
    console.log('  MPESA_SHORTCODE       :', process.env.MPESA_SHORTCODE       || '*** UNDEFINED ***');
    console.log('  MPESA_PASSKEY         :', process.env.MPESA_PASSKEY         ? '[SET]' : '*** UNDEFINED ***');
    console.log('  CALLBACK_URL          :', process.env.CALLBACK_URL          || '*** UNDEFINED ***');

    const { amount, phone, reference } = req.body;
    console.log('[stkpush] Payload received → phone:', phone, '| amount:', amount, '| reference:', reference);

    if (!amount || !phone) {
        console.error('[stkpush] Validation failed: missing amount or phone');
        return res.status(400).json({ error: 'Amount and phone are required' });
    }

    // Safaricom allows max 12 chars for AccountReference
    const safeReference = String(reference || 'Payment').substring(0, 12).replace(/[^a-zA-Z0-9]/g, '');

    // Format phone number to 254XXXXXXXXX
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
    }
    if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
    }
    console.log('[stkpush] Formatted phone:', formattedPhone);

    try {
        // ── STEP 1: GET ACCESS TOKEN ───────────────────────────────────────
        console.log('[stkpush] Step 1: Generating Basic auth credential...');

        // Buffer is available here because runtime = 'nodejs'
        // If CONSUMER_KEY or CONSUMER_SECRET are undefined, this encodes
        // "undefined:undefined" → Daraja returns 401. Check env vars.
        const rawCredential = `${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`;
        const auth = Buffer.from(rawCredential).toString('base64');
        console.log('[stkpush] Step 1: Basic auth encoded (length):', auth.length);

        console.log('[stkpush] Step 1: Fetching access token from Daraja...');
        let accessToken;
        try {
            const tokenResponse = await axios.get(
                'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
                {
                    headers: { Authorization: `Basic ${auth}` },
                    timeout: 15000
                }
            );
            accessToken = tokenResponse.data.access_token;
            console.log('[stkpush] Step 1: Access token acquired ✓');
        } catch (tokenErr) {
            const tokenErrData = tokenErr.response ? tokenErr.response.data : tokenErr.message;
            console.error('[stkpush] Step 1 FAILED — Token fetch error:', JSON.stringify(tokenErrData));
            return res.status(502).json({
                error: 'Failed to get Daraja access token',
                stage: 'token_fetch',
                details: tokenErrData
            });
        }

        // ── STEP 2: STK PUSH ───────────────────────────────────────────────
        console.log('[stkpush] Step 2: Building STK Push request...');
        const shortCode = process.env.MPESA_SHORTCODE;
        const passkey   = process.env.MPESA_PASSKEY;
        const callbackUrl = process.env.CALLBACK_URL;

        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password  = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

        console.log('[stkpush] Step 2: Timestamp:', timestamp);
        console.log('[stkpush] Step 2: ShortCode:', shortCode);
        console.log('[stkpush] Step 2: CallbackURL:', callbackUrl);
        console.log('[stkpush] Step 2: AccountReference:', safeReference);

        // Verify callbackUrl is not the placeholder before sending
        if (!callbackUrl || callbackUrl.includes('your-vercel-domain')) {
            console.error('[stkpush] Step 2 ABORTED — CALLBACK_URL is still a placeholder!');
            return res.status(500).json({
                error: 'CALLBACK_URL environment variable is not configured',
                stage: 'stk_push',
                hint: 'Set CALLBACK_URL in Vercel Dashboard → Settings → Environment Variables'
            });
        }

        let stkData;
        try {
            const stkResponse = await axios.post(
                'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
                {
                    BusinessShortCode: shortCode,
                    Password: password,
                    Timestamp: timestamp,
                    TransactionType: 'CustomerPayBillOnline',
                    Amount: amount,
                    PartyA: formattedPhone,
                    PartyB: shortCode,
                    PhoneNumber: formattedPhone,
                    CallBackURL: callbackUrl,
                    AccountReference: safeReference,
                    TransactionDesc: 'Payment for Marathon Registration'
                },
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    timeout: 15000
                }
            );
            stkData = stkResponse.data;
            console.log('[stkpush] Step 2: STK Push response:', JSON.stringify(stkData));
        } catch (stkErr) {
            const stkErrData = stkErr.response ? stkErr.response.data : stkErr.message;
            console.error('[stkpush] Step 2 FAILED — STK Push error:', JSON.stringify(stkErrData));
            return res.status(502).json({
                error: 'STK Push request failed',
                stage: 'stk_push',
                details: stkErrData
            });
        }

        console.log('[stkpush] ====== SUCCESS ======');
        return res.status(200).json(stkData);

    } catch (error) {
        console.error('[stkpush] Unexpected error:', error.message);
        return res.status(500).json({
            error: 'Unexpected server error',
            stage: 'unknown',
            details: error.message
        });
    }
}

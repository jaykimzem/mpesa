// REQUIRED: Forces Node.js runtime on Vercel.
// Supabase SDK and body parsing both require Node.js globals.
// Edge Runtime would strip these and cause silent failures.
export const runtime = 'nodejs';

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    console.log('[callback] ====== CALLBACK INVOKED ======');
    console.log('[callback] Method:', req.method);
    console.log('[callback] Time:', new Date().toISOString());

    // ── ENV VAR AUDIT ────────────────────────────────────────────────────
    console.log('[callback] ENV CHECK:');
    console.log('  SUPABASE_URL :', process.env.SUPABASE_URL  ? '[SET]' : '*** UNDEFINED ***');
    console.log('  SUPABASE_KEY :', process.env.SUPABASE_KEY  ? '[SET]' : '*** UNDEFINED ***');

    // Safaricom only sends POST — but respond 200 to GET too (health check)
    if (req.method === 'GET') {
        console.log('[callback] Health check ping received.');
        return res.status(200).json({ status: 'Callback endpoint is live' });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // ── BODY GUARD ───────────────────────────────────────────────────────
    // Vercel auto-parses application/json into req.body.
    // If Safaricom sends an unexpected shape, guard here.
    console.log('[callback] Raw body received:', JSON.stringify(req.body));

    if (!req.body || !req.body.Body || !req.body.Body.stkCallback) {
        console.error('[callback] Malformed callback body — missing Body.stkCallback');
        // Always return 200 to Safaricom to prevent retry storms
        return res.status(200).json({ status: 'Received but malformed' });
    }

    const callbackData = req.body.Body.stkCallback;
    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = callbackData;

    console.log(`[callback] CheckoutRequestID : ${CheckoutRequestID}`);
    console.log(`[callback] ResultCode        : ${ResultCode}`);
    console.log(`[callback] ResultDesc        : ${ResultDesc}`);

    // ── SUPABASE CLIENT ──────────────────────────────────────────────────
    // Instantiate inside the handler so env vars are evaluated at runtime,
    // not at module load time (which is safer in serverless environments).
    const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_KEY
    );

    if (ResultCode === 0) {
        // ── TRANSACTION SUCCESSFUL ───────────────────────────────────────
        console.log('[callback] Payment SUCCESSFUL — extracting metadata...');

        const items = CallbackMetadata?.Item || [];
        const amount  = items.find(i => i.Name === 'Amount')?.Value;
        const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
        const phone   = items.find(i => i.Name === 'PhoneNumber')?.Value;

        console.log('[callback] Amount :', amount);
        console.log('[callback] Receipt:', receipt);
        console.log('[callback] Phone  :', phone);

        try {
            console.log('[callback] Writing to Supabase payments table...');
            const { data, error } = await supabase
                .from('payments')
                .insert([
                    {
                        checkout_request_id: CheckoutRequestID,
                        amount:              amount,
                        receipt_number:      receipt,
                        phone_number:        phone,
                        status:              'Completed',
                        raw_callback:        JSON.stringify(req.body)
                    }
                ]);

            if (error) {
                console.error('[callback] Supabase insert error:', JSON.stringify(error));
                throw error;
            }

            console.log('[callback] Supabase insert success ✓');
            // Must return 200 to Safaricom — any other code triggers retries
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Success' });

        } catch (dbError) {
            console.error('[callback] Database update failed:', dbError.message || dbError);
            // Still return 200 to Safaricom to stop retries;
            // investigate the DB error separately in logs.
            return res.status(200).json({ ResultCode: 0, ResultDesc: 'Received — DB error logged' });
        }

    } else {
        // ── TRANSACTION FAILED / CANCELLED ──────────────────────────────
        console.warn(`[callback] Payment NOT completed. Code: ${ResultCode} | Desc: ${ResultDesc}`);

        try {
            await supabase
                .from('payments')
                .insert([
                    {
                        checkout_request_id: CheckoutRequestID,
                        status:              'Failed',
                        raw_callback:        JSON.stringify(req.body)
                    }
                ]);
            console.log('[callback] Failed payment logged to Supabase ✓');
        } catch (logErr) {
            console.error('[callback] Could not log failed payment:', logErr.message);
        }

        // Always return 200 — Safaricom retries on any non-200
        return res.status(200).json({ ResultCode: 0, ResultDesc: 'Failure logged' });
    }
}

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export default async function handler(req, res) {
    // Safaricom sends a POST request with the JSON body
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const callbackData = req.body.Body.stkCallback;
    const { ResultCode, ResultDesc, CheckoutRequestID, CallbackMetadata } = callbackData;

    console.log(`Callback Received: ${CheckoutRequestID} - ${ResultDesc}`);

    if (ResultCode === 0) {
        // Transaction Successful
        const items = CallbackMetadata.Item;
        const amount = items.find(i => i.Name === 'Amount')?.Value;
        const receipt = items.find(i => i.Name === 'MpesaReceiptNumber')?.Value;
        const phone = items.find(i => i.Name === 'PhoneNumber')?.Value;
        
        // Use the AccountReference or other logic to find the record.
        // For now, let's assume we log it to a 'payments' table or update 'registrations'
        // If we want to update registrations, we need a unique identifier passed in AccountReference
        
        try {
            // Update Supabase
            // Example: Update registration where phone matches (Note: might not be unique if someone registers multiple times)
            // Better: Use a dedicated 'payments' table to log everything
            const { data, error } = await supabase
                .from('payments')
                .insert([
                    {
                        checkout_request_id: CheckoutRequestID,
                        amount: amount,
                        receipt_number: receipt,
                        phone_number: phone,
                        status: 'Completed',
                        raw_callback: JSON.stringify(req.body)
                    }
                ]);

            if (error) throw error;

            return res.status(200).json({ status: 'Success' });
        } catch (error) {
            console.error('Supabase Update Error:', error);
            return res.status(500).json({ error: 'Database update failed' });
        }
    } else {
        // Transaction Failed
        console.warn(`Payment failed or cancelled: ${ResultDesc}`);
        return res.status(200).json({ status: 'Failure Logged' });
    }
}

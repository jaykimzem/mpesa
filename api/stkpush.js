const axios = require('axios');
require('dotenv').config();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { amount, phone, reference } = req.body;

    if (!amount || !phone) {
        return res.status(400).json({ error: 'Amount and phone are required' });
    }

    // Safaricom allows max 12 chars for AccountReference
    const safeReference = String(reference || 'Phumolo').substring(0, 12).replace(/[^a-zA-Z0-9]/g, '');

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

    try {
        // 1. Get Access Token
        const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
        const tokenResponse = await axios.get(
            'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { headers: { Authorization: `Basic ${auth}` } }
        );
        const accessToken = tokenResponse.data.access_token;

        // 2. Prepare STK Push
        const shortCode = process.env.MPESA_SHORTCODE;
        const passkey = process.env.MPESA_PASSKEY;
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
        const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

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
                CallBackURL: process.env.CALLBACK_URL,
                AccountReference: safeReference,
                TransactionDesc: 'Payment for Marathon Registration'
            },
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        return res.status(200).json(stkResponse.data);
    } catch (error) {
        console.error('STK Push Error:', error.response ? error.response.data : error.message);
        return res.status(500).json({
            error: 'Failed to initiate STK Push',
            details: error.response ? error.response.data : error.message
        });
    }
}

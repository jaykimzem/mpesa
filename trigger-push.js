const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

async function triggerPush() {
    const amount = 50;
    const phone = '0727856464';
    const reference = 'PhumoloTest';

    console.log(`--- Initiating STK Push ---`);
    console.log(`Target: ${phone}`);
    console.log(`Amount: KES ${amount}`);

    // Format phone number
    let formattedPhone = phone.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
    }

    const safeReference = String(reference || 'Phumolo').substring(0, 12).replace(/[^a-zA-Z0-9]/g, '');

    try {
        // 1. Get Access Token
        console.log('1. Fetching access token...');
        const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
        const tokenResponse = await axios.get(
            'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            { 
                headers: { Authorization: `Basic ${auth}` },
                timeout: 30000 
            }
        );
        const accessToken = tokenResponse.data.access_token;
        console.log('   Token acquired.');

        // 2. Prepare STK Push
        console.log('2. Sending STK Push request...');
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
                TransactionDesc: 'Test Payment'
            },
            { 
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 30000
            }
        );

        console.log('\n--- SUCCESS ---');
        console.log('Response from Safaricom:', stkResponse.data);
        console.log('\nCheck your phone for the STK prompt!');
    } catch (error) {
        console.log('\n--- ERROR ---');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Message:', error.message);
        }
    }
}

triggerPush();

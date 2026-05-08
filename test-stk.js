const axios = require('axios');

async function testSTK() {
    const payload = {
        amount: 1, // KSH 1 for testing
        phone: '254712345678', // Replace with your test phone number
        reference: 'TestPayment'
    };

    try {
        console.log('Initiating test STK Push...');
        const response = await axios.post('http://localhost:3000/api/stkpush', payload);
        console.log('Success:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        console.log('\nTip: Make sure you are running "vercel dev" and have your .env configured.');
    }
}

testSTK();

import axios from 'axios';

async function checkConnectivity() {
    const urls = [
        'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        'https://www.google.com'
    ];

    for (const url of urls) {
        console.log(`Checking ${url}...`);
        try {
            await axios.get(url, { timeout: 10000 });
            console.log(`   OK!`);
        } catch (error) {
            console.log(`   FAILED: ${error.message}`);
        }
    }
}

checkConnectivity();

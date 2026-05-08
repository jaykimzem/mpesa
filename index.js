const express = require('express');
const bodyParser = require('body-parser');
const stkpush = require('./api/stkpush').default;
const callback = require('./api/callback').default;
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Mock Vercel req/res for local express testing
const wrap = (fn) => (req, res) => {
    res.status = (code) => {
        res.statusCode = code;
        return res;
    };
    res.json = (data) => {
        res.send(data);
        return res;
    };
    return fn(req, res);
};

app.post('/api/stkpush', wrap(stkpush));
app.post('/api/callback', wrap(callback));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`M-Pesa STK Push Server running on port ${PORT}`);
});

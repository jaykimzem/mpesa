import express from 'express';
import bodyParser from 'body-parser';
import stkpush from './api/stkpush.js';
import callback from './api/callback.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

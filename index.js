const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { connectToDB, getDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const corsOptions = {
    origin: [
        'https://certisure-frontend-7ibzfhgoi-krishna-s-projects-ee812af8.vercel.app',  // Your actual frontend URL
        'https://certisure-frontend.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Helper function to create a stable, deterministic hash
function createStableHash(data) {
    const sortObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) return obj;
        return Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = sortObject(obj[key]);
            return acc;
        }, {});
    };
    const sortedData = sortObject(data);
    const stringToHash = JSON.stringify(sortedData);
    return crypto.createHash('sha256').update(stringToHash).digest('hex');
}

// Simple test endpoint
app.get('/', (req, res) => {
    res.json({ message: 'CertiSure Backend is running!' });
});

// API endpoint for creating certificate records
app.post('/api/create-record', async (req, res) => {
    try {
        const { certificateData } = req.body;
        
        if (!certificateData) {
            return res.status(400).json({ message: 'Certificate data is required.' });
        }

        const dataHash = createStableHash(certificateData);
        const db = getDB();
        
        const existing = await db.collection('certificates').findOne({ dataHash: dataHash });

        if (existing) {
            return res.status(409).json({ message: 'This certificate already exists in the database.' });
        }

        await db.collection('certificates').insertOne({ ...certificateData, dataHash });
        res.status(201).json({ message: 'Certificate record created successfully.' });

    } catch (error) {
        console.error('Error in /api/create-record:', error);
        res.status(500).json({ message: error.message });
    }
});

// API endpoint for verifying certificate records
app.post('/api/verify-record', async (req, res) => {
    try {
        const { dataHash } = req.body;
        
        if (!dataHash) {
            return res.status(400).json({ message: 'Data hash is required.' });
        }

        const db = getDB();
        const foundCertificate = await db.collection('certificates').findOne({ dataHash: dataHash });

        if (foundCertificate) {
            const { _id, dataHash, ...certDetails } = foundCertificate;
            res.status(200).json({ verified: true, certificate: certDetails });
        } else {
            res.status(404).json({ verified: false, message: 'Verification Failed: Certificate not found.' });
        }
    } catch (error) {
        console.error('Error in /api/verify-record:', error);
        res.status(500).json({ message: error.message });
    }
});

// Export for Vercel Serverless
module.exports = app;

// Only listen if not in serverless environment
if (require.main === module) {
    connectToDB().then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    });
}
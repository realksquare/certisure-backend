const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const multer = require('multer');
const { getDocument } = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
const jsQR = require('jsqr');
const { connectToDB, getDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

// Helper function to create a stable, deterministic hash
function createStableHash(data) {
    const sortObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }
        return Object.keys(obj).sort().reduce((acc, key) => {
            acc[key] = sortObject(obj[key]);
            return acc;
        }, {});
    };
    const sortedData = sortObject(data);
    const stringToHash = JSON.stringify(sortedData);
    return crypto.createHash('sha256').update(stringToHash).digest('hex');
}

async function getQrDataFromPdf(buffer) {
    const data = new Uint8Array(buffer);
    const pdf = await getDocument(data).promise;
    const page = await pdf.getPage(1);

    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
        return code.data;
    }
    throw new Error('Could not find a QR code in the first page of the PDF.');
}

//API Endpoints

app.post('/api/upload-for-creation', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No PDF file uploaded.' });

        const rawQrData = await getQrDataFromPdf(req.file.buffer);
        const certificateData = JSON.parse(rawQrData);
        const dataHash = createStableHash(certificateData);

        const db = getDB();
        const existing = await db.collection('certificates').findOne({ dataHash: dataHash });

        if (existing) {
            return res.status(409).json({ message: 'This certificate already exists in the database.' });
        }

        await db.collection('certificates').insertOne({ ...certificateData, dataHash });
        res.status(201).json({ message: 'Certificate record created successfully.' });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

app.post('/api/upload-for-verification', upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No PDF file uploaded.' });

        const rawQrData = await getQrDataFromPdf(req.file.buffer);
        const certificateData = JSON.parse(rawQrData);
        const dataHash = createStableHash(certificateData);

        const db = getDB();
        const foundCertificate = await db.collection('certificates').findOne({ dataHash: dataHash });

        if (foundCertificate) {
            const { _id, dataHash, ...certDetails } = foundCertificate;
            res.status(200).json({ verified: true, certificate: certDetails });
        } else {
            res.status(404).json({ verified: false, message: 'Verification Failed: Certificate not found.' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

connectToDB().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});
require('dotenv').config();
const { MongoClient } = require('mongodb');

let db;
let client;

const connectToDB = async () => {
    // If already connected and the connection is alive, return
    if (db && client && client.topology && client.topology.isConnected()) {
        return db;
    }

    try {
        const uri = process.env.MONGO_URI;
        
        if (!uri) {
            console.error('🔥 Error: MONGO_URI is not defined. Make sure you have a .env file with the connection string.');
            process.exit(1);
        }

        client = new MongoClient(uri);
        await client.connect();
        db = client.db("CertiSure");
        console.log('Connected successfully to MongoDB!');
        return db;
        
    } catch (err) {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    }
};

const getDB = () => {
    if (!db) {
        throw new Error('Database not connected!');
    }
    return db;
};

module.exports = { connectToDB, getDB };
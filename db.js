require('dotenv').config(); 

const { MongoClient } = require('mongodb');

const uri = process.env.MONGO_URI; 

if (!uri) {
    console.error("🔥 Error: MONGO_URI is not defined. Make sure you have a .env file with the connection string.");
    process.exit(1);
}

const client = new MongoClient(uri);

let db;

const connectToDB = async () => {
    if (db) return db;
    try {
        await client.connect();
        db = client.db("CertiSure");
        console.log("Connected successfully to MongoDB!");
        return db;
    } catch (err) {
        console.error("Failed to connect to MongoDB", err);
        process.exit(1);
    }
};

const getDB = () => {
    if (!db) {
        throw new Error("Database not connected!");
    }
    return db;
};

module.exports = { connectToDB, getDB };

/**
 * SHIELDHER DATA MIGRATION ENGINE
 * Purpose: Importing 500+ records from CSV to MongoDB
 */

const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');

// 1. DATABASE CONNECTION
mongoose.connect('mongodb://localhost:27017/shieldher')
    .then(() => console.log("📡 SHIELDHER DB: CONNECTION ESTABLISHED"))
    .catch(err => console.error("❌ CONNECTION ERROR: Ensure MongoDB is running!", err));

// 2. DATA MODEL (Matches your CSV Columns)
const CrimeSchema = new mongoose.Schema({
    year: Number,
    city: String,
    area: String,
    policeStation: String,
    crimeType: String,
    cases: Number,
    location: { lat: Number, lng: Number } 
});

const CrimeNode = mongoose.model('CrimeNode', CrimeSchema);

// 3. GEOSPATIAL MAPPING (Coimbatore Coordinates)
const areaCoordinates = {
    "Ukkadam": { lat: 10.9911, lng: 76.9611 },
    "Saibaba Colony": { lat: 11.0305, lng: 76.9511 },
    "Peelamedu": { lat: 11.0330, lng: 76.9997 },
    "Podanur": { lat: 10.9667, lng: 76.9833 },
    "Saravanampatti": { lat: 11.0900, lng: 76.9900 },
    "Gandhipuram": { lat: 11.0206, lng: 76.9680 },
    "Thudiyalur": { lat: 11.0667, lng: 76.9333 },
    "Town Hall": { lat: 10.9967, lng: 76.9661 },
    "Kuniyamuthur": { lat: 10.9614, lng: 76.9545 },
    "Perur": { lat: 10.9667, lng: 76.9167 },
    "Singanallur": { lat: 11.0000, lng: 77.0333 },
    "RS Puram": { lat: 11.0122, lng: 76.9362 },
    "SREC": { lat: 11.0617, lng: 76.9953 } 
};

// 4. IMPORT LOGIC
async function importAllData() {
    try {
        // Clear existing data so we don't have duplicates
        await CrimeNode.deleteMany({});
        console.log("🧹 Cleaning old records from 'crimenodes' collection...");

        const results = [];
        let skippedCount = 0;

        // READ THE CSV FILE
        // Replace 'Coimbatore_dataset.csv' with your actual filename if different
        fs.createReadStream('data.csv')
            .pipe(csv()) 
            .on('data', (row) => {
                // Get the Area from the CSV and clean it
                const rawArea = row['Area'] ? row['Area'].trim() : "";
                
                // Find coordinates (Case-insensitive check)
                const coordKey = Object.keys(areaCoordinates).find(
                    key => key.toLowerCase() === rawArea.toLowerCase()
                );

                if (coordKey) {
                    results.push({
                        year: parseInt(row['Year']),
                        city: row['City'],
                        area: coordKey,
                        policeStation: row['Police Station'],
                        crimeType: row['Crime Type'],
                        cases: parseInt(row['Number of Cases']),
                        location: areaCoordinates[coordKey]
                    });
                } else {
                    skippedCount++;
                }
            })
            .on('end', async () => {
                if (results.length > 0) {
                    await CrimeNode.insertMany(results);
                    console.log(`✅ SUCCESS: ${results.length} records imported to MongoDB.`);
                    if (skippedCount > 0) {
                        console.log(`⚠️ NOTE: ${skippedCount} rows skipped. (Area names didn't match our coordinates list)`);
                    }
                } else {
                    console.log("❌ ERROR: No data found. Check your CSV filename and column headers.");
                }
                console.log("Process complete. You can now run 'node server.js'");
                process.exit();
            });
            
    } catch (err) {
        console.error("❌ SYSTEM ERROR:", err);
        process.exit(1);
    }
}

importAllData();
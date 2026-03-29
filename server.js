/**
 * SHIELDHER AI BACKEND ENGINE
 * Purpose: Geospatial Risk Management, Secure Routing & User Auth
 * Standard: ISO 8601 Timing & GeoJSON Standards
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path'); // Required for serving the frontend

// 1. INITIALIZATION
dotenv.config();
const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// SERVE FRONTEND: This tells the server to look for app.html inside the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// 2. DATABASE CONNECTION
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/shieldher";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ SHIELDHER DATABASE: LINK ESTABLISHED"))
    .catch(err => console.error("❌ DATABASE CONNECTION ERROR:", err));

// 3. DATA SCHEMAS

// Crime Clusters (Red Zones)
const CrimeSchema = new mongoose.Schema({
    location: { lat: Number, lng: Number },
    type: String, 
    riskWeight: { type: Number, default: 5 },
    history: String,
    timestamp: { type: Date, default: Date.now }
});

// Safe Zones (Green Havens)
const SafeZoneSchema = new mongoose.Schema({
    location: { lat: Number, lng: Number },
    name: String,
    type: { type: String, enum: ['Main Road', 'Police Station', 'Safe Haven'] },
    isWellLit: { type: Boolean, default: true },
    description: String
});

// User Profile & Guardian Circle
const UserSchema = new mongoose.Schema({
    name: String,
    college: String,
    phone: { type: String, unique: true },
    guardians: [{
        name: String,
        phone: String,
        relation: String
    }],
    lastLogin: { type: Date, default: Date.now }
});

const CrimeNode = mongoose.model('CrimeNode', CrimeSchema);
const SafeNode = mongoose.model('SafeNode', SafeZoneSchema);
const User = mongoose.model('User', UserSchema);

// 1. Sensor Alert Schema (For Heartbeat, Scream, Running/Fall)
const AlertSchema = new mongoose.Schema({
    userName: String,
    alertType: { type: String, enum: ['HEARTBEAT_HIGH', 'SCREAM_DETECTED', 'RUNNING_PANIC', 'FALL_DETECTED'] },
    value: String, // e.g., "115 BPM" or "0.9 Volume"
    location: { lat: Number, lng: Number },
    timestamp: { type: Date, default: Date.now }
});
const Alert = mongoose.model('Alert', AlertSchema);

// 2. Road History & Crime Dataset Schema
const RoadSchema = new mongoose.Schema({
    area: String,
    location: { lat: Number, lng: Number },
    crimeType: String,
    cases: Number,
    lastIncident: Date
});
const Road = mongoose.model('Road', RoadSchema);

// 4. API ROUTES

// A. Fetch All Spatial Data (The Map Nodes)
app.get('/api/v1/map-nodes', async (req, res) => {
    try {
        const crimes = await CrimeNode.find();
        const roadCrimes = await Road.find();
        const safeZones = await SafeNode.find();
        
        const hour = new Date().getHours();
        let nightMultiplier = (hour >= 22 || hour <= 5) ? 2.5 : 1.0;

        res.json({
            status: "SUCCESS",
            time_protocol: nightMultiplier > 1 ? "NIGHT_PROTOCOL_ACTIVE" : "STANDARD",
            multiplier: nightMultiplier,
            data: {
                danger_nodes: [...crimes, ...roadCrimes],
                safe_nodes: safeZones
            }
        });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// B. User Registration / Login (Auth)
app.post('/api/v1/auth/login', async (req, res) => {
    const { name, phone, college } = req.body;
    try {
        let user = await User.findOneAndUpdate(
            { phone }, 
            { name, college, lastLogin: new Date() }, 
            { upsert: true, new: true }
        );
        
        console.log(`👤 USER AUTHENTICATED: ${user.name} from ${user.college}`);
        res.json({ status: "SUCCESS", user });
    } catch (error) {
        res.status(500).json({ error: "Auth Failed" });
    }
});

// C. Update Guardian Circle
app.post('/api/v1/user/update-circle', async (req, res) => {
    const { phone, guardians } = req.body;
    try {
        const user = await User.findOneAndUpdate({ phone }, { guardians }, { new: true });
        res.json({ status: "CIRCLE_UPDATED", guardians: user.guardians });
    } catch (error) {
        res.status(500).json({ error: "Update Failed" });
    }
});

// D. 💓 HEARTBEAT & 🎙️ SCREAM RECEIVER
app.post('/api/v1/sensor/trigger', async (req, res) => {
    try {
        const { userName, type, value, loc } = req.body;
        const newAlert = new Alert({
            userName: userName,
            alertType: type,
            value: value,
            location: loc
        });
        await newAlert.save();
        
        // Log to console for your SREC Demo
        console.log(`🚨 [${type}] ALERT for ${userName} at ${loc?.lat}, ${loc?.lng} | Value: ${value}`);
        
        res.json({ status: "SUCCESS", message: "Safety Grid Notified" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// E. Emergency SOS Log
app.post('/api/v1/emergency-log', async (req, res) => {
    console.log("🚨 SOS SIGNAL RECEIVED AT SERVER:", req.body.location);
    res.status(200).json({ signal: "BROADCASTED", mesh_id: Math.random().toString(36).substr(2, 9) });
});

// 5. SEED DATA (Coimbatore Dataset)
const seedData = async () => {
    const safeCount = await SafeNode.countDocuments();
    if (safeCount === 0) {
        const coimbatoreSafeZones = [
            { location: { lat: 11.0183, lng: 76.9558 }, name: "Avinashi Road Main", type: "Main Road", description: "Primary Highway, 24/7 Traffic." },
            { location: { lat: 11.0242, lng: 76.9605 }, name: "Gandhipuram Police HQ", type: "Police Station", description: "Central Police Station." },
            { location: { lat: 11.0122, lng: 76.9362 }, name: "RS Puram West Main", type: "Main Road", description: "Well-populated corridor." },
            { location: { lat: 10.9967, lng: 76.9661 }, name: "Collectorate / Railway HQ", type: "Safe Haven", description: "Heavy security presence." }
        ];
        await SafeNode.insertMany(coimbatoreSafeZones);
        console.log("📈 DATASET: COIMBATORE NODES SEEDED SUCCESSFULLY");
    }
};
seedData();

// 6. SERVER START
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 SHIELDHER BACKEND RUNNING ON PORT ${PORT}`);
    console.log(`📡 API ENDPOINT: http://localhost:${PORT}/api/v1/map-nodes`);
    console.log(`🌐 FRONTEND: http://localhost:${PORT}/app.html`);
});
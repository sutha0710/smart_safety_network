/**
 * SHIELDHER AI BACKEND ENGINE
 * Purpose: Geospatial Risk Management, Secure Routing, Sensor Alert Processing
 * Standard: ISO 8601 Timing & GeoJSON
 *
 * SENSOR ENDPOINTS:
 *   POST /api/v1/sensor/trigger
 *     Accepts types: HEARTBEAT_HIGH | SCREAM_DETECTED | RUNNING_PANIC | FALL_DETECTED
 *
 *   GET  /api/v1/sensor/alerts        — Recent alerts (last 50)
 *   GET  /api/v1/sensor/alerts/:type  — Alerts filtered by type
 *   GET  /api/v1/sensor/stats         — Alert count summary per type
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// ============================================================
//  1. INITIALIZATION
// ============================================================
dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

// Serve the frontend from the 'public' folder
// Place app.html inside /public/app.html
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
//  2. DATABASE CONNECTION
// ============================================================
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/shieldher';

mongoose.connect(MONGO_URI)
    .then(() => console.log('✅ SHIELDHER DATABASE: LINK ESTABLISHED'))
    .catch(err => console.error('❌ DATABASE CONNECTION ERROR:', err));

// ============================================================
//  3. SCHEMAS
// ============================================================

// --- Crime Clusters (Red Zones) ---
const CrimeSchema = new mongoose.Schema({
    location: { lat: Number, lng: Number },
    type: String,
    riskWeight: { type: Number, default: 5 },
    history: String,
    timestamp: { type: Date, default: Date.now }
});

// --- Safe Zones (Green Havens) ---
const SafeZoneSchema = new mongoose.Schema({
    location: { lat: Number, lng: Number },
    name: String,
    type: { type: String, enum: ['Main Road', 'Police Station', 'Safe Haven'] },
    isWellLit: { type: Boolean, default: true },
    description: String
});

// --- User Profile & Guardian Circle ---
const UserSchema = new mongoose.Schema({
    name: String,
    college: String,
    phone: { type: String, unique: true },
    guardians: [{ name: String, phone: String, relation: String }],
    lastLogin: { type: Date, default: Date.now }
});

// --- Road Crime Dataset (for route safety scoring) ---
const RoadSchema = new mongoose.Schema({
    area: String,
    location: { lat: Number, lng: Number },
    crimeType: String,
    cases: Number,
    lastIncident: Date
});

// --- Sensor Alert Log ---
// ✅ Extended to include SCREAM_DETECTED
const AlertSchema = new mongoose.Schema({
    userName: String,
    alertType: {
        type: String,
        enum: [
            'HEARTBEAT_HIGH',   // 💓 BPM > threshold (105)
            'SCREAM_DETECTED',  // 🎙️ Mic amplitude > 85%
            'RUNNING_PANIC',    // 🏃 Sustained motion 15G+ for 10+ ticks
            'FALL_DETECTED'     // 📉 Sudden G-force spike > 35G
        ]
    },
    value: String,          // e.g. "115 BPM", "0.9 Volume", "38.4G"
    location: { lat: Number, lng: Number },
    timestamp: { type: Date, default: Date.now }
});

const CrimeNode = mongoose.model('CrimeNode', CrimeSchema);
const SafeNode = mongoose.model('SafeNode', SafeZoneSchema);
const User = mongoose.model('User', UserSchema);
const Road = mongoose.model('Road', RoadSchema);
const Alert = mongoose.model('Alert', AlertSchema);

// ============================================================
//  4. API ROUTES
// ============================================================

// ── A. Fetch All Spatial Data (Map Nodes) ──────────────────
app.get('/api/v1/map-nodes', async (req, res) => {
    try {
        const crimes = await CrimeNode.find();
        const roadCrimes = await Road.find();
        const safeZones = await SafeNode.find();

        const hour = new Date().getHours();
        const nightMultiplier = (hour >= 22 || hour <= 5) ? 2.5 : 1.0;

        res.json({
            status: 'SUCCESS',
            time_protocol: nightMultiplier > 1 ? 'NIGHT_PROTOCOL_ACTIVE' : 'STANDARD',
            multiplier: nightMultiplier,
            data: {
                danger_nodes: [...crimes, ...roadCrimes],
                safe_nodes: safeZones
            }
        });
    } catch (error) {
        console.error('map-nodes error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ── B. User Auth / Registration ────────────────────────────
app.post('/api/v1/auth/login', async (req, res) => {
    const { name, phone, college } = req.body;
    try {
        const user = await User.findOneAndUpdate(
            { phone },
            { name, college, lastLogin: new Date() },
            { upsert: true, new: true }
        );
        console.log(`👤 USER AUTHENTICATED: ${user.name}`);
        res.json({ status: 'SUCCESS', user });
    } catch (error) {
        res.status(500).json({ error: 'Auth Failed' });
    }
});

// ── C. Update Guardian Circle ─────────────────────────────
app.post('/api/v1/user/update-circle', async (req, res) => {
    const { phone, guardians } = req.body;
    try {
        const user = await User.findOneAndUpdate({ phone }, { guardians }, { new: true });
        res.json({ status: 'CIRCLE_UPDATED', guardians: user.guardians });
    } catch (error) {
        res.status(500).json({ error: 'Update Failed' });
    }
});

// ── D. 🚨 SENSOR TRIGGER ENDPOINT ─────────────────────────
//
//  Receives from the frontend when any sensor threshold is crossed.
//  Sensor types and what triggers them:
//
//  FALL_DETECTED    — √(X²+Y²+Z²) > 35G  (devicemotion API)
//  RUNNING_PANIC    — √(X²+Y²+Z²) > 15G  for 10+ consecutive frames
//  HEARTBEAT_HIGH   — Simulated BPM > 105  (every 3s interval)
//  SCREAM_DETECTED  — Mic amplitude > 0.85 (Web Audio API)
//
app.post('/api/v1/sensor/trigger', async (req, res) => {
    try {
        const { userName, type, value, loc } = req.body;

        // Validate alert type
        const validTypes = ['HEARTBEAT_HIGH', 'SCREAM_DETECTED', 'RUNNING_PANIC', 'FALL_DETECTED'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: `Invalid alert type: ${type}` });
        }

        const newAlert = new Alert({
            userName: userName || 'Unknown',
            alertType: type,
            value: value || 'N/A',
            location: loc || { lat: 0, lng: 0 }
        });

        await newAlert.save();

        // Console log with emoji per sensor type
        const emoji = {
            FALL_DETECTED: '📉',
            RUNNING_PANIC: '🏃',
            HEARTBEAT_HIGH: '💓',
            SCREAM_DETECTED: '🎙️'
        };

        console.log(
            `${emoji[type]} [${type}] ALERT ` +
            `for ${userName} ` +
            `at ${loc?.lat?.toFixed(4)}, ${loc?.lng?.toFixed(4)} ` +
            `| Value: ${value}`
        );

        res.json({ status: 'SUCCESS', message: 'Safety Grid Notified', alertId: newAlert._id });

    } catch (err) {
        console.error('sensor/trigger error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ── E. GET Recent Alerts (Last 50) ────────────────────────
app.get('/api/v1/sensor/alerts', async (req, res) => {
    try {
        const alerts = await Alert.find()
            .sort({ timestamp: -1 })
            .limit(50);
        res.json({ status: 'SUCCESS', count: alerts.length, alerts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── F. GET Alerts Filtered by Type ────────────────────────
app.get('/api/v1/sensor/alerts/:type', async (req, res) => {
    try {
        const type = req.params.type.toUpperCase();
        const alerts = await Alert.find({ alertType: type })
            .sort({ timestamp: -1 })
            .limit(20);
        res.json({ status: 'SUCCESS', type, count: alerts.length, alerts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── G. GET Alert Statistics Summary ───────────────────────
app.get('/api/v1/sensor/stats', async (req, res) => {
    try {
        const stats = await Alert.aggregate([
            {
                $group: {
                    _id: '$alertType',
                    count: { $sum: 1 },
                    last: { $max: '$timestamp' }
                }
            },
            { $sort: { count: -1 } }
        ]);
        res.json({ status: 'SUCCESS', stats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── H. Emergency SOS Log ──────────────────────────────────
app.post('/api/v1/emergency-log', async (req, res) => {
    const { location, reason, user } = req.body;
    console.log(`🚨 SOS SIGNAL from ${user} | Reason: ${reason} | Loc: ${location?.lat}, ${location?.lng}`);
    res.status(200).json({
        signal: 'BROADCASTED',
        mesh_id: Math.random().toString(36).substr(2, 9)
    });
});

// ============================================================
//  5. SEED DATA (Coimbatore Dataset)
// ============================================================
const seedData = async () => {
    const safeCount = await SafeNode.countDocuments();
    if (safeCount === 0) {
        const safeZones = [
            { location: { lat: 11.0183, lng: 76.9558 }, name: 'Avinashi Road Main', type: 'Main Road', description: 'Primary Highway, 24/7 Traffic.' },
            { location: { lat: 11.0242, lng: 76.9605 }, name: 'Gandhipuram Police HQ', type: 'Police Station', description: 'Central Police Station.' },
            { location: { lat: 11.0122, lng: 76.9362 }, name: 'RS Puram West Main', type: 'Main Road', description: 'Well-populated corridor.' },
            { location: { lat: 10.9967, lng: 76.9661 }, name: 'Collectorate / Railway HQ', type: 'Safe Haven', description: 'Heavy security presence.' }
        ];
        await SafeNode.insertMany(safeZones);
        console.log('📈 DATASET: COIMBATORE SAFE NODES SEEDED');
    }

    const roadCount = await Road.countDocuments();
    if (roadCount === 0) {
        // Sample Coimbatore crime hotspot data for route scoring
        const roadData = [
            { area: 'Gandhipuram', location: { lat: 11.0244, lng: 76.9609 }, crimeType: 'Theft', cases: 42, lastIncident: new Date('2024-09-15') },
            { area: 'Ukkadam', location: { lat: 10.9931, lng: 76.9642 }, crimeType: 'Eve-Teasing', cases: 28, lastIncident: new Date('2024-10-02') },
            { area: 'Singanallur', location: { lat: 11.0019, lng: 77.0200 }, crimeType: 'Assault', cases: 17, lastIncident: new Date('2024-08-20') },
            { area: 'Peelamedu', location: { lat: 11.0335, lng: 77.0072 }, crimeType: 'Robbery', cases: 11, lastIncident: new Date('2024-07-11') },
            { area: 'Saibaba Colony', location: { lat: 11.0241, lng: 76.9408 }, crimeType: 'Theft', cases: 9, lastIncident: new Date('2024-09-01') }
        ];
        await Road.insertMany(roadData);
        console.log('📈 DATASET: COIMBATORE ROAD CRIME NODES SEEDED');
    }
};

// ============================================================
//  6. SERVER START
// ============================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log('');
    console.log('🚀 SHIELDHER BACKEND RUNNING');
    console.log(`📡 API:      http://localhost:${PORT}/api/v1/map-nodes`);
    console.log(`🌐 FRONTEND: http://localhost:${PORT}/app.html`);
    console.log('');
    console.log('📊 SENSOR ENDPOINTS:');
    console.log(`   POST /api/v1/sensor/trigger         — Receive sensor alert`);
    console.log(`   GET  /api/v1/sensor/alerts          — Last 50 alerts`);
    console.log(`   GET  /api/v1/sensor/alerts/:type    — Filter by type`);
    console.log(`   GET  /api/v1/sensor/stats           — Alert count stats`);
    console.log('');
    console.log('   Valid types: FALL_DETECTED | RUNNING_PANIC | HEARTBEAT_HIGH | SCREAM_DETECTED');
    console.log('');

    // Seed database after server starts
    seedData();
});
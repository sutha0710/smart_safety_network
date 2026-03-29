# 🛡️ Smart Safety Network
**A Geospatial Risk Management & Personal Safety System for Coimbatore.**

Smart Safety Network is a comprehensive safety platform designed for the general public. It integrates real-time location tracking, historical crime data visualization, and hardware sensor support to provide a 360-degree safety net for citizens, students, and workers.

---

## 🚀 Key Features
* **Live Safety Map:** Visualizes 500+ safety-indexed data points across Coimbatore using Leaflet.js.
* **Intelligent Risk Assessment:** Uses a "Night Protocol" backend that automatically scales risk weights between 10 PM and 5 AM.
* **Safe-Route Navigation:** (In Progress) Algorithms to calculate paths that avoid high-risk "Danger Nodes."
* **Guardian Circle:** Users can manage a circle of trusted contacts stored securely in MongoDB.
* **IoT Sensor Integration:** Built-in endpoints to receive data from hardware sensors (e.g., fall detection or panic buttons).

---

## 🛠️ Tech Stack
* **Frontend:** HTML5, CSS3, JavaScript (ES6+), Leaflet.js
* **Backend:** Node.js, Express.js
* **Database:** MongoDB (Local/Atlas)
* **API Standards:** ISO 8601 Timing & GeoJSON Standards

---

## 📂 Updated Project Structure
```text
smart_safety_network/
├── public/               # Frontend Assets
│   ├── app.html          # Main Safety Map
│   ├── login.html        # User Authentication Entry
│   ├── settings.html     # Guardian Circle & Profile Management
│   ├── app.js            # Frontend Logic & Map Plotting
│   └── style.css         # Professional UI Styling
├── data/                 # Data Resources
│   ├── data.csv          # Coimbatore Dataset (500+ Rows)
│   └── master_import.js  # Database Seeding Script
├── server.js             # Main Node.js API Engine
├── .gitignore            # Git Exclusion Rules
└── README.md             # Project Documentation

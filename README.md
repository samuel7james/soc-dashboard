# 🛡️ SOC Dashboard - Security Operations Centre

A real-time security monitoring dashboard built with Node.js, WebSocket, and modern web technologies. Perfect for cybersecurity demonstrations and security operations centres.

## Features

- 🔄 Real-time security scanning (every 10 seconds)
- 📡 WebSocket live updates
- 🎨 Modern, responsive UI
- 🛡️ Multi-module security monitoring
- 🔍 Live threat detection
- 📈 Interactive charts and visualizations
- 🗺️ Geographic threat mapping
- ⚡ Performance optimized
- 🐳 Docker support
- 🔧 Cross-platform (Windows, Linux, macOS)

## Quick Start

### Prerequisites

- **Node.js** 14+ ([Download](https://nodejs.org/))
- **Git** (for Windows users - Git Bash)
- **Modern Browser** (Chrome, Firefox, Safari, Edge)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/samuel7james/soc-dashboard.git
   cd soc-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the dashboard**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

### Docker Installation

```bash
# Clone and run with Docker
git clone https://github.com/samuel7james/soc-dashboard.git
cd soc-dashboard
docker-compose up -d

# Open in browser
# http://localhost:3000
```

## Usage

### Real-Time Scanning

- **Automatic Start** - Real-time scanning starts automatically
- **Manual Control** - Use Start/Stop buttons in the header
- **Live Updates** - Dashboard updates every 10 seconds
- **Status Monitoring** - Check real-time status indicator

### Dashboard Sections

1. **Overview** - Security summary, threat levels, and system metrics
2. **Login Monitor** - Failed login attempts, top attackers, and login statistics
3. **Network** - Port scans, open ports, and network connections
4. **Processes** - Suspicious process detection and resource monitoring
5. **Files** - File integrity monitoring and recent changes
6. **Threats** - Geographic threat mapping and attack sources
7. **Alerts** - Security alerts and notifications

## Architecture

### Frontend
- HTML5/CSS3 - Modern, responsive interface
- Vanilla JavaScript - No framework dependencies
- Chart.js - Real-time data visualization
- WebSocket - Real-time communication
- Font Awesome - Professional icons

### Backend
- Node.js - Server runtime
- Express.js - Web framework
- WebSocket - Real-time updates
- Bash Scripts - Security monitoring scripts
- JSON - Data storage format

## API Endpoints

### Core Endpoints
- `GET /api/dashboard` - Complete dashboard data
- `GET /api/logins` - Login monitoring data
- `GET /api/network` - Network monitoring data
- `GET /api/processes` - Process monitoring data
- `GET /api/files` - File monitoring data
- `GET /api/threats` - Threat intelligence data
- `GET /api/alerts` - Security alerts data

### Real-time Endpoints
- `POST /api/scan/start-realtime` - Start real-time scanning
- `POST /api/scan/stop-realtime` - Stop real-time scanning
- `GET /api/scan/status` - Real-time scanning status
- `POST /api/scan/run` - Run manual security scan

## Security Scripts

The dashboard uses several bash scripts for security monitoring:

- **`monitor_logins.sh`** - Monitors failed login attempts and brute force attacks
- **`detect_portscans.sh`** - Detects port scanning activities
- **`check_processes.sh`** - Monitors suspicious processes
- **`monitor_files.sh`** - Tracks file integrity and changes
- **`geolocate_ips.sh`** - Geolocates IP addresses for threat mapping
- **`generate_report.sh`** - Generates comprehensive security reports

## Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   export NODE_ENV=production
   export PORT=3000
   ```

2. **Process Management (PM2)**
   ```bash
   npm install -g pm2
   pm2 start api/api_server.js --name soc-dashboard
   pm2 startup
   pm2 save
   ```

3. **Docker Deployment**
   ```bash
   docker-compose up -d
   ```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**⭐ Star this repository if you find it useful!**

**🛡️ Built with ❤️ for the cybersecurity community** 

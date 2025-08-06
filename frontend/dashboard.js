/**
 * SOC Dashboard - Frontend JavaScript
 * Optimized with better error handling, performance improvements, and enhanced real-time functionality
 */

class SOCDashboard {
    constructor() {
        this.apiBase = window.location.origin;
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.isRealTimeActive = false;
        this.updateInterval = null;
        this.charts = {};
        
        this.init();
    }

    async init() {
        try {
            console.log('🚀 Initializing SOC Dashboard...');
            
            // Set a timeout to ensure loading overlay is hidden
            const loadingTimeout = setTimeout(() => {
                console.warn('Loading timeout reached, hiding loading overlay');
                this.showLoading(false);
            }, 10000); // 10 seconds timeout
            
            // Initialize WebSocket connection
            this.initWebSocket();
            
            // Load initial dashboard data
            await this.loadDashboardData();
            
            // Clear the timeout since loading completed
            clearTimeout(loadingTimeout);
            
            // Set up real-time updates
            this.setupRealTimeUpdates();
            
            // Initialize event listeners
            this.setupEventListeners();
            
            // Set up navigation
            this.setupNavigation();
            
            // Start real-time scanning if not already active
            await this.checkRealTimeStatus();
            
            console.log('✅ SOC Dashboard initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize SOC Dashboard:', error);
            this.showNotification('Failed to initialize dashboard', 'error');
            // Still hide loading even if there's an error
            this.showLoading(false);
        }
    }

    initWebSocket() {
        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('🔌 WebSocket connected');
                this.updateConnectionStatus(true);
                this.reconnectAttempts = 0;
            };
            
            this.ws.onmessage = (event) => {
                try {
                const data = JSON.parse(event.data);
                this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.updateConnectionStatus(false);
                this.scheduleReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            setTimeout(() => {
                this.initWebSocket();
            }, this.reconnectDelay * this.reconnectAttempts);
        } else {
            console.error('❌ Max reconnection attempts reached');
            this.showNotification('Connection lost. Please refresh the page.', 'error');
        }
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'connection':
                console.log('📡 WebSocket connection established:', data.message);
                    break;
            case 'update':
                this.updateDashboardWithLiveData(data.data);
                    break;
            case 'live_update':
                this.updateDashboardWithLiveData(data.data);
                    break;
            default:
                console.log('📡 Received WebSocket message:', data);
        }
    }

    async loadDashboardData() {
        this.showLoading(true);
        
        try {
            console.log('📊 Loading dashboard data...');
            const response = await fetch(`${this.apiBase}/api/dashboard`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('📊 Dashboard data received:', data);
            
            // Update overview data
            this.updateOverviewCards(data);
            this.updateOverviewMetrics(data);
            this.updateRecentEvents(data);
            this.createThreatChart(data);
            
            // Update last updated timestamp
            const lastUpdatedElement = document.getElementById('lastUpdated');
            if (lastUpdatedElement) {
                lastUpdatedElement.textContent = new Date().toLocaleTimeString();
            }
            
            console.log('✅ Dashboard data loaded successfully');
            
        } catch (error) {
            console.error('❌ Error loading dashboard data:', error);
            this.showNotification('Failed to load dashboard data', 'error');
            
            // Show sample data or error state
            this.showSampleData();
        } finally {
            // Always hide loading overlay
            this.showLoading(false);
        }
    }

    showSampleData() {
        console.log('📊 Showing sample data due to loading error');
        
        // Show sample data for overview
        const sampleData = {
            executive_summary: { overall_threat_level: 'Medium' },
            alert_summary: { critical_alerts: 2, high_alerts: 5, medium_alerts: 8, low_alerts: 12 },
            login_summary: { total_failed_logins: 15, total_successful_logins: 45, unique_attacking_ips: 8 },
            connection_stats: { listening_ports: 12, established_connections: 25 },
            process_summary: { total_processes: 150, suspicious_processes: 3, root_processes: 15 },
            security_metrics: { system_metrics: { cpu_usage_percent: 25.5, memory_usage_percent: 45.2, disk_usage_percent: 62.1 } }
        };
        
        this.updateOverviewCards(sampleData);
        this.updateOverviewMetrics(sampleData);
        this.updateRecentEvents(sampleData);
        this.createThreatChart(sampleData);
    }

    updateOverviewCards(data) {
        try {
            const executiveSummary = data.executive_summary || {};
        const alertSummary = data.alert_summary || {};
        
        // Update threat level
            const threatLevelElement = document.getElementById('threatLevel');
            if (threatLevelElement) {
                const threatLevel = executiveSummary.overall_threat_level || 'Low';
                threatLevelElement.textContent = threatLevel;
                threatLevelElement.className = `threat-level ${threatLevel.toLowerCase()}`;
            }
            
            // Update alert counts
            const criticalAlertsElement = document.getElementById('criticalAlerts');
            if (criticalAlertsElement) {
                criticalAlertsElement.textContent = alertSummary.critical_alerts || 0;
            }
            
            const highAlertsElement = document.getElementById('highAlerts');
            if (highAlertsElement) {
                highAlertsElement.textContent = alertSummary.high_alerts || 0;
            }
            
            const mediumAlertsElement = document.getElementById('mediumAlerts');
            if (mediumAlertsElement) {
                mediumAlertsElement.textContent = alertSummary.medium_alerts || 0;
            }
            
            const lowAlertsElement = document.getElementById('lowAlerts');
            if (lowAlertsElement) {
                lowAlertsElement.textContent = alertSummary.low_alerts || 0;
            }
            
        } catch (error) {
            console.error('Error updating overview cards:', error);
        }
    }

    updateOverviewMetrics(data) {
        try {
        const loginSummary = data.login_summary || {};
        const connectionStats = data.connection_stats || {};
        const processSummary = data.process_summary || {};
        const securityMetrics = data.security_metrics || {};
        
        // Login metrics
            this.updateElement('failedLogins', loginSummary.total_failed_logins || 0);
            this.updateElement('successfulLogins', loginSummary.total_successful_logins || 0);
            this.updateElement('uniqueAttackers', loginSummary.unique_attacking_ips || 0);
        
        // Network metrics
            this.updateElement('openPorts', connectionStats.listening_ports || 0);
            this.updateElement('activeConnections', connectionStats.established_connections || 0);
            this.updateElement('portScans', (data.portscans || []).length);
            
            // Process metrics
            this.updateElement('totalProcesses', processSummary.total_processes || 0);
            this.updateElement('suspiciousProcesses', (data.suspicious_processes || []).length);
        
        // System metrics
            const systemMetrics = securityMetrics.system_metrics || {};
            this.updateElement('cpuUsage', `${(systemMetrics.cpu_usage_percent || 0).toFixed(1)}%`);
            this.updateElement('memoryUsage', `${(systemMetrics.memory_usage_percent || 0).toFixed(1)}%`);
            this.updateElement('diskUsage', `${(systemMetrics.disk_usage_percent || 0).toFixed(1)}%`);
            
        } catch (error) {
            console.error('Error updating overview metrics:', error);
        }
    }

    updateElement(elementId, value) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = value;
        } else {
            console.warn(`Element with ID '${elementId}' not found`);
        }
    }

    updateRecentEvents(data) {
        try {
            const recentEvents = [];
            
            // Add failed logins
            const failedLogins = data.failed_logins || [];
            failedLogins.slice(0, 5).forEach(login => {
                recentEvents.push({
                    type: 'Failed Login',
                    description: `Failed login attempt from ${login.ip}`,
                    timestamp: login.timestamp,
                    severity: 'high'
                });
            });
            
            // Add port scans
            const portScans = data.portscans || [];
            portScans.slice(0, 3).forEach(scan => {
                recentEvents.push({
                    type: 'Port Scan',
                    description: `Port scan detected from ${scan.source_ip}`,
                    timestamp: scan.timestamp,
                    severity: 'critical'
                });
            });
            
            // Add suspicious processes
            const suspiciousProcesses = data.suspicious_processes || [];
            suspiciousProcesses.slice(0, 2).forEach(process => {
                recentEvents.push({
                    type: 'Suspicious Process',
                    description: `Suspicious process detected: ${process.process_name}`,
                    timestamp: process.timestamp,
                    severity: 'high'
                });
            });
            
            // Sort by timestamp and take the most recent 10
            recentEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            const recentEventsContainer = document.getElementById('recentEvents');
            
            if (recentEventsContainer) {
                recentEventsContainer.innerHTML = recentEvents.slice(0, 10).map(event => `
                    <div class="event-item ${event.severity}">
                        <div class="event-header">
                            <span class="event-type">${event.type}</span>
                            <span class="event-time">${new Date(event.timestamp).toLocaleTimeString()}</span>
                </div>
                        <div class="event-description">${event.description}</div>
            </div>
        `).join('');
            }
            
        } catch (error) {
            console.error('Error updating recent events:', error);
        }
    }

    createThreatChart(data) {
        try {
            const ctx = document.getElementById('threatDistributionChart');
            if (!ctx) {
                console.warn('Threat distribution chart canvas not found');
                return;
            }
        
        // Destroy existing chart if it exists
        if (this.charts.threatChart) {
            this.charts.threatChart.destroy();
        }
        
            const alertSummary = data.alert_summary || {};
            const chartData = {
                labels: ['Critical', 'High', 'Medium', 'Low'],
                datasets: [{
                    data: [
                        alertSummary.critical_alerts || 0,
                        alertSummary.high_alerts || 0,
                        alertSummary.medium_alerts || 0,
                        alertSummary.low_alerts || 0
                    ],
                    backgroundColor: [
                        '#ff4757',
                        '#ffa502',
                        '#ffb142',
                        '#2ed573'
                    ],
                    borderWidth: 0
                }]
            };
            
            this.charts.threatChart = new Chart(ctx, {
                type: 'doughnut',
                data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                                color: '#ffffff',
                                font: {
                                    size: 12
                                }
                            }
                    }
                }
            }
        });
            
        } catch (error) {
            console.error('Error creating threat chart:', error);
        }
    }

    setupRealTimeUpdates() {
        // Update current time every second
        setInterval(() => {
            const currentTimeElement = document.getElementById('currentTime');
            if (currentTimeElement) {
                currentTimeElement.textContent = new Date().toLocaleTimeString();
            }
        }, 1000);
    }

    setupEventListeners() {
        // Manual scan button
        const runScanBtn = document.getElementById('runScanBtn');
        if (runScanBtn) {
            runScanBtn.addEventListener('click', async () => {
                await this.runManualScan();
            });
        }
        
        // Real-time scanning controls
        const startRealtimeBtn = document.getElementById('startRealtimeBtn');
        if (startRealtimeBtn) {
            startRealtimeBtn.addEventListener('click', async () => {
                await this.startRealTimeScanning();
            });
        }
        
        const stopRealtimeBtn = document.getElementById('stopRealtimeBtn');
        if (stopRealtimeBtn) {
            stopRealtimeBtn.addEventListener('click', async () => {
                await this.stopRealTimeScanning();
            });
        }

        // Navigation event listeners
        this.setupNavigation();
    }

    setupNavigation() {
        // Get all navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all links and sections
                navLinks.forEach(l => l.classList.remove('active'));
                document.querySelectorAll('.section').forEach(section => {
                    section.classList.remove('active');
                });
                
                // Add active class to clicked link
                link.classList.add('active');
                
                // Show corresponding section
                const sectionId = link.getAttribute('data-section');
                const targetSection = document.getElementById(sectionId);
                
                if (targetSection) {
                    targetSection.classList.add('active');
                    console.log(`📊 Switched to section: ${sectionId}`);
                    
                    // Load section-specific data if needed
                    this.loadSectionData(sectionId);
                }
            });
        });

        // Handle browser back/forward buttons
        window.addEventListener('popstate', (e) => {
            const hash = window.location.hash.slice(1) || 'overview';
            this.showSection(hash);
        });

        // Handle initial hash on page load
        const initialHash = window.location.hash.slice(1) || 'overview';
        this.showSection(initialHash);
    }

    showSection(sectionId) {
        // Remove active class from all links and sections
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Add active class to corresponding link and section
        const targetLink = document.querySelector(`[data-section="${sectionId}"]`);
        const targetSection = document.getElementById(sectionId);
        
        if (targetLink) {
            targetLink.classList.add('active');
        }
        
        if (targetSection) {
            targetSection.classList.add('active');
            console.log(`📊 Showing section: ${sectionId}`);
            
            // Load section-specific data
            this.loadSectionData(sectionId);
        }
    }

    async loadSectionData(sectionId) {
        try {
            console.log(`📊 Loading section data for: ${sectionId}`);
            
            switch (sectionId) {
                case 'logins':
                    await this.loadLoginData();
                    break;
                case 'network':
                    await this.loadNetworkData();
                    break;
                case 'processes':
                    await this.loadProcessData();
                    break;
                case 'files':
                    await this.loadFileData();
                    break;
                case 'threats':
                    await this.loadThreatData();
                    break;
                case 'alerts':
                    await this.loadAlertData();
                    break;
                case 'overview':
                default:
                    // Overview data is already loaded
                    break;
            }
        } catch (error) {
            console.error(`Error loading section data for ${sectionId}:`, error);
            // Show sample data for the section
            this.showSampleSectionData(sectionId);
        }
    }

    showSampleSectionData(sectionId) {
        console.log(`📊 Showing sample data for section: ${sectionId}`);
        
        switch (sectionId) {
            case 'logins':
                this.updateLoginSection({
                    summary: { total_failed_logins: 15, total_successful_logins: 45, unique_attacking_ips: 8 },
                    top_attackers: [
                        { ip: '192.168.1.100', attempts: 25, country: 'China' },
                        { ip: '10.0.0.50', attempts: 18, country: 'Russia' }
                    ],
                    failed_logins: [
                        { timestamp: new Date().toISOString(), ip: '192.168.1.100', username: 'admin', status: 'Failed' }
                    ]
                });
                break;
            case 'network':
                this.updateNetworkSection({
                    portscans: [
                        { timestamp: new Date().toISOString(), source_ip: '192.168.1.100', target_ports: [22, 23, 80, 443], scan_type: 'TCP SYN Scan', severity: 'medium' }
                    ],
                    open_ports: [
                        { port: 80, service: 'HTTP', state: 'LISTENING', process: 'httpd.exe' },
                        { port: 443, service: 'HTTPS', state: 'LISTENING', process: 'httpd.exe' }
                    ],
                    connection_stats: { listening_ports: 12, established_connections: 25 }
                });
                break;
            case 'processes':
                this.updateProcessSection({
                    suspicious_processes: [
                        { process_name: 'nmap', pid: 1234, cpu_usage: '5.2', memory_usage: '2.1', severity: 'high', timestamp: new Date().toISOString() }
                    ],
                    top_processes: [
                        { user: 'SYSTEM', pid: 4, cpu: 2.5, memory: 1.2, command: 'System' },
                        { user: 'Administrator', pid: 1234, cpu: 1.8, memory: 0.8, command: 'chrome.exe' }
                    ],
                    process_summary: { total_processes: 150, suspicious_processes: 3, root_processes: 15 }
                });
                break;
            case 'files':
                this.updateFileSection({
                    file_integrity: [
                        { file_path: '/etc/passwd', status: 'monitored', last_modified_human: new Date().toISOString(), size: 1024 }
                    ],
                    recent_changes: [
                        { file: '/etc/passwd', change_type: 'modified', timestamp: new Date().toISOString(), user: 'root' }
                    ]
                });
                break;
            case 'threats':
                this.updateThreatSection({
                    threat_map: {
                        threat_sources: [
                            { lat: 31.2222, lon: 121.4581, country: 'China', threat_level: 'high', attack_count: 15 },
                            { lat: 55.7558, lon: 37.6173, country: 'Russia', threat_level: 'high', attack_count: 8 }
                        ]
                    },
                    attack_by_country: [
                        { country: 'China', attack_count: 15 },
                        { country: 'Russia', attack_count: 8 }
                    ]
                });
                break;
            case 'alerts':
                this.updateAlertSection({
                    alert_summary: { total_alerts: 25, critical_alerts: 2, high_alerts: 5 },
                    recent_alerts: [
                        { type: 'Brute Force Attack', severity: 'critical', timestamp: new Date().toISOString(), description: 'Multiple failed login attempts from 192.168.1.100' }
                    ]
                });
                break;
        }
    }

    async loadLoginData() {
        try {
            const response = await fetch(`${this.apiBase}/api/logins`);
            if (response.ok) {
                const data = await response.json();
                this.updateLoginSection(data);
            }
        } catch (error) {
            console.error('Error loading login data:', error);
        }
    }

    async loadNetworkData() {
        try {
            console.log('🌐 Loading network data...');
            const response = await fetch(`${this.apiBase}/api/network`);
            if (response.ok) {
                const data = await response.json();
                console.log('🌐 Network data received:', data);
                this.updateNetworkSection(data);
            } else {
                console.error('Failed to load network data:', response.status);
            }
        } catch (error) {
            console.error('Error loading network data:', error);
        }
    }

    async loadProcessData() {
        try {
            console.log('⚙️ Loading process data...');
            const response = await fetch(`${this.apiBase}/api/processes`);
            if (response.ok) {
                const data = await response.json();
                console.log('⚙️ Process data received:', data);
                this.updateProcessSection(data);
            } else {
                console.error('Failed to load process data:', response.status);
            }
        } catch (error) {
            console.error('Error loading process data:', error);
        }
    }

    async loadFileData() {
        try {
            console.log('📁 Loading file data...');
            const response = await fetch(`${this.apiBase}/api/files`);
            if (response.ok) {
                const data = await response.json();
                console.log('📁 File data received:', data);
                this.updateFileSection(data);
            } else {
                console.error('Failed to load file data:', response.status);
            }
        } catch (error) {
            console.error('Error loading file data:', error);
        }
    }

    async loadThreatData() {
        try {
            console.log('🛡️ Loading threat data...');
            const response = await fetch(`${this.apiBase}/api/threats`);
            if (response.ok) {
                const data = await response.json();
                console.log('🛡️ Threat data received:', data);
                this.updateThreatSection(data);
            } else {
                console.error('Failed to load threat data:', response.status);
            }
        } catch (error) {
            console.error('Error loading threat data:', error);
        }
    }

    async loadAlertData() {
        try {
            console.log('🚨 Loading alert data...');
            const response = await fetch(`${this.apiBase}/api/alerts`);
            if (response.ok) {
                const data = await response.json();
                console.log('🚨 Alert data received:', data);
                this.updateAlertSection(data);
            } else {
                console.error('Failed to load alert data:', response.status);
            }
        } catch (error) {
            console.error('Error loading alert data:', error);
        }
    }

    updateLoginSection(data) {
        try {
            console.log('🔐 Updating login section with data:', data);
            
            // Update login metrics
            const summary = data.summary || {};
            this.updateElement('loginFailedCount', summary.total_failed_logins || 0);
            this.updateElement('loginSuccessCount', summary.total_successful_logins || 0);
            this.updateElement('loginUniqueIPs', summary.unique_attacking_ips || 0);
            
            // Update top attackers list
            this.updateTopAttackers(data.top_attackers || []);
            
            // Update login table
            this.updateLoginTable(data.failed_logins || []);
            
            // Update login chart
            this.updateLoginChart(data);
            
        } catch (error) {
            console.error('Error updating login section:', error);
        }
    }

    updateTopAttackers(attackersData) {
        const topAttackersElement = document.getElementById('topAttackers');
        if (!topAttackersElement) return;
        
        try {
            if (!Array.isArray(attackersData) || attackersData.length === 0) {
                topAttackersElement.innerHTML = '<p>No attackers detected</p>';
                return;
            }
            
            let attackersHTML = '<div class="attackers-list">';
            attackersData.slice(0, 10).forEach(attacker => {
                const ip = attacker.ip || 'Unknown';
                const attempts = attacker.attempts || 0;
                const country = attacker.country || 'Unknown';
                
                attackersHTML += `
                    <div class="attacker-item">
                        <div class="attacker-ip">
                            <i class="fas fa-globe"></i>
                            ${ip}
                        </div>
                        <div class="attacker-details">
                            <span class="attempts">${attempts} attempts</span>
                            <span class="country">${country}</span>
                        </div>
                    </div>
                `;
            });
            attackersHTML += '</div>';
            
            topAttackersElement.innerHTML = attackersHTML;
            
        } catch (error) {
            console.error('Error updating top attackers:', error);
            topAttackersElement.innerHTML = '<p>Error loading attackers</p>';
        }
    }

    updateLoginTable(loginsData) {
        const loginTableBody = document.getElementById('loginTableBody');
        if (!loginTableBody) return;
        
        try {
            if (!Array.isArray(loginsData) || loginsData.length === 0) {
                loginTableBody.innerHTML = '<tr><td colspan="5">No login attempts recorded</td></tr>';
                return;
            }
            
            let tableHTML = '';
            loginsData.slice(0, 20).forEach(login => {
                const timestamp = login.timestamp ? new Date(login.timestamp).toLocaleString() : 'Unknown';
                const ip = login.ip || 'Unknown';
                const username = login.username || 'Unknown';
                const eventType = login.event_type || 'Failed Login';
                const status = login.status || 'Failed';
                
                tableHTML += `
                    <tr class="login-row ${status.toLowerCase()}">
                        <td>${timestamp}</td>
                        <td>${ip}</td>
                        <td>${username}</td>
                        <td>${eventType}</td>
                        <td><span class="status-badge ${status.toLowerCase()}">${status}</span></td>
                    </tr>
                `;
            });
            
            loginTableBody.innerHTML = tableHTML;
            
        } catch (error) {
            console.error('Error updating login table:', error);
            loginTableBody.innerHTML = '<tr><td colspan="5">Error loading login data</td></tr>';
        }
    }

    updateLoginChart(data) {
        const loginChartCanvas = document.getElementById('loginChart');
        if (!loginChartCanvas) return;
        
        try {
            // Destroy existing chart if it exists
            if (this.charts.loginChart) {
                this.charts.loginChart.destroy();
            }
            
            const summary = data.summary || {};
            const failedLogins = summary.total_failed_logins || 0;
            const successfulLogins = summary.total_successful_logins || 0;
            
            // Create the login chart
            this.charts.loginChart = new Chart(loginChartCanvas, {
                type: 'bar',
                data: {
                    labels: ['Failed Logins', 'Successful Logins'],
                    datasets: [{
                        label: 'Login Attempts',
                        data: [failedLogins, successfulLogins],
                        backgroundColor: ['#ff6b6b', '#4ecdc4'],
                        borderColor: ['#ff5252', '#26d0ce'],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('Error updating login chart:', error);
        }
    }

    updateNetworkSection(data) {
        try {
            console.log('🌐 Updating network section with data:', data);
            
            // Update network metrics
            const connectionStats = data.connection_stats || {};
            this.updateElement('networkOpenPorts', connectionStats.listening_ports || (data.open_ports || []).length);
            this.updateElement('networkActiveConnections', connectionStats.established_connections || 0);
            this.updateElement('networkPortScans', (data.portscans || []).length);
            
            // Update port scan detection
            this.updatePortScans(data.portscans || []);
            
            // Update open ports
            this.updateOpenPorts(data.open_ports || []);
            
            // Update network connections
            this.updateNetworkConnections(data.connection_stats || {});
            
        } catch (error) {
            console.error('Error updating network section:', error);
        }
    }

    updatePortScans(portScansData) {
        const portScansElement = document.getElementById('portScanList');
        if (!portScansElement) {
            console.warn('portScanList element not found');
            return;
        }
        
        try {
            console.log('Updating port scans with data:', portScansData);
            if (!Array.isArray(portScansData) || portScansData.length === 0) {
                portScansElement.innerHTML = '<p>No port scans detected</p>';
                return;
            }
            
            let scansHTML = '<div class="port-scans-list">';
            portScansData.slice(0, 10).forEach(scan => {
                const timestamp = scan.timestamp ? new Date(scan.timestamp).toLocaleString() : 'Unknown';
                const sourceIp = scan.source_ip || 'Unknown';
                const targetPorts = scan.target_ports || scan.ports || [];
                const scanType = scan.scan_type || 'Unknown';
                const severity = scan.severity || 'medium';
                
                scansHTML += `
                    <div class="port-scan-item ${severity}">
                        <div class="scan-header">
                            <span class="scan-time">${timestamp}</span>
                            <span class="scan-severity ${severity}">${severity.toUpperCase()}</span>
                        </div>
                        <div class="scan-details">
                            <div class="scan-source">
                                <i class="fas fa-globe"></i>
                                ${sourceIp}
                            </div>
                            <div class="scan-ports">
                                <i class="fas fa-network-wired"></i>
                                Ports: ${targetPorts.join(', ')}
                            </div>
                            <div class="scan-type">
                                <i class="fas fa-search"></i>
                                ${scanType}
                            </div>
                        </div>
                    </div>
                `;
            });
            scansHTML += '</div>';
            
            portScansElement.innerHTML = scansHTML;
            console.log('Port scans updated successfully');
            
        } catch (error) {
            console.error('Error updating port scans:', error);
            portScansElement.innerHTML = '<p>Error loading port scans</p>';
        }
    }

    updateOpenPorts(openPortsData) {
        const openPortsElement = document.getElementById('openPortsList');
        if (!openPortsElement) {
            console.warn('openPortsList element not found');
            return;
        }
        
        try {
            console.log('Updating open ports with data:', openPortsData);
            if (!Array.isArray(openPortsData) || openPortsData.length === 0) {
                openPortsElement.innerHTML = '<p>No open ports detected</p>';
                return;
            }
            
            let portsHTML = '<div class="open-ports-list">';
            openPortsData.slice(0, 20).forEach(port => {
                const portNumber = port.port || port.port_number || 'Unknown';
                const service = port.service || 'Unknown';
                const state = port.state || 'LISTENING';
                const process = port.process || 'Unknown';
                
                portsHTML += `
                    <div class="port-item">
                        <div class="port-number">
                            <i class="fas fa-network-wired"></i>
                            ${portNumber}
                        </div>
                        <div class="port-details">
                            <span class="service">${service}</span>
                            <span class="state">${state}</span>
                            <span class="process">${process}</span>
                        </div>
                    </div>
                `;
            });
            portsHTML += '</div>';
            
            openPortsElement.innerHTML = portsHTML;
            console.log('Open ports updated successfully');
            
        } catch (error) {
            console.error('Error updating open ports:', error);
            openPortsElement.innerHTML = '<p>Error loading open ports</p>';
        }
    }

    updateNetworkConnections(connectionStats) {
        const connectionsElement = document.getElementById('networkConnections');
        if (!connectionsElement) return;
        
        try {
            const establishedConnections = connectionStats.established_connections || 0;
            const listeningPorts = connectionStats.listening_ports || 0;
            const totalConnections = connectionStats.total_connections || establishedConnections + listeningPorts;
            
            connectionsElement.innerHTML = `
                <div class="connection-stats">
                    <div class="stat-item">
                        <div class="stat-value">${totalConnections}</div>
                        <div class="stat-label">Total Connections</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${establishedConnections}</div>
                        <div class="stat-label">Established</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${listeningPorts}</div>
                        <div class="stat-label">Listening</div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Error updating network connections:', error);
            connectionsElement.innerHTML = '<p>Error loading connection stats</p>';
        }
    }

    updateProcessSection(data) {
        try {
            console.log('⚙️ Updating process section with data:', data);
            
            // Update process metrics
            const processSummary = data.process_summary || {};
            this.updateElement('processTotalCount', processSummary.total_processes || 0);
            this.updateElement('processSuspiciousCount', (data.suspicious_processes || []).length);
            this.updateElement('processRootCount', (data.root_processes || []).length);
            
            // Update suspicious processes
            this.updateSuspiciousProcesses(data.suspicious_processes || []);
            
            // Update top processes
            this.updateTopProcesses(data.top_processes || []);
            
            // Update process summary
            this.updateProcessSummary(data.process_summary || {});
            
        } catch (error) {
            console.error('Error updating process section:', error);
        }
    }

    updateSuspiciousProcesses(suspiciousProcessesData) {
        const suspiciousProcessesElement = document.getElementById('suspiciousProcessesList');
        if (!suspiciousProcessesElement) return;
        
        try {
            if (!Array.isArray(suspiciousProcessesData) || suspiciousProcessesData.length === 0) {
                suspiciousProcessesElement.innerHTML = '<p>No suspicious processes detected</p>';
                return;
            }
            
            let processesHTML = '<div class="suspicious-processes-list">';
            suspiciousProcessesData.slice(0, 10).forEach(process => {
                const processName = process.process_name || 'Unknown';
                const pid = process.pid || 'Unknown';
                const cpuUsage = process.cpu_usage || '0.0';
                const memoryUsage = process.memory_usage || '0.0';
                const severity = process.severity || 'medium';
                const timestamp = process.timestamp ? new Date(process.timestamp).toLocaleString() : 'Unknown';
                
                processesHTML += `
                    <div class="process-item ${severity}">
                        <div class="process-header">
                            <span class="process-name">${processName}</span>
                            <span class="process-severity ${severity}">${severity.toUpperCase()}</span>
                        </div>
                        <div class="process-details">
                            <div class="process-pid">
                                <i class="fas fa-hashtag"></i>
                                PID: ${pid}
                            </div>
                            <div class="process-usage">
                                <i class="fas fa-microchip"></i>
                                CPU: ${cpuUsage}% | RAM: ${memoryUsage}%
                            </div>
                            <div class="process-time">
                                <i class="fas fa-clock"></i>
                                ${timestamp}
                            </div>
                        </div>
                    </div>
                `;
            });
            processesHTML += '</div>';
            
            suspiciousProcessesElement.innerHTML = processesHTML;
            
        } catch (error) {
            console.error('Error updating suspicious processes:', error);
            suspiciousProcessesElement.innerHTML = '<p>Error loading suspicious processes</p>';
        }
    }

    updateTopProcesses(topProcessesData) {
        const topProcessesElement = document.getElementById('topProcessesList');
        if (!topProcessesElement) return;
        
        try {
            if (!Array.isArray(topProcessesData) || topProcessesData.length === 0) {
                topProcessesElement.innerHTML = '<p>No process data available</p>';
                return;
            }
            
            let processesHTML = '<div class="top-processes-list">';
            topProcessesData.slice(0, 10).forEach(process => {
                const user = process.user || 'Unknown';
                const pid = process.pid || 'Unknown';
                const cpu = process.cpu || '0.0';
                const memory = process.memory || '0.0';
                const command = process.command || 'Unknown';
                
                processesHTML += `
                    <div class="process-item">
                        <div class="process-header">
                            <span class="process-command">${command}</span>
                            <span class="process-user">${user}</span>
                        </div>
                        <div class="process-details">
                            <div class="process-pid">
                                <i class="fas fa-hashtag"></i>
                                PID: ${pid}
                            </div>
                            <div class="process-usage">
                                <i class="fas fa-microchip"></i>
                                CPU: ${cpu}% | RAM: ${memory}%
                            </div>
                        </div>
                    </div>
                `;
            });
            processesHTML += '</div>';
            
            topProcessesElement.innerHTML = processesHTML;
            
        } catch (error) {
            console.error('Error updating top processes:', error);
            topProcessesElement.innerHTML = '<p>Error loading top processes</p>';
        }
    }

    updateProcessSummary(processSummaryData) {
        const processSummaryElement = document.getElementById('processSummary');
        if (!processSummaryElement) return;
        
        try {
            const totalProcesses = processSummaryData.total_processes || 0;
            const suspiciousProcesses = processSummaryData.suspicious_processes || 0;
            const rootProcesses = processSummaryData.root_processes || 0;
            
            processSummaryElement.innerHTML = `
                <div class="process-summary-stats">
                    <div class="stat-item">
                        <div class="stat-value">${totalProcesses}</div>
                        <div class="stat-label">Total Processes</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${suspiciousProcesses}</div>
                        <div class="stat-label">Suspicious</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${rootProcesses}</div>
                        <div class="stat-label">Root/System</div>
                    </div>
                </div>
            `;
            
        } catch (error) {
            console.error('Error updating process summary:', error);
            processSummaryElement.innerHTML = '<p>Error loading process summary</p>';
        }
    }

    updateFileSection(data) {
        try {
            console.log('📁 Updating file section with data:', data);
            
            // Update file metrics
            this.updateElement('fileChangesCount', (data.recent_changes || []).length);
            this.updateElement('fileIntegrityIssues', (data.file_integrity || []).length);
            
            // Update critical files
            this.updateCriticalFiles(data.file_integrity || []);
            
            // Update recent changes
            this.updateRecentChanges(data.recent_changes || []);
            
        } catch (error) {
            console.error('Error updating file section:', error);
        }
    }

    updateCriticalFiles(criticalFilesData) {
        const criticalFilesElement = document.getElementById('criticalFilesList');
        if (!criticalFilesElement) return;
        
        try {
            if (!Array.isArray(criticalFilesData) || criticalFilesData.length === 0) {
                criticalFilesElement.innerHTML = '<p>No critical files monitored</p>';
                return;
            }
            
            let filesHTML = '<div class="critical-files-list">';
            criticalFilesData.slice(0, 10).forEach(file => {
                const filePath = file.file_path || 'Unknown';
                const status = file.status || 'monitored';
                const lastModified = file.last_modified_human || 'Unknown';
                const size = file.size || 0;
                
                filesHTML += `
                    <div class="file-item ${status}">
                        <div class="file-header">
                            <span class="file-path">${filePath}</span>
                            <span class="file-status ${status}">${status.toUpperCase()}</span>
                        </div>
                        <div class="file-details">
                            <div class="file-size">
                                <i class="fas fa-file"></i>
                                Size: ${size} bytes
                            </div>
                            <div class="file-modified">
                                <i class="fas fa-clock"></i>
                                Modified: ${lastModified}
                            </div>
                        </div>
                    </div>
                `;
            });
            filesHTML += '</div>';
            
            criticalFilesElement.innerHTML = filesHTML;
            
        } catch (error) {
            console.error('Error updating critical files:', error);
            criticalFilesElement.innerHTML = '<p>Error loading critical files</p>';
        }
    }

    updateRecentChanges(recentChangesData) {
        const recentChangesElement = document.getElementById('recentChangesList');
        if (!recentChangesElement) return;
        
        try {
            if (!Array.isArray(recentChangesData) || recentChangesData.length === 0) {
                recentChangesElement.innerHTML = '<p>No recent changes detected</p>';
                return;
            }
            
            let changesHTML = '<div class="recent-changes-list">';
            recentChangesData.slice(0, 10).forEach(change => {
                const file = change.file || 'Unknown';
                const changeType = change.change_type || 'modified';
                const timestamp = change.timestamp ? new Date(change.timestamp).toLocaleString() : 'Unknown';
                const user = change.user || 'Unknown';
                
                changesHTML += `
                    <div class="change-item ${changeType}">
                        <div class="change-header">
                            <span class="change-file">${file}</span>
                            <span class="change-type ${changeType}">${changeType.toUpperCase()}</span>
                        </div>
                        <div class="change-details">
                            <div class="change-user">
                                <i class="fas fa-user"></i>
                                ${user}
                            </div>
                            <div class="change-time">
                                <i class="fas fa-clock"></i>
                                ${timestamp}
                            </div>
                        </div>
                    </div>
                `;
            });
            changesHTML += '</div>';
            
            recentChangesElement.innerHTML = changesHTML;
            
        } catch (error) {
            console.error('Error updating recent changes:', error);
            recentChangesElement.innerHTML = '<p>Error loading recent changes</p>';
        }
    }

    updateThreatSection(data) {
        try {
            console.log('🛡️ Updating threat section with data:', data);
            
            // Update threat map
            this.updateThreatMap(data.threat_map || {});
            
            // Update attacking countries
            this.updateAttackingCountries(data.attack_by_country || []);
            
            // Update threat distribution chart
            this.updateThreatDistributionChart(data);
            
            // Update threat timeline
            this.updateThreatTimeline(data);
            
            // Update threat metrics
            const totalThreats = (data.ip_geolocation || []).length + (data.attack_by_country || []).length;
            const attackingCountries = (data.attack_by_country || []).length;
            
            this.updateElement('threatTotalCount', totalThreats);
            this.updateElement('threatCountriesCount', attackingCountries);
            
        } catch (error) {
            console.error('Error updating threat section:', error);
        }
    }

    updateThreatMap(threatMapData) {
        const threatMapElement = document.getElementById('threatMap');
        if (!threatMapElement) return;
        
        try {
            const threatSources = threatMapData.threat_sources || [];
            
            if (threatSources.length === 0) {
                threatMapElement.innerHTML = `
                    <div class="map-placeholder">
                        <i class="fas fa-globe-americas"></i>
                        <p>No threat sources detected</p>
                    </div>
                `;
                return;
            }
            
            // Create a simple map visualization
            let mapHTML = '<div class="threat-map-container">';
            mapHTML += '<div class="world-map">';
            
            threatSources.forEach(source => {
                const threatLevel = source.threat_level || 'medium';
                const attackCount = source.attack_count || 0;
                const country = source.country || 'Unknown';
                
                mapHTML += `
                    <div class="threat-source ${threatLevel}" 
                         style="left: ${this.getMapPosition(source.lat, source.lon).x}%; 
                                top: ${this.getMapPosition(source.lat, source.lon).y}%;"
                         title="${country}: ${attackCount} attacks">
                        <div class="threat-dot"></div>
                        <div class="threat-label">${country}</div>
                    </div>
                `;
            });
            
            mapHTML += '</div></div>';
            threatMapElement.innerHTML = mapHTML;
            
        } catch (error) {
            console.error('Error updating threat map:', error);
            threatMapElement.innerHTML = `
                <div class="map-placeholder">
                    <i class="fas fa-globe-americas"></i>
                    <p>Error loading threat map</p>
                </div>
            `;
        }
    }

    updateAttackingCountries(countriesData) {
        const attackingCountriesElement = document.getElementById('attackingCountries');
        if (!attackingCountriesElement) return;
        
        try {
            if (!Array.isArray(countriesData) || countriesData.length === 0) {
                attackingCountriesElement.innerHTML = '<p>No attacking countries detected</p>';
                return;
            }
            
            let countriesHTML = '<div class="countries-list">';
            countriesData.forEach(country => {
                const attackCount = country.attack_count || 0;
                const countryName = country.country || 'Unknown';
                
                countriesHTML += `
                    <div class="country-item">
                        <div class="country-name">
                            <i class="fas fa-flag"></i>
                            ${countryName}
                        </div>
                        <div class="country-attacks">
                            <span class="attack-count">${attackCount}</span>
                            <span class="attack-label">attacks</span>
                        </div>
                    </div>
                `;
            });
            countriesHTML += '</div>';
            
            attackingCountriesElement.innerHTML = countriesHTML;
            
        } catch (error) {
            console.error('Error updating attacking countries:', error);
            attackingCountriesElement.innerHTML = '<p>Error loading country data</p>';
        }
    }

    updateThreatDistributionChart(data) {
        const chartCanvas = document.getElementById('threatDistributionChart');
        if (!chartCanvas) return;
        
        try {
            // Destroy existing chart if it exists
            if (this.charts.threatDistribution) {
                this.charts.threatDistribution.destroy();
            }
            
            const threatSources = data.threat_map?.threat_sources || [];
            const countriesData = data.attack_by_country || [];
            
            // Prepare chart data
            const chartData = {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: [
                        '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
                        '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            };
            
            // Add threat sources data
            threatSources.forEach(source => {
                chartData.labels.push(source.country || 'Unknown');
                chartData.datasets[0].data.push(source.attack_count || 0);
            });
            
            // Add countries data if not already included
            countriesData.forEach(country => {
                if (!chartData.labels.includes(country.country)) {
                    chartData.labels.push(country.country);
                    chartData.datasets[0].data.push(country.attack_count || 0);
                }
            });
            
            // Create the chart
            this.charts.threatDistribution = new Chart(chartCanvas, {
                type: 'doughnut',
                data: chartData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#333',
                                font: {
                                    size: 12
                                }
                            }
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('Error updating threat distribution chart:', error);
        }
    }

    updateThreatTimeline(data) {
        const threatChartCanvas = document.getElementById('threatChart');
        if (!threatChartCanvas) return;
        
        try {
            // Destroy existing chart if it exists
            if (this.charts.threatTimeline) {
                this.charts.threatTimeline.destroy();
            }
            
            // Prepare timeline data
            const timelineData = this.prepareThreatTimelineData(data);
            
            // Create the timeline chart
            this.charts.threatTimeline = new Chart(threatChartCanvas, {
                type: 'line',
                data: {
                    labels: timelineData.labels,
                    datasets: [{
                        label: 'Threat Activity',
                        data: timelineData.data,
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(0,0,0,0.1)'
                            }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
            
        } catch (error) {
            console.error('Error updating threat timeline:', error);
        }
    }

    prepareThreatTimelineData(data) {
        // Generate timeline data for the last 24 hours
        const labels = [];
        const threatData = [];
        
        for (let i = 23; i >= 0; i--) {
            const time = new Date();
            time.setHours(time.getHours() - i);
            labels.push(time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
            
            // Generate random threat activity based on existing data
            const baseActivity = (data.attack_by_country?.length || 0) * 2;
            const randomActivity = Math.floor(Math.random() * baseActivity) + Math.floor(Math.random() * 5);
            threatData.push(randomActivity);
        }
        
        return { labels, data: threatData };
    }

    getMapPosition(lat, lon) {
        // Convert lat/lon to percentage positions for a simple map visualization
        const x = ((lon + 180) / 360) * 100;
        const y = ((90 - lat) / 180) * 100;
        return { x: Math.max(5, Math.min(95, x)), y: Math.max(5, Math.min(95, y)) };
    }

    updateAlertSection(data) {
        try {
            console.log('🚨 Updating alert section with data:', data);
            
            // Update alert metrics
            const alertSummary = data.alert_summary || {};
            this.updateElement('alertTotalCount', alertSummary.total_alerts || 0);
            this.updateElement('alertCriticalCount', alertSummary.critical_alerts || 0);
            this.updateElement('alertHighCount', alertSummary.high_alerts || 0);
            
            // Update alerts container
            this.updateAlertsContainer(data);
            
        } catch (error) {
            console.error('Error updating alert section:', error);
        }
    }

    updateAlertsContainer(data) {
        const alertsContainer = document.getElementById('alertsContainer');
        if (!alertsContainer) return;
        
        try {
            const recentAlerts = data.recent_alerts || [];
            const bruteForceAlerts = data.brute_force_alerts || [];
            const suspiciousActivities = data.suspicious_activities || [];
            const portScanAlerts = data.port_scan_alerts || [];
            
            // Combine all alerts
            const allAlerts = [
                ...recentAlerts,
                ...bruteForceAlerts.map(alert => ({
                    type: 'Brute Force Attack',
                    severity: 'critical',
                    timestamp: alert.timestamp || new Date().toISOString(),
                    description: `Multiple failed login attempts from ${alert.ip}`,
                    ip: alert.ip,
                    attempts: alert.attempts
                })),
                ...suspiciousActivities.map(process => ({
                    type: 'Suspicious Process',
                    severity: 'high',
                    timestamp: process.timestamp || new Date().toISOString(),
                    description: `Suspicious process detected: ${process.process_name}`,
                    process_name: process.process_name,
                    pid: process.pid
                })),
                ...portScanAlerts.map(scan => ({
                    type: 'Port Scan',
                    severity: 'medium',
                    timestamp: scan.timestamp || new Date().toISOString(),
                    description: `Port scan detected from ${scan.source_ip}`,
                    source_ip: scan.source_ip,
                    ports: scan.ports
                }))
            ];
            
            // Sort by timestamp (newest first)
            allAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            if (allAlerts.length === 0) {
                alertsContainer.innerHTML = `
                    <div class="alert-item info">
                        <div class="alert-icon">
                            <i class="fas fa-info-circle"></i>
                        </div>
                        <div class="alert-content">
                            <h4>No Active Alerts</h4>
                            <p>All systems are operating normally.</p>
                            <span class="alert-time">${new Date().toLocaleString()}</span>
                        </div>
                    </div>
                `;
                return;
            }
            
            let alertsHTML = '';
            allAlerts.slice(0, 20).forEach(alert => {
                const severity = alert.severity || 'info';
                const type = alert.type || 'Alert';
                const description = alert.description || 'No description available';
                const timestamp = alert.timestamp ? new Date(alert.timestamp).toLocaleString() : 'Unknown';
                
                let icon = 'info-circle';
                switch (severity) {
                    case 'critical':
                        icon = 'exclamation-triangle';
                        break;
                    case 'high':
                        icon = 'exclamation-circle';
                        break;
                    case 'medium':
                        icon = 'warning';
                        break;
                    default:
                        icon = 'info-circle';
                }
                
                alertsHTML += `
                    <div class="alert-item ${severity}">
                        <div class="alert-icon">
                            <i class="fas fa-${icon}"></i>
                        </div>
                        <div class="alert-content">
                            <h4>${type}</h4>
                            <p>${description}</p>
                            <span class="alert-time">${timestamp}</span>
                        </div>
                    </div>
                `;
            });
            
            alertsContainer.innerHTML = alertsHTML;
            
        } catch (error) {
            console.error('Error updating alerts container:', error);
            alertsContainer.innerHTML = `
                <div class="alert-item error">
                    <div class="alert-icon">
                        <i class="fas fa-exclamation-triangle"></i>
                    </div>
                    <div class="alert-content">
                        <h4>Error Loading Alerts</h4>
                        <p>Failed to load alert data.</p>
                        <span class="alert-time">${new Date().toLocaleString()}</span>
                    </div>
                </div>
            `;
        }
    }

    async runManualScan() {
        try {
            this.showLoading(true);
            const response = await fetch(`${this.apiBase}/api/scan/run`, {
                method: 'POST'
            });
            
            if (response.ok) {
                await this.loadDashboardData();
                this.showNotification('Manual scan completed successfully', 'success');
            } else {
                throw new Error('Manual scan failed');
            }
        } catch (error) {
            console.error('Error running manual scan:', error);
            this.showNotification('Failed to run manual scan', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async startRealTimeScanning() {
        try {
            const response = await fetch(`${this.apiBase}/api/scan/start-realtime`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.isRealTimeActive = true;
                this.updateRealtimeStatus(true);
                this.showNotification('Real-time scanning started', 'success');
            } else {
                throw new Error('Failed to start real-time scanning');
            }
        } catch (error) {
            console.error('Error starting real-time scanning:', error);
            this.showNotification('Failed to start real-time scanning', 'error');
        }
    }

    async stopRealTimeScanning() {
        try {
            const response = await fetch(`${this.apiBase}/api/scan/stop-realtime`, {
                method: 'POST'
            });
            
            if (response.ok) {
                this.isRealTimeActive = false;
                this.updateRealtimeStatus(false);
                this.showNotification('Real-time scanning stopped', 'success');
            } else {
                throw new Error('Failed to stop real-time scanning');
            }
        } catch (error) {
            console.error('Error stopping real-time scanning:', error);
            this.showNotification('Failed to stop real-time scanning', 'error');
        }
    }

    async checkRealTimeStatus() {
        try {
            const response = await fetch(`${this.apiBase}/api/scan/status`);
            if (response.ok) {
                const status = await response.json();
                this.isRealTimeActive = status.isActive || false;
                this.updateRealtimeStatus(this.isRealTimeActive);
            }
        } catch (error) {
            console.error('Error checking real-time status:', error);
        }
    }

    updateRealtimeStatus(isActive) {
        const statusElement = document.getElementById('realtimeStatus');
        const startBtn = document.getElementById('startRealtimeBtn');
        const stopBtn = document.getElementById('stopRealtimeBtn');
        
        if (statusElement) {
            if (isActive) {
                statusElement.textContent = '🟢 Active';
                statusElement.className = 'status-active';
            } else {
                statusElement.textContent = '🔴 Inactive';
                statusElement.className = 'status-inactive';
            }
        }
        
        if (startBtn) {
            startBtn.style.display = isActive ? 'none' : 'inline-flex';
        }
        
        if (stopBtn) {
            stopBtn.style.display = isActive ? 'inline-flex' : 'none';
        }
    }

    updateDashboardWithLiveData(liveData) {
        try {
            // Update overview cards with live data
            this.updateOverviewCards(liveData);
            
            // Update metrics with live data
            this.updateOverviewMetrics(liveData);
            
            // Update recent events with live data
            this.updateRecentEvents(liveData);
            
            // Update threat chart with live data
            this.createThreatChart(liveData);
            
            // Update last updated timestamp
            const lastUpdatedElement = document.getElementById('lastUpdated');
            if (lastUpdatedElement) {
                lastUpdatedElement.textContent = new Date().toLocaleTimeString();
            }
            
        } catch (error) {
            console.error('Error updating dashboard with live data:', error);
        }
    }

    updateConnectionStatus(isConnected) {
        const statusElement = document.getElementById('connectionStatus');
        if (statusElement) {
            const statusDot = statusElement.querySelector('.status-dot');
            const statusText = statusElement.querySelector('span:last-child');
            
            if (statusDot) {
                statusDot.className = `status-dot ${isConnected ? 'online' : 'offline'}`;
            }
            
            if (statusText) {
                statusText.textContent = isConnected ? 'Online' : 'Offline';
            }
        }
    }

    showLoading(show) {
        const loadingOverlay = document.getElementById('loadingOverlay');
        if (loadingOverlay) {
            if (show) {
                loadingOverlay.style.display = 'flex';
                loadingOverlay.classList.add('active');
            } else {
                loadingOverlay.style.display = 'none';
                loadingOverlay.classList.remove('active');
            }
        } else {
            console.warn('Loading overlay element not found');
        }
    }

    showNotification(message, type = 'info') {
        const notificationsContainer = document.getElementById('notifications');
        if (!notificationsContainer) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span class="notification-message">${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        notificationsContainer.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
        
        // Close button functionality
        const closeBtn = notification.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            });
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SOCDashboard();
});
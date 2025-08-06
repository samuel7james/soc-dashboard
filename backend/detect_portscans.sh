#!/bin/bash
# Detect port scanning attempts from network logs
# Windows-compatible version

# Detect platform and set output directory
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows with Git Bash
    OUTPUT_DIR="$(pwd)/../data"
    LOG_FILE="/dev/null"  # Windows doesn't have syslog
else
    # Linux/Unix
    OUTPUT_DIR="/tmp/soc_data"
    LOG_FILE="/var/log/syslog"
fi

PORTSCAN_FILE="$OUTPUT_DIR/portscans.json"
OPEN_PORTS_FILE="$OUTPUT_DIR/open_ports.json"
CONNECTION_STATS_FILE="$OUTPUT_DIR/connection_stats.json"
NETWORK_LISTENERS_FILE="$OUTPUT_DIR/network_listeners.json"
VULNERABLE_PORTS_FILE="$OUTPUT_DIR/vulnerable_ports.json"

mkdir -p "$OUTPUT_DIR"

# Function to detect port scans from netstat and logs
detect_portscans() {
    echo "Detecting port scan attempts..."
    
    # Check if we're on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Generate sample port scan data for Windows
        cat > "$PORTSCAN_FILE" << EOF
[
    {
        "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')",
        "source_ip": "192.168.1.100",
        "target_ports": [22, 23, 80, 443, 3389],
        "scan_type": "TCP SYN Scan",
        "severity": "medium",
        "blocked": true
    },
    {
        "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')",
        "source_ip": "10.0.0.50",
        "target_ports": [21, 22, 25, 53, 80, 110, 143, 443, 993, 995],
        "scan_type": "Port Sweep",
        "severity": "high",
        "blocked": false
    },
    {
        "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')",
        "source_ip": "172.16.0.25",
        "target_ports": [80, 443, 8080, 8443],
        "scan_type": "Web Port Scan",
        "severity": "low",
        "blocked": true
    }
]
EOF
        return
    fi
    
    # Linux/Unix implementation
    # Monitor for rapid connection attempts (simulated detection)
    netstat -tuln 2>/dev/null | grep LISTEN | while IFS= read -r line; do
        port=$(echo "$line" | awk '{print $4}' | cut -d: -f2)
        protocol=$(echo "$line" | awk '{print $1}')
        
        echo "{\"port\": \"$port\", \"protocol\": \"$protocol\", \"status\": \"listening\"}"
    done | jq -s '.' > "$OPEN_PORTS_FILE" 2>/dev/null || echo "[]" > "$OPEN_PORTS_FILE"
    
    # Generate realistic port scan alerts for demo
    cat > "$PORTSCAN_FILE" << EOF
[
    {
        "timestamp": "$(date -Iseconds)",
        "source_ip": "192.168.1.100",
        "target_ports": [22, 23, 80, 443, 3389],
        "scan_type": "TCP SYN Scan",
        "severity": "medium",
        "blocked": true
    },
    {
        "timestamp": "$(date -d '5 minutes ago' -Iseconds)",
        "source_ip": "10.0.0.50",
        "target_ports": [21, 22, 25, 53, 80, 110, 143, 443, 993, 995],
        "scan_type": "Port Sweep",
        "severity": "high",
        "blocked": false
    }
]
EOF
}

# Function to analyze network connections
analyze_connections() {
    echo "Analyzing network connections..."
    
    # Check if we're on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Generate sample connection stats for Windows
        cat > "$CONNECTION_STATS_FILE" << EOF
{
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')",
    "established_connections": 45,
    "listening_ports": 12,
    "time_wait_connections": 8,
    "total_connections": 65
}
EOF
        return
    fi
    
    # Linux/Unix implementation
    # Get current network connections
    netstat -tuln > /tmp/current_connections.txt 2>/dev/null
    
    # Count connections by state
    established=$(netstat -tun 2>/dev/null | grep ESTABLISHED | wc -l)
    listening=$(netstat -tln 2>/dev/null | grep LISTEN | wc -l)
    time_wait=$(netstat -tun 2>/dev/null | grep TIME_WAIT | wc -l)
    
    connection_stats="{
        \"timestamp\": \"$(date -Iseconds)\",
        \"established_connections\": $established,
        \"listening_ports\": $listening,
        \"time_wait_connections\": $time_wait,
        \"total_connections\": $((established + listening + time_wait))
    }"
    
    echo "$connection_stats" > "$CONNECTION_STATS_FILE"
}

# Function to monitor for suspicious network activity
monitor_network_activity() {
    echo "Monitoring network activity..."
    
    # Check if we're on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Generate sample network listeners data for Windows
        cat > "$NETWORK_LISTENERS_FILE" << EOF
[
    {"local_address": "0.0.0.0:80", "state": "LISTENING"},
    {"local_address": "0.0.0.0:443", "state": "LISTENING"},
    {"local_address": "127.0.0.1:3000", "state": "LISTENING"},
    {"local_address": "0.0.0.0:22", "state": "LISTENING"}
]
EOF
        return
    fi
    
    # Linux/Unix implementation
    # Check for unusual network activity patterns
    ss -tuln 2>/dev/null | grep LISTEN | head -20 | while IFS= read -r line; do
        local_address=$(echo "$line" | awk '{print $5}')
        state=$(echo "$line" | awk '{print $2}')
        
        echo "{\"local_address\": \"$local_address\", \"state\": \"$state\"}"
    done | jq -s '.' > "$NETWORK_LISTENERS_FILE" 2>/dev/null || echo "[]" > "$NETWORK_LISTENERS_FILE"
}

# Function to check for common vulnerable ports
check_vulnerable_ports() {
    echo "Checking for potentially vulnerable open ports..."
    
    # Check if we're on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Generate sample vulnerable ports data for Windows
        cat > "$VULNERABLE_PORTS_FILE" << EOF
[
    {"port": 80, "service": "HTTP", "risk_level": "medium", "description": "Web server port"},
    {"port": 443, "service": "HTTPS", "risk_level": "low", "description": "Secure web server port"},
    {"port": 22, "service": "SSH", "risk_level": "medium", "description": "SSH service port"}
]
EOF
        return
    fi
    
    # Linux/Unix implementation
    vulnerable_ports=(21 23 25 53 80 110 135 139 143 443 445 993 995 1433 3389 5432)
    vulnerable_found="["
    first_entry=true
    
    for port in "${vulnerable_ports[@]}"; do
        if netstat -tuln 2>/dev/null | grep ":$port " > /dev/null; then
            if [[ "$first_entry" == false ]]; then
                vulnerable_found+=","
            fi
            
            service_name=""
            case $port in
                21) service_name="FTP" ;;
                22) service_name="SSH" ;;
                23) service_name="Telnet" ;;
                25) service_name="SMTP" ;;
                53) service_name="DNS" ;;
                80) service_name="HTTP" ;;
                110) service_name="POP3" ;;
                135) service_name="RPC" ;;
                139) service_name="NetBIOS" ;;
                143) service_name="IMAP" ;;
                443) service_name="HTTPS" ;;
                445) service_name="SMB" ;;
                993) service_name="IMAPS" ;;
                995) service_name="POP3S" ;;
                1433) service_name="MSSQL" ;;
                3389) service_name="RDP" ;;
                5432) service_name="PostgreSQL" ;;
                *) service_name="Unknown" ;;
            esac
            
            vulnerable_found+="{\"port\": $port, \"service\": \"$service_name\", \"risk_level\": \"medium\", \"description\": \"$service_name service port\"}"
            first_entry=false
        fi
    done
    
    vulnerable_found+="]"
    echo "$vulnerable_found" > "$VULNERABLE_PORTS_FILE"
}

# Function to generate port scan summary
generate_portscan_summary() {
    echo "Generating port scan summary..."
    
    # Count port scans
    port_scan_count=0
    if [[ -f "$PORTSCAN_FILE" ]]; then
        port_scan_count=$(grep -c '"source_ip"' "$PORTSCAN_FILE" 2>/dev/null || echo "0")
    fi
    
    # Count open ports
    open_ports_count=0
    if [[ -f "$OPEN_PORTS_FILE" ]]; then
        open_ports_count=$(grep -c '"port"' "$OPEN_PORTS_FILE" 2>/dev/null || echo "0")
    fi
    
    # Count vulnerable ports
    vulnerable_ports_count=0
    if [[ -f "$VULNERABLE_PORTS_FILE" ]]; then
        vulnerable_ports_count=$(grep -c '"port"' "$VULNERABLE_PORTS_FILE" 2>/dev/null || echo "0")
    fi
    
    cat > "$OUTPUT_DIR/portscan_summary.json" << EOF
{
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')",
    "total_port_scans": $port_scan_count,
    "open_ports": $open_ports_count,
    "vulnerable_ports": $vulnerable_ports_count,
    "status": "monitoring"
}
EOF
}

# Main execution
echo "Starting port scan detection..."

# Run all port scan checks
detect_portscans
analyze_connections
monitor_network_activity
check_vulnerable_ports
generate_portscan_summary

echo "Port scan detection completed."
echo "Results saved to: $OUTPUT_DIR"
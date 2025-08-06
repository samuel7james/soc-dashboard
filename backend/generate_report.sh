#!/bin/bash
# Generate comprehensive security reports
# Windows-compatible version

# Detect platform and set output directory
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows with Git Bash
    OUTPUT_DIR="$(pwd)/../data"
    SCRIPT_DIR="$(dirname "$0")"
else
    # Linux/Unix
    OUTPUT_DIR="/tmp/soc_data"
    SCRIPT_DIR="$(dirname "$0")"
fi

REPORT_FILE="$OUTPUT_DIR/security_report.json"
DAILY_REPORT="$OUTPUT_DIR/daily_security_report.json"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to run all monitoring scripts
run_all_monitors() {
    echo "Running all security monitoring scripts..."
    
    # Run each monitoring script if it exists
    if [[ -f "$SCRIPT_DIR/monitor_logins.sh" ]]; then
        echo "Running login monitoring..."
        bash "$SCRIPT_DIR/monitor_logins.sh" 2>/dev/null || echo "Login monitoring failed - using sample data"
    fi
    
    if [[ -f "$SCRIPT_DIR/detect_portscans.sh" ]]; then
        echo "Running port scan detection..."
        bash "$SCRIPT_DIR/detect_portscans.sh" 2>/dev/null || echo "Port scan detection failed - using sample data"
    fi
    
    if [[ -f "$SCRIPT_DIR/check_processes.sh" ]]; then
        echo "Running process monitoring..."
        bash "$SCRIPT_DIR/check_processes.sh" 2>/dev/null || echo "Process monitoring failed - using sample data"
    fi
    
    if [[ -f "$SCRIPT_DIR/monitor_files.sh" ]]; then
        echo "Running file monitoring..."
        bash "$SCRIPT_DIR/monitor_files.sh" 2>/dev/null || echo "File monitoring failed - using sample data"
    fi
    
    if [[ -f "$SCRIPT_DIR/geolocate_ips.sh" ]]; then
        echo "Running IP geolocation..."
        bash "$SCRIPT_DIR/geolocate_ips.sh" 2>/dev/null || echo "IP geolocation failed - using sample data"
    fi
}

# Function to calculate threat level based on all security events
calculate_threat_level() {
    echo "Calculating overall threat level..."
    
    local threat_score=0
    local threat_level="LOW"
    
    # Check failed login attempts
    if [[ -f "$OUTPUT_DIR/login_summary.json" ]]; then
        failed_logins=$(grep -o '"total_failed_logins": *[0-9]*' "$OUTPUT_DIR/login_summary.json" 2>/dev/null | cut -d':' -f2 | tr -d ' ' || echo "0")
        if [[ "$failed_logins" -gt 100 ]]; then
            threat_score=$((threat_score + 30))
        elif [[ "$failed_logins" -gt 50 ]]; then
            threat_score=$((threat_score + 20))
        elif [[ "$failed_logins" -gt 10 ]]; then
            threat_score=$((threat_score + 10))
        fi
    fi
    
    # Check for suspicious processes
    if [[ -f "$OUTPUT_DIR/suspicious_processes.json" ]]; then
        suspicious_count=$(grep -c '"process_name"' "$OUTPUT_DIR/suspicious_processes.json" 2>/dev/null || echo "0")
        if [[ "$suspicious_count" -gt 0 ]]; then
            threat_score=$((threat_score + 40))
        fi
    fi
    
    # Check port scan attempts
    if [[ -f "$OUTPUT_DIR/portscans.json" ]]; then
        scan_count=$(grep -c '"source_ip"' "$OUTPUT_DIR/portscans.json" 2>/dev/null || echo "0")
        if [[ "$scan_count" -gt 5 ]]; then
            threat_score=$((threat_score + 25))
        elif [[ "$scan_count" -gt 0 ]]; then
            threat_score=$((threat_score + 15))
        fi
    fi
    
    # Check file integrity issues
    if [[ -f "$OUTPUT_DIR/recent_changes.json" ]]; then
        recent_changes=$(grep -c '"file"' "$OUTPUT_DIR/recent_changes.json" 2>/dev/null || echo "0")
        if [[ "$recent_changes" -gt 20 ]]; then
            threat_score=$((threat_score + 20))
        elif [[ "$recent_changes" -gt 10 ]]; then
            threat_score=$((threat_score + 10))
        fi
    fi
    
    # Determine threat level based on score
    if [[ $threat_score -ge 70 ]]; then
        threat_level="CRITICAL"
    elif [[ $threat_score -ge 50 ]]; then
        threat_level="HIGH"
    elif [[ $threat_score -ge 30 ]]; then
        threat_level="MEDIUM"
    else
        threat_level="LOW"
    fi
    
    echo "{\"threat_score\": $threat_score, \"threat_level\": \"$threat_level\"}"
}

# Function to generate executive summary
generate_executive_summary() {
    echo "Generating executive summary..."
    
    local threat_info=$(calculate_threat_level)
    local threat_score=$(echo "$threat_info" | grep -o '"threat_score": *[0-9]*' | cut -d':' -f2 | tr -d ' ')
    local threat_level=$(echo "$threat_info" | grep -o '"threat_level": *"[^"]*"' | cut -d'"' -f4)
    
    # Get current timestamp
    local timestamp=$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')
    
    # Count total incidents
    local total_incidents=0
    local critical_incidents=0
    local high_priority_incidents=0
    
    # Count from various sources
    if [[ -f "$OUTPUT_DIR/login_summary.json" ]]; then
        failed_logins=$(grep -o '"total_failed_logins": *[0-9]*' "$OUTPUT_DIR/login_summary.json" 2>/dev/null | cut -d':' -f2 | tr -d ' ' || echo "0")
        total_incidents=$((total_incidents + failed_logins))
    fi
    
    if [[ -f "$OUTPUT_DIR/portscans.json" ]]; then
        scan_count=$(grep -c '"source_ip"' "$OUTPUT_DIR/portscans.json" 2>/dev/null || echo "0")
        total_incidents=$((total_incidents + scan_count))
    fi
    
    if [[ -f "$OUTPUT_DIR/suspicious_processes.json" ]]; then
        suspicious_count=$(grep -c '"process_name"' "$OUTPUT_DIR/suspicious_processes.json" 2>/dev/null || echo "0")
        total_incidents=$((total_incidents + suspicious_count))
        high_priority_incidents=$((high_priority_incidents + suspicious_count))
    fi
    
    # Determine critical incidents based on threat level
    if [[ "$threat_level" == "CRITICAL" ]]; then
        critical_incidents=$((critical_incidents + 1))
    fi
    
    cat > "$OUTPUT_DIR/executive_summary.json" << EOF
{
    "overall_threat_level": "$threat_level",
    "threat_score": $threat_score,
    "total_incidents": $total_incidents,
    "critical_incidents": $critical_incidents,
    "high_priority_incidents": $high_priority_incidents,
    "last_updated": "$timestamp",
    "recommendations": [
        "Monitor failed login attempts",
        "Review suspicious processes",
        "Check open ports",
        "Update security policies"
    ]
}
EOF
}

# Function to generate security metrics
generate_security_metrics() {
    echo "Generating security metrics..."
    
    # Get system information (cross-platform)
    local cpu_usage="0"
    local memory_usage="0"
    local disk_usage="0"
    
    # Try to get CPU usage (Windows-compatible)
    if command -v wmic >/dev/null 2>&1; then
        # Windows
        cpu_usage=$(wmic cpu get loadpercentage /value 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "0")
    elif command -v top >/dev/null 2>&1; then
        # Linux/Unix
        cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo "0")
    fi
    
    # Try to get memory usage (Windows-compatible)
    if command -v wmic >/dev/null 2>&1; then
        # Windows
        memory_usage=$(wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value 2>/dev/null | grep -E "TotalVisibleMemorySize|FreePhysicalMemory" | cut -d'=' -f2 | tr '\n' ' ' | awk '{printf "%.1f", (1-$2/$1)*100}' || echo "0")
    elif command -v free >/dev/null 2>&1; then
        # Linux/Unix
        memory_usage=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}' 2>/dev/null || echo "0")
    fi
    
    # Try to get disk usage (Windows-compatible)
    if command -v wmic >/dev/null 2>&1; then
        # Windows
        disk_usage=$(wmic logicaldisk get size,freespace /value 2>/dev/null | grep -E "Size|FreeSpace" | cut -d'=' -f2 | tr '\n' ' ' | awk '{printf "%.1f", (1-$2/$1)*100}' || echo "0")
    elif command -v df >/dev/null 2>&1; then
        # Linux/Unix
        disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//' 2>/dev/null || echo "0")
    fi
    
    # Get network statistics
    local active_connections="0"
    local listening_ports="0"
    local blocked_ips="0"
    
    if command -v netstat >/dev/null 2>&1; then
        active_connections=$(netstat -an 2>/dev/null | grep -c "ESTABLISHED" || echo "0")
        listening_ports=$(netstat -an 2>/dev/null | grep -c "LISTENING\|LISTEN" || echo "0")
    fi
    
    cat > "$OUTPUT_DIR/security_metrics.json" << EOF
{
    "system_metrics": {
        "cpu_usage_percent": $cpu_usage,
        "memory_usage_percent": $memory_usage,
        "disk_usage_percent": $disk_usage
    },
    "network_metrics": {
        "active_connections": $active_connections,
        "listening_ports": $listening_ports,
        "blocked_ips": $blocked_ips
    },
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
}
EOF
}

# Function to generate alert summary
generate_alert_summary() {
    echo "Generating alert summary..."
    
    local critical_alerts=0
    local high_alerts=0
    local medium_alerts=0
    local low_alerts=0
    
    # Count alerts from various sources
    if [[ -f "$OUTPUT_DIR/suspicious_processes.json" ]]; then
        suspicious_count=$(grep -c '"process_name"' "$OUTPUT_DIR/suspicious_processes.json" 2>/dev/null || echo "0")
        high_alerts=$((high_alerts + suspicious_count))
    fi
    
    if [[ -f "$OUTPUT_DIR/portscans.json" ]]; then
        scan_count=$(grep -c '"source_ip"' "$OUTPUT_DIR/portscans.json" 2>/dev/null || echo "0")
        if [[ $scan_count -gt 5 ]]; then
            critical_alerts=$((critical_alerts + 1))
        else
            high_alerts=$((high_alerts + scan_count))
        fi
    fi
    
    if [[ -f "$OUTPUT_DIR/login_summary.json" ]]; then
        failed_logins=$(grep -o '"total_failed_logins": *[0-9]*' "$OUTPUT_DIR/login_summary.json" 2>/dev/null | cut -d':' -f2 | tr -d ' ' || echo "0")
        if [[ $failed_logins -gt 50 ]]; then
            critical_alerts=$((critical_alerts + 1))
        elif [[ $failed_logins -gt 10 ]]; then
            high_alerts=$((high_alerts + 1))
        else
            medium_alerts=$((medium_alerts + failed_logins))
        fi
    fi
    
    local total_alerts=$((critical_alerts + high_alerts + medium_alerts + low_alerts))
    
    cat > "$OUTPUT_DIR/alert_summary.json" << EOF
{
    "total_alerts": $total_alerts,
    "critical_alerts": $critical_alerts,
    "high_alerts": $high_alerts,
    "medium_alerts": $medium_alerts,
    "low_alerts": $low_alerts,
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
}
EOF
}

# Function to generate SOC status
generate_soc_status() {
    echo "Generating SOC status..."
    
    local status="operational"
    local message="All systems operational"
    
    # Check if there are any critical issues
    if [[ -f "$OUTPUT_DIR/alert_summary.json" ]]; then
        critical_alerts=$(grep -o '"critical_alerts": *[0-9]*' "$OUTPUT_DIR/alert_summary.json" 2>/dev/null | cut -d':' -f2 | tr -d ' ' || echo "0")
        if [[ $critical_alerts -gt 0 ]]; then
            status="critical"
            message="Critical alerts detected - immediate attention required"
        fi
    fi
    
    cat > "$OUTPUT_DIR/soc_status.json" << EOF
{
    "status": "$status",
    "message": "$message",
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
}
EOF
}

# Main execution
echo "Starting comprehensive security report generation..."

# Run all monitoring scripts
run_all_monitors

# Generate all reports
generate_executive_summary
generate_security_metrics
generate_alert_summary
generate_soc_status

echo "Security report generation completed."
echo "Reports saved to: $OUTPUT_DIR"
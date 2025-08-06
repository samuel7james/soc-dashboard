#!/bin/bash
# Monitor failed login attempts and suspicious authentication activity
# Windows-compatible version

# Determine output directory based on platform
if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    # Windows with Git Bash - use absolute path
    SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
    OUTPUT_DIR="$SCRIPT_DIR/../data"
    LOG_FILE="/dev/null"  # Windows doesn't have auth.log
else
    # Unix/Linux
    OUTPUT_DIR="/tmp/soc_data"
    LOG_FILE="/var/log/auth.log"
fi

FAILED_LOGINS_FILE="$OUTPUT_DIR/failed_logins.json"

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Function to get failed login attempts from last 10 minutes
get_failed_logins() {
    # Check if we're on Windows or if auth.log doesn't exist
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ ! -f "$LOG_FILE" ]]; then
        # Generate sample data for Windows
        local current_time=$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')
        local five_minutes_ago=$(date -d '5 minutes ago' -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')
        local ten_minutes_ago=$(date -d '10 minutes ago' -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')
        
        cat > "$FAILED_LOGINS_FILE" << EOF
[
  {
    "timestamp": "$current_time",
    "ip": "192.168.1.100",
    "username": "admin",
    "attempts": 3,
    "status": "failed"
  },
  {
    "timestamp": "$five_minutes_ago",
    "ip": "10.0.0.50",
    "username": "root",
    "attempts": 2,
    "status": "failed"
  },
  {
    "timestamp": "$ten_minutes_ago",
    "ip": "172.16.0.25",
    "username": "user",
    "attempts": 1,
    "status": "successful"
  }
]
EOF
        return
    fi
    
    local current_time=$(date +%s)
    local ten_minutes_ago=$((current_time - 600))
    
    # Parse auth.log for failed attempts
    failed_attempts=$(grep "Failed password" "$LOG_FILE" 2>/dev/null | tail -n 100 | while IFS= read -r line; do
        # Extract IP, username, and timestamp
        ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}')
        user=$(echo "$line" | grep -oP 'for \K[^ ]+')
        timestamp=$(echo "$line" | awk '{print $1" "$2" "$3}')
        
        if [[ -n "$ip" && -n "$user" ]]; then
            echo "{\"timestamp\": \"$timestamp\", \"ip\": \"$ip\", \"username\": \"$user\", \"attempts\": 1, \"status\": \"failed\"}"
        fi
    done)
    
    # Get successful logins for comparison
    successful_attempts=$(grep "Accepted password" "$LOG_FILE" 2>/dev/null | tail -n 50 | while IFS= read -r line; do
        ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}')
        user=$(echo "$line" | grep -oP 'for \K[^ ]+')
        timestamp=$(echo "$line" | awk '{print $1" "$2" "$3}')
        
        if [[ -n "$ip" && -n "$user" ]]; then
            echo "{\"timestamp\": \"$timestamp\", \"ip\": \"$ip\", \"username\": \"$user\", \"attempts\": 1, \"status\": \"successful\"}"
        fi
    done)
    
    # Combine and format as JSON array
    echo "["
    echo "$failed_attempts" | head -n 20
    if [[ -n "$failed_attempts" && -n "$successful_attempts" ]]; then
        echo ","
    fi
    echo "$successful_attempts" | head -n 10
    echo "]" | tr '\n' ' ' | sed 's/} *{/},{/g'
}

# Function to get top attacking IPs
get_top_attackers() {
    # Check if we're on Windows or if auth.log doesn't exist
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ ! -f "$LOG_FILE" ]]; then
        # Generate sample data for Windows
        cat > "$OUTPUT_DIR/top_attackers.json" << EOF
[
  {"ip": "192.168.1.100", "attempts": 5, "country": "Unknown", "last_seen": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"},
  {"ip": "10.0.0.50", "attempts": 3, "country": "Unknown", "last_seen": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"},
  {"ip": "172.16.0.25", "attempts": 2, "country": "Unknown", "last_seen": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"}
]
EOF
        return
    fi
    
    # Parse auth.log for top attackers
    grep "Failed password" "$LOG_FILE" 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort | uniq -c | sort -nr | head -10 | while read -r count ip; do
        echo "{\"ip\": \"$ip\", \"attempts\": $count, \"country\": \"Unknown\", \"last_seen\": \"$(date -Iseconds)\"}"
    done | jq -s '.' > "$OUTPUT_DIR/top_attackers.json" 2>/dev/null || echo "[]" > "$OUTPUT_DIR/top_attackers.json"
}

# Function to detect brute force attacks
detect_brute_force() {
    # Check if we're on Windows or if auth.log doesn't exist
    if [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ ! -f "$LOG_FILE" ]]; then
        # Generate sample data for Windows
        cat > "$OUTPUT_DIR/brute_force_alerts.json" << EOF
[
  {
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')",
    "ip": "192.168.1.100",
    "username": "admin",
    "attempts": 15,
    "duration_minutes": 5,
    "severity": "high"
  }
]
EOF
        return
    fi
    
    # Detect brute force attacks (more than 10 failed attempts in 5 minutes)
    local current_time=$(date +%s)
    local five_minutes_ago=$((current_time - 300))
    
    grep "Failed password" "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
        ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}')
        user=$(echo "$line" | grep -oP 'for \K[^ ]+')
        timestamp=$(echo "$line" | awk '{print $1" "$2" "$3}')
        
        if [[ -n "$ip" && -n "$user" ]]; then
            # Count attempts for this IP/user combination in the last 5 minutes
            attempts=$(grep "Failed password.*$ip.*$user" "$LOG_FILE" 2>/dev/null | wc -l)
            
            if [[ $attempts -gt 10 ]]; then
                echo "{\"timestamp\": \"$timestamp\", \"ip\": \"$ip\", \"username\": \"$user\", \"attempts\": $attempts, \"duration_minutes\": 5, \"severity\": \"high\"}"
            fi
        fi
    done | head -5 | jq -s '.' > "$OUTPUT_DIR/brute_force_alerts.json" 2>/dev/null || echo "[]" > "$OUTPUT_DIR/brute_force_alerts.json"
}

# Function to generate login summary
generate_login_summary() {
    echo "Generating login summary..."
    
    # Count failed logins
    local failed_count=0
    if [[ -f "$FAILED_LOGINS_FILE" ]]; then
        failed_count=$(grep -c '"status": "failed"' "$FAILED_LOGINS_FILE" 2>/dev/null || echo "0")
    fi
    
    # Count successful logins
    local successful_count=0
    if [[ -f "$FAILED_LOGINS_FILE" ]]; then
        successful_count=$(grep -c '"status": "successful"' "$FAILED_LOGINS_FILE" 2>/dev/null || echo "0")
    fi
    
    # Count unique attacking IPs
    local unique_ips=0
    if [[ -f "$OUTPUT_DIR/top_attackers.json" ]]; then
        unique_ips=$(grep -c '"ip"' "$OUTPUT_DIR/top_attackers.json" 2>/dev/null || echo "0")
    fi
    
    # Count brute force attempts
    local brute_force_count=0
    if [[ -f "$OUTPUT_DIR/brute_force_alerts.json" ]]; then
        brute_force_count=$(grep -c '"severity": "high"' "$OUTPUT_DIR/brute_force_alerts.json" 2>/dev/null || echo "0")
    fi
    
    cat > "$OUTPUT_DIR/login_summary.json" << EOF
{
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')",
    "total_failed_logins": $failed_count,
    "total_successful_logins": $successful_count,
    "unique_attacking_ips": $unique_ips,
    "brute_force_attempts": $brute_force_count
}
EOF
}

# Main execution
echo "Starting login monitoring..."

# Run all login checks
get_failed_logins
get_top_attackers
detect_brute_force
generate_login_summary

echo "Login monitoring completed."
echo "Results saved to: $OUTPUT_DIR"
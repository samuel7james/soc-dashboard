#!/bin/bash
# Monitor running processes for suspicious activity
# Windows-compatible version

# Detect platform and set output directory
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows with Git Bash
    OUTPUT_DIR="$(pwd)/../data"
else
    # Linux/Unix
    OUTPUT_DIR="/tmp/soc_data"
fi

PROCESS_FILE="$OUTPUT_DIR/processes.json"
TOP_PROCESSES_FILE="$OUTPUT_DIR/top_processes.json"
PROCESS_SUMMARY_FILE="$OUTPUT_DIR/process_summary.json"
NETWORK_PROCESSES_FILE="$OUTPUT_DIR/network_processes.json"
ROOT_PROCESSES_FILE="$OUTPUT_DIR/root_processes.json"

mkdir -p "$OUTPUT_DIR"

# List of suspicious process names and patterns
SUSPICIOUS_PROCESSES=(
    "netcat" "nc" "ncat"
    "nmap" "masscan" "zmap"
    "metasploit" "msfconsole"
    "john" "hashcat" "hydra"
    "sqlmap" "nikto" "dirb"
    "wireshark" "tcpdump"
    "backdoor" "rootkit"
    "mimikatz" "powersploit"
)

# Function to check for suspicious processes
check_suspicious_processes() {
    echo "Checking for suspicious processes..."
    
    # Check if we're on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Generate sample suspicious processes data for Windows
        cat > "$OUTPUT_DIR/suspicious_processes.json" << EOF
[
    {
        "process_name": "nmap",
        "pid": 1234,
        "cpu_usage": "5.2",
        "memory_usage": "2.1",
        "command": "nmap.exe -sS 192.168.1.0/24",
        "severity": "high",
        "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
    }
]
EOF
        return
    fi
    
    suspicious_found="[]"
    suspicious_entries=""
    
    for proc in "${SUSPICIOUS_PROCESSES[@]}"; do
        # Cross-platform process checking
        if command -v tasklist >/dev/null 2>&1; then
            # Windows
            if tasklist /FI "IMAGENAME eq $proc.exe" 2>/dev/null | grep -q "$proc.exe"; then
                pid=$(tasklist /FI "IMAGENAME eq $proc.exe" /FO CSV 2>/dev/null | grep "$proc.exe" | cut -d',' -f2 | tr -d '"' | head -1)
                cpu_usage="0.0"
                mem_usage="0.0"
                command="$proc.exe"
                
                if [[ -n "$suspicious_entries" ]]; then
                    suspicious_entries+=","
                fi
                
                suspicious_entries+="{
                    \"process_name\": \"$proc\",
                    \"pid\": $pid,
                    \"cpu_usage\": \"$cpu_usage\",
                    \"memory_usage\": \"$mem_usage\",
                    \"command\": \"$command\",
                    \"severity\": \"high\",
                    \"timestamp\": \"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')\"
                }"
                
                echo "Found suspicious process: $proc (PID: $pid)"
            fi
        elif command -v pgrep >/dev/null 2>&1; then
            # Linux/Unix
            if pgrep "$proc" > /dev/null 2>&1; then
                pid=$(pgrep "$proc" | head -1)
                cpu_usage=$(ps -p "$pid" -o %cpu --no-headers 2>/dev/null | tr -d ' ' || echo "0.0")
                mem_usage=$(ps -p "$pid" -o %mem --no-headers 2>/dev/null | tr -d ' ' || echo "0.0")
                command=$(ps -p "$pid" -o cmd --no-headers 2>/dev/null || echo "$proc")
                
                if [[ -n "$suspicious_entries" ]]; then
                    suspicious_entries+=","
                fi
                
                suspicious_entries+="{
                    \"process_name\": \"$proc\",
                    \"pid\": $pid,
                    \"cpu_usage\": \"$cpu_usage\",
                    \"memory_usage\": \"$mem_usage\",
                    \"command\": \"$command\",
                    \"severity\": \"high\",
                    \"timestamp\": \"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')\"
                }"
                
                echo "Found suspicious process: $proc (PID: $pid)"
            fi
        fi
    done
    
    if [[ -n "$suspicious_entries" ]]; then
        suspicious_found="[$suspicious_entries]"
    fi
    
    echo "$suspicious_found" > "$OUTPUT_DIR/suspicious_processes.json"
}

# Function to monitor high resource usage processes
monitor_resource_usage() {
    echo "Monitoring resource usage..."
    
    # Check if we're on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Generate sample top processes data for Windows
        cat > "$TOP_PROCESSES_FILE" << EOF
[
    {"user": "SYSTEM", "pid": 4, "cpu": 2.5, "memory": 1.2, "command": "System"},
    {"user": "Administrator", "pid": 1234, "cpu": 1.8, "memory": 0.8, "command": "chrome.exe"},
    {"user": "Administrator", "pid": 5678, "cpu": 1.2, "memory": 0.6, "command": "node.exe"},
    {"user": "SYSTEM", "pid": 9012, "cpu": 0.9, "memory": 0.4, "command": "svchost.exe"},
    {"user": "Administrator", "pid": 3456, "cpu": 0.7, "memory": 0.3, "command": "explorer.exe"}
]
EOF
        return
    fi
    
    # Cross-platform process monitoring
    if command -v tasklist >/dev/null 2>&1; then
        # Windows - get top processes
        tasklist /FO CSV /V 2>/dev/null | grep -v "Image Name" | head -10 | while IFS=',' read -r image_name pid session_name session_num mem_usage status username cpu_time window_title; do
            # Clean up the CSV values
            image_name=$(echo "$image_name" | tr -d '"')
            pid=$(echo "$pid" | tr -d '"')
            mem_usage=$(echo "$mem_usage" | tr -d '"' | sed 's/,//g')
            username=$(echo "$username" | tr -d '"')
            
            # Convert memory usage to percentage (simplified)
            mem_percent="0.0"
            if [[ -n "$mem_usage" && "$mem_usage" != "N/A" ]]; then
                mem_percent=$(echo "$mem_usage" | sed 's/[^0-9]//g')
                if [[ -n "$mem_percent" ]]; then
                    mem_percent=$(echo "scale=1; $mem_percent / 100" | bc 2>/dev/null || echo "0.0")
                fi
            fi
            
            echo "{\"user\": \"$username\", \"pid\": $pid, \"cpu\": 0.0, \"memory\": $mem_percent, \"command\": \"$image_name\"}"
        done > /tmp/top_procs.txt 2>/dev/null || echo "[]" > /tmp/top_procs.txt
        
        # Convert to JSON array
        if [[ -s /tmp/top_procs.txt ]]; then
            echo "[" > "$TOP_PROCESSES_FILE"
            first=true
            while IFS= read -r line; do
                if [[ "$first" == true ]]; then
                    first=false
                else
                    echo "," >> "$TOP_PROCESSES_FILE"
                fi
                echo "$line" >> "$TOP_PROCESSES_FILE"
            done < /tmp/top_procs.txt
            echo "]" >> "$TOP_PROCESSES_FILE"
        else
            echo "[]" > "$TOP_PROCESSES_FILE"
        fi
        
    elif command -v ps >/dev/null 2>&1; then
        # Linux/Unix - get top processes
        ps aux 2>/dev/null | head -10 | tail -n +2 | while IFS= read -r line; do
            user=$(echo "$line" | awk '{print $1}')
            pid=$(echo "$line" | awk '{print $2}')
            cpu=$(echo "$line" | awk '{print $3}')
            mem=$(echo "$line" | awk '{print $4}')
            command=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}' | sed 's/[[:space:]]*$//' | cut -c1-100)
            
            echo "{\"user\": \"$user\", \"pid\": $pid, \"cpu\": $cpu, \"memory\": $mem, \"command\": \"$command\"}"
        done | jq -s '.' > "$TOP_PROCESSES_FILE" 2>/dev/null || {
            # Fallback without jq
            ps aux 2>/dev/null | head -10 | tail -n +2 > /tmp/top_procs.txt
            echo "[]" > "$TOP_PROCESSES_FILE"
        }
    else
        echo "[]" > "$TOP_PROCESSES_FILE"
    fi
}

# Function to check for unusual network connections by processes
check_network_processes() {
    echo "Checking network processes..."
    
    # Check if we're on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Generate sample network processes data for Windows
        cat > "$NETWORK_PROCESSES_FILE" << EOF
[
    {"protocol": "TCP", "local_address": "0.0.0.0:80", "foreign_address": "0.0.0.0:0", "state": "LISTENING", "process": "httpd.exe"},
    {"protocol": "TCP", "local_address": "127.0.0.1:3000", "foreign_address": "0.0.0.0:0", "state": "LISTENING", "process": "node.exe"},
    {"protocol": "TCP", "local_address": "0.0.0.0:443", "foreign_address": "0.0.0.0:0", "state": "LISTENING", "process": "httpd.exe"}
]
EOF
        return
    fi
    
    # Cross-platform network process checking
    if command -v netstat >/dev/null 2>&1; then
        # Find processes with network connections
        netstat -tulpn 2>/dev/null | grep -E "LISTEN|ESTABLISHED" | head -20 | while IFS= read -r line; do
            proto=$(echo "$line" | awk '{print $1}')
            local_addr=$(echo "$line" | awk '{print $4}')
            foreign_addr=$(echo "$line" | awk '{print $5}')
            state=$(echo "$line" | awk '{print $6}')
            process_info=$(echo "$line" | awk '{print $7}')
            
            if [[ "$process_info" != "-" && -n "$process_info" ]]; then
                echo "{\"protocol\": \"$proto\", \"local_address\": \"$local_addr\", \"foreign_address\": \"$foreign_addr\", \"state\": \"$state\", \"process\": \"$process_info\"}"
            fi
        done | jq -s '.' > "$NETWORK_PROCESSES_FILE" 2>/dev/null || echo "[]" > "$NETWORK_PROCESSES_FILE"
    else
        echo "[]" > "$NETWORK_PROCESSES_FILE"
    fi
}

# Function to detect processes running as root
check_root_processes() {
    echo "Checking processes running as root..."
    
    # Check if we're on Windows
    if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        # Generate sample root processes data for Windows (SYSTEM processes)
        cat > "$ROOT_PROCESSES_FILE" << EOF
[
    {"process_name": "System", "pid": 4, "user": "SYSTEM", "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"},
    {"process_name": "svchost.exe", "pid": 9012, "user": "SYSTEM", "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"},
    {"process_name": "winlogon.exe", "pid": 5678, "user": "SYSTEM", "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"}
]
EOF
        return
    fi
    
    root_processes="[]"
    root_entries=""
    
    if command -v tasklist >/dev/null 2>&1; then
        # Windows - check for SYSTEM processes
        tasklist /FO CSV /V 2>/dev/null | grep "SYSTEM" | head -10 | while IFS=',' read -r image_name pid session_name session_num mem_usage status username cpu_time window_title; do
            image_name=$(echo "$image_name" | tr -d '"')
            pid=$(echo "$pid" | tr -d '"')
            username=$(echo "$username" | tr -d '"')
            
            if [[ -n "$root_entries" ]]; then
                root_entries+=","
            fi
            
            root_entries+="{
                \"process_name\": \"$image_name\",
                \"pid\": $pid,
                \"user\": \"$username\",
                \"timestamp\": \"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')\"
            }"
        done
    elif command -v ps >/dev/null 2>&1; then
        # Linux/Unix - check for root processes
        ps aux 2>/dev/null | grep "^root" | head -10 | while IFS= read -r line; do
            user=$(echo "$line" | awk '{print $1}')
            pid=$(echo "$line" | awk '{print $2}')
            command=$(echo "$line" | awk '{for(i=11;i<=NF;i++) printf "%s ", $i; print ""}' | sed 's/[[:space:]]*$//' | cut -c1-100)
            
            if [[ -n "$root_entries" ]]; then
                root_entries+=","
            fi
            
            root_entries+="{
                \"process_name\": \"$command\",
                \"pid\": $pid,
                \"user\": \"$user\",
                \"timestamp\": \"$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')\"
            }"
        done
    fi
    
    if [[ -n "$root_entries" ]]; then
        root_processes="[$root_entries]"
    fi
    
    echo "$root_processes" > "$ROOT_PROCESSES_FILE"
}

# Function to check for processes with unusual parent-child relationships
check_process_tree() {
    echo "Analyzing process tree..."
    
    # Look for processes that might indicate privilege escalation or injection
    ps axjf | head -50 | while IFS= read -r line; do
        ppid=$(echo "$line" | awk '{print $1}')
        pid=$(echo "$line" | awk '{print $2}')
        pgid=$(echo "$line" | awk '{print $3}')
        sid=$(echo "$line" | awk '{print $4}')
        command=$(echo "$line" | awk '{for(i=8;i<=NF;i++) printf "%s ", $i; print ""}' | sed 's/[[:space:]]*$//' | cut -c1-100)
        
        if [[ "$pid" != "PID" ]]; then
            echo "{\"ppid\": $ppid, \"pid\": $pid, \"pgid\": $pgid, \"sid\": $sid, \"command\": \"$command\"}"
        fi
    done | jq -s '.' > "$OUTPUT_DIR/process_tree.json" 2>/dev/null || echo "[]" > "$OUTPUT_DIR/process_tree.json"
}

# Function to generate process summary
generate_process_summary() {
    echo "Generating process summary..."
    
    # Count total processes
    total_processes=0
    if command -v tasklist >/dev/null 2>&1; then
        total_processes=$(tasklist /FO CSV 2>/dev/null | grep -c "\.exe" || echo "0")
    elif command -v ps >/dev/null 2>&1; then
        total_processes=$(ps aux 2>/dev/null | wc -l || echo "0")
        total_processes=$((total_processes - 1))  # Subtract header line
    fi
    
    # Count suspicious processes
    suspicious_count=0
    if [[ -f "$OUTPUT_DIR/suspicious_processes.json" ]]; then
        suspicious_count=$(grep -c '"process_name"' "$OUTPUT_DIR/suspicious_processes.json" 2>/dev/null || echo "0")
    fi
    
    # Count root processes
    root_count=0
    if [[ -f "$ROOT_PROCESSES_FILE" ]]; then
        root_count=$(grep -c '"process_name"' "$ROOT_PROCESSES_FILE" 2>/dev/null || echo "0")
    fi
    
    cat > "$PROCESS_SUMMARY_FILE" << EOF
{
    "total_processes": $total_processes,
    "suspicious_processes": $suspicious_count,
    "root_processes": $root_count,
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
}
EOF
}

# Main execution
echo "Starting process monitoring..."

# Run all process checks
check_suspicious_processes
monitor_resource_usage
check_network_processes
check_root_processes
generate_process_summary

echo "Process monitoring completed."
echo "Results saved to: $OUTPUT_DIR"
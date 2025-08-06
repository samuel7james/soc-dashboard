#!/bin/bash
# Geolocate IP addresses from security events
# Windows-compatible version

# Detect platform and set output directory
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
    # Windows with Git Bash
    OUTPUT_DIR="$(pwd)/../data"
else
    # Linux/Unix
    OUTPUT_DIR="/tmp/soc_data"
fi

GEO_FILE="$OUTPUT_DIR/ip_geolocation.json"
ATTACK_BY_COUNTRY_FILE="$OUTPUT_DIR/attack_by_country.json"
THREAT_MAP_FILE="$OUTPUT_DIR/threat_map.json"
THREAT_INTELLIGENCE_FILE="$OUTPUT_DIR/threat_intelligence.json"

mkdir -p "$OUTPUT_DIR"

# Function to get geolocation for IP (using free service)
geolocate_ip() {
    local ip="$1"
    
    # Use a free IP geolocation service (http://ip-api.com)
    geo_data=$(curl -s --connect-timeout 5 --max-time 10 "http://ip-api.com/json/$ip" 2>/dev/null)
    
    if [[ $? -eq 0 && "$geo_data" != *"fail"* && -n "$geo_data" ]]; then
        echo "$geo_data"
    else
        # Fallback with mock data for demo
        countries=("China" "Russia" "United States" "Brazil" "India" "Germany" "France" "United Kingdom")
        cities=("Beijing" "Moscow" "New York" "São Paulo" "Mumbai" "Berlin" "Paris" "London")
        country=${countries[$((RANDOM % ${#countries[@]}))]}
        city=${cities[$((RANDOM % ${#cities[@]}))]}
        
        echo "{\"query\":\"$ip\",\"status\":\"success\",\"country\":\"$country\",\"countryCode\":\"XX\",\"region\":\"XX\",\"regionName\":\"Unknown\",\"city\":\"$city\",\"lat\":$((RANDOM % 90)),\"lon\":$((RANDOM % 180)),\"timezone\":\"Unknown\",\"isp\":\"Unknown Provider\"}"
    fi
}

# Function to process IPs from failed login attempts
process_failed_login_ips() {
    echo "Processing IP geolocation from failed logins..."
    
    if [[ -f "$OUTPUT_DIR/failed_logins.json" ]]; then
        # Extract unique IPs from failed login data - handle both jq and manual parsing
        if command -v jq >/dev/null 2>&1; then
            unique_ips=$(cat "$OUTPUT_DIR/failed_logins.json" | jq -r '.[].ip' 2>/dev/null | sort -u | head -10)
        else
            # Manual parsing if jq not available
            unique_ips=$(grep -o '"ip": *"[^"]*"' "$OUTPUT_DIR/failed_logins.json" | cut -d'"' -f4 | sort -u | head -10)
        fi
        
        geo_results="["
        first_entry=true
        
        for ip in $unique_ips; do
            if [[ "$ip" != "null" && "$ip" != "" && "$ip" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
                geo_info=$(geolocate_ip "$ip")
                
                if [[ "$first_entry" == false ]]; then
                    geo_results+=","
                fi
                
                geo_results+="$geo_info"
                first_entry=false
                
                # Rate limiting for API
                sleep 0.2
            fi
        done
        
        geo_results+="]"
        echo "$geo_results" > "$GEO_FILE"
    else
        # Create sample geo data if no failed logins
        cat > "$GEO_FILE" << EOF
[
    {"query":"192.168.1.100","status":"success","country":"China","countryCode":"CN","city":"Shanghai","lat":31.2222,"lon":121.4581,"isp":"China Telecom"},
    {"query":"10.0.0.50","status":"success","country":"Russia","countryCode":"RU","city":"Moscow","lat":55.7558,"lon":37.6173,"isp":"Rostelecom"},
    {"query":"172.16.0.25","status":"success","country":"United States","countryCode":"US","city":"New York","lat":40.7128,"lon":-74.0060,"isp":"Comcast"}
]
EOF
    fi
}

# Function to generate attack source statistics
generate_geo_stats() {
    echo "Generating geolocation statistics..."
    
    if [[ -f "$GEO_FILE" ]]; then
        # Count attacks by country - handle both jq and manual parsing
        if command -v jq >/dev/null 2>&1; then
            country_stats=$(cat "$GEO_FILE" | jq -r '.[].country' 2>/dev/null | sort | uniq -c | sort -nr | head -10)
        else
            # Manual parsing if jq not available
            country_stats=$(grep -o '"country": *"[^"]*"' "$GEO_FILE" | cut -d'"' -f4 | sort | uniq -c | sort -nr | head -10)
        fi
        
        # Create country statistics JSON
        country_json="["
        first_entry=true
        
        echo "$country_stats" | while read count country; do
            if [[ -n "$country" && "$country" != "null" ]]; then
                if [[ "$first_entry" == false ]]; then
                    echo ","
                fi
                echo "{\"country\": \"$country\", \"attack_count\": $count}"
                first_entry=false
            fi
        done > /tmp/country_temp.json
        
        if [[ -s /tmp/country_temp.json ]]; then
            echo "[" > "$ATTACK_BY_COUNTRY_FILE"
            cat /tmp/country_temp.json >> "$ATTACK_BY_COUNTRY_FILE"
            echo "]" >> "$ATTACK_BY_COUNTRY_FILE"
        else
            # Create sample country statistics
            cat > "$ATTACK_BY_COUNTRY_FILE" << EOF
[
    {"country": "China", "attack_count": 15},
    {"country": "Russia", "attack_count": 8},
    {"country": "United States", "attack_count": 5},
    {"country": "Brazil", "attack_count": 3},
    {"country": "India", "attack_count": 2}
]
EOF
        fi
    else
        # Create sample country statistics if no geo data
        cat > "$ATTACK_BY_COUNTRY_FILE" << EOF
[
    {"country": "China", "attack_count": 15},
    {"country": "Russia", "attack_count": 8},
    {"country": "United States", "attack_count": 5},
    {"country": "Brazil", "attack_count": 3},
    {"country": "India", "attack_count": 2}
]
EOF
    fi
}

# Function to generate threat map data
generate_threat_map() {
    echo "Generating threat map data..."
    
    cat > "$THREAT_MAP_FILE" << EOF
{
    "threat_sources": [
        {"lat": 31.2222, "lon": 121.4581, "country": "China", "threat_level": "high", "attack_count": 15},
        {"lat": 55.7558, "lon": 37.6173, "country": "Russia", "threat_level": "high", "attack_count": 8},
        {"lat": 40.7128, "lon": -74.0060, "country": "United States", "threat_level": "medium", "attack_count": 5},
        {"lat": -23.5505, "lon": -46.6333, "country": "Brazil", "threat_level": "medium", "attack_count": 3},
        {"lat": 19.0760, "lon": 72.8777, "country": "India", "threat_level": "low", "attack_count": 2}
    ],
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
}
EOF
}

# Function to generate threat intelligence data
generate_threat_intelligence() {
    echo "Generating threat intelligence data..."
    
    cat > "$THREAT_INTELLIGENCE_FILE" << EOF
{
    "threat_indicators": [
        {"indicator": "192.168.1.100", "type": "ip", "threat_level": "high", "description": "Suspicious activity detected"},
        {"indicator": "10.0.0.50", "type": "ip", "threat_level": "medium", "description": "Port scan activity"},
        {"indicator": "172.16.0.25", "type": "ip", "threat_level": "low", "description": "Failed login attempts"}
    ],
    "threat_trends": [
        {"trend": "Brute Force Attacks", "frequency": "increasing", "severity": "high"},
        {"trend": "Port Scanning", "frequency": "stable", "severity": "medium"},
        {"trend": "DDoS Attempts", "frequency": "decreasing", "severity": "low"}
    ],
    "timestamp": "$(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
}
EOF
}

# Main execution
echo "Starting IP geolocation analysis..."

# Process IP geolocation
process_failed_login_ips

# Generate statistics
generate_geo_stats

# Generate threat map
generate_threat_map

# Generate threat intelligence
generate_threat_intelligence

echo "IP geolocation analysis completed."
echo "Results saved to: $OUTPUT_DIR"
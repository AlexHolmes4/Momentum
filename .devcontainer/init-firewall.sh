#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

# Lightweight firewall: allow all HTTPS, block unexpected ports
# No domain restrictions — just protocol hygiene

echo "Configuring lightweight firewall..."

# Preserve Docker DNS rules before flushing
DOCKER_DNS_RULES=$(iptables-save -t nat | grep "127\.0\.0\.11" || true)

# Flush existing rules
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

# Restore Docker internal DNS resolution
if [ -n "$DOCKER_DNS_RULES" ]; then
    echo "Restoring Docker DNS rules..."
    iptables -t nat -N DOCKER_OUTPUT 2>/dev/null || true
    iptables -t nat -N DOCKER_POSTROUTING 2>/dev/null || true
    echo "$DOCKER_DNS_RULES" | xargs -L 1 iptables -t nat
fi

# Localhost — unrestricted
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established/related connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Host network — needed for Docker MCP servers, forwarded ports, etc.
HOST_IP=$(ip route | grep default | cut -d" " -f3)
if [ -z "$HOST_IP" ]; then
    echo "ERROR: Failed to detect host IP"
    exit 1
fi
HOST_NETWORK=$(echo "$HOST_IP" | sed "s/\.[0-9]*$/.0\/24/")
echo "Host network: $HOST_NETWORK"
iptables -A INPUT -s "$HOST_NETWORK" -j ACCEPT
iptables -A OUTPUT -d "$HOST_NETWORK" -j ACCEPT

# DNS (UDP 53) — required for domain resolution
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --sport 53 -j ACCEPT

# HTTPS (TCP 443) — all domains allowed
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# SSH (TCP 22) — for git over SSH
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT

# HTTP (TCP 80) — some package registries and redirects need this
iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT

# Default policy: reject everything else with immediate feedback
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT DROP
iptables -A OUTPUT -j REJECT --reject-with icmp-admin-prohibited

echo "Firewall configured — HTTPS/HTTP/DNS/SSH allowed, other ports blocked"

# Verification
echo "Verifying..."
if curl -s --connect-timeout 5 https://api.github.com/zen >/dev/null 2>&1; then
    echo "  PASS: HTTPS works (reached api.github.com)"
else
    echo "  FAIL: Cannot reach HTTPS — check rules"
    exit 1
fi

echo "Firewall ready."

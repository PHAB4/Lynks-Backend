"""Test raw connection to Supabase - bypasses URL parsing."""
import os
import socket
import subprocess
from dotenv import load_dotenv
load_dotenv()

raw_url = os.getenv("DATABASE_URL", "")
print(f"Raw URL: {raw_url[:60]}...")

# Manual parse
url_body = raw_url.split("://", 1)[1]
user_pass, host_db = url_body.split("@", 1)
username = user_pass.split(":")[0]
host_port_db = host_db.split("/")
hostname = host_port_db[0]
database = host_port_db[1] if len(host_port_db) > 1 else "postgres"

if ":" in hostname:
    h, p = hostname.rsplit(":", 1)
    hostname = h
    port = int(p)
else:
    port = 5432

print(f"Hostname: {hostname}")
print(f"Port: {port}")
print(f"Username: {username}")

print("\n=== DNS RESOLUTION ===")
try:
    infos = socket.getaddrinfo(hostname, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
    for info in infos:
        family, _, _, _, sockaddr = info
        ip_type = "IPv4" if family == socket.AF_INET else "IPv6"
        print(f"  {ip_type}: {sockaddr[0]}")
except Exception as e:
    print(f"FAILED: {e}")
    print("\nTrying Google DNS...")
    result = subprocess.run(["nslookup", hostname, "8.8.8.8"], capture_output=True, text=True)
    print(result.stdout)

print("\n=== TCP CONNECTION ===")
try:
    sock = socket.create_connection((hostname, port), timeout=10)
    print(f"CONNECTED to {hostname}:{port}")
    sock.close()
except Exception as e:
    print(f"FAILED: {e}")
    print("\nYour machine cannot reach Supabase on this port.")
    print("Try adding to hosts file or check firewall.")

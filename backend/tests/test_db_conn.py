"""Quick test - can Python reach the Supabase database server?"""
import os
import socket
from urllib.parse import urlparse
from dotenv import load_dotenv
load_dotenv()

url = os.getenv("DATABASE_URL", "")
parsed = urlparse(url)
hostname = parsed.hostname
port = parsed.port or 5432

print(f"Hostname: {hostname}")
print(f"Port: {port}")
print(f"Username: {parsed.username}")

print("\n=== DNS RESOLUTION ===")
try:
    ip = socket.getaddrinfo(hostname, port)
    print(f"OK - resolved to: {ip[0][4][0]}")
except Exception as e:
    print(f"FAILED: {e}")

print("\n=== TCP CONNECTION ===")
try:
    sock = socket.create_connection((hostname, port), timeout=5)
    print(f"OK - connected to {hostname}:{port}")
    sock.close()
except Exception as e:
    print(f"FAILED: {e}")

print(f"\n=== RAW URL ===")
safe_url = url.replace(parsed.password, "****") if parsed.password else url
print(safe_url)

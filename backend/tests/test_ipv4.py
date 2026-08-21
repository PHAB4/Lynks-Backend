"""Force IPv4 connection to Supabase."""
import os
import socket
from dotenv import load_dotenv
load_dotenv()

hostname = "db.qcyxyunngbkupttcwlbk.supabase.co"

print("=== CHECKING IPv4 vs IPv6 ===")
try:
    ipv4 = socket.getaddrinfo(hostname, 5432, socket.AF_INET)
    print(f"IPv4: {ipv4[0][4][0]}")
except Exception as e:
    print(f"IPv4: FAILED - {e}")

try:
    ipv6 = socket.getaddrinfo(hostname, 5432, socket.AF_INET6)
    print(f"IPv6: {ipv6[0][4][0]}")
except Exception as e:
    print(f"IPv6: FAILED - {e}")

print("\n=== TESTING IPv4 CONNECTION ===")
test_ips = ["34.233.75.216", "54.224.0.1", "52.203.102.47"]
for ip in test_ips:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((ip, 5432))
        if result == 0:
            print(f"CONNECTED to {ip}:5432!")
            print(f"\nUse this in .env:")
            print(f'DATABASE_URL=postgresql+asyncpg://postgres:YOUR_PASSWORD@{ip}:5432/postgres')
            sock.close()
            break
        sock.close()
    except:
        continue
else:
    print("Could not connect to any test IP")

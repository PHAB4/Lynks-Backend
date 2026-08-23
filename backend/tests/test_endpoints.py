"""
Lynks Backend — End-to-End Test Script

This script tests every API endpoint against a running server.
It reports pass/fail for each endpoint so you know exactly what works and what doesn't.

SETUP:
  1. Make sure your server is running: uvicorn app.main:app --reload --port 8000
  2. Ensure your .env file has SUPABASE_URL and SUPABASE_ANON_KEY set
  3. Run: python tests/test_endpoints.py

WHAT IT TESTS:
  - Health check
  - Profile (GET)
  - Roadmap (POST generate, GET, POST regenerate)
  - Evidence upload (POST)
  - Portfolio (GET)
  - Opportunities (GET, GET with category filter)
  - Chat (POST message, GET history, DELETE history)
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load .env from project root (backend/)
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

HTTP_TIMEOUT = 30.0
LLM_TIMEOUT = 60.0

# Config — reads from .env automatically
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://your-project.supabase.co")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
JWT_TOKEN = os.getenv("JWT_TOKEN")
TEST_IMAGE_PATH = "tests/test-image.jpg"

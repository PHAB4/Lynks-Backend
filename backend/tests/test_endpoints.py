"""
Lynks Backend — End-to-End Test Script

This script tests every API endpoint against a running server.
It reports pass/fail for each endpoint so you know exactly what works and what doesn't.

SETUP:
  1. Make sure your server is running: uvicorn app.main:app --reload --port 8000
  2. Fill in the CONFIG section below with your values
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

"""Quick diagnostic - checks all connections."""
import os
from dotenv import load_dotenv
load_dotenv()

print("=== ENV CHECK ===")
print(f"DATABASE_URL starts with: {os.getenv('DATABASE_URL', 'MISSING')[:40]}...")
print(f"LLM_API_BASE_URL: {os.getenv('LLM_API_BASE_URL', 'MISSING')}")
print(f"LLM_API_KEY present: {bool(os.getenv('LLM_API_KEY'))}")
print(f"SUPABASE_URL: {os.getenv('SUPABASE_URL', 'MISSING')}")
print(f"SUPABASE_ANON_KEY present: {bool(os.getenv('SUPABASE_ANON_KEY'))}")

print("\n=== DB TEST ===")
try:
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine
    import sqlalchemy
    url = os.getenv("DATABASE_URL")
    engine = create_async_engine(url)
    async def test():
        async with engine.connect() as conn:
            result = await conn.execute(sqlalchemy.text("SELECT 1"))
            print(f"DB connection OK: {result.scalar()}")
    asyncio.run(test())
    engine.sync_dispose()
except Exception as e:
    print(f"DB FAILED: {e}")

print("\n=== LLM TEST ===")
try:
    from openai import OpenAI
    client = OpenAI(api_key=os.getenv("LLM_API_KEY"), base_url=os.getenv("LLM_API_BASE_URL"))
    r = client.chat.completions.create(
        model=os.getenv("LLM_MODEL", "llama3-70b-8192"),
        messages=[{"role": "user", "content": "Say hi in 3 words"}],
        max_tokens=20,
    )
    print(f"LLM OK: {r.choices[0].message.content}")
except Exception as e:
    print(f"LLM FAILED: {e}")

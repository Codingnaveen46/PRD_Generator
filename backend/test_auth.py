import os
import sys
import asyncio
from supabase import create_client, Client

async def test_conn():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    
    if not url or not key:
        print("Missing SUPABASE_URL or SUPABASE_KEY")
        sys.exit(1)
        
    print(f"Connecting to {url}")
    supabase: Client = create_client(url, key)
    try:
        # Try a simple unauthenticated request to health check or list prds
        res = supabase.table("prds").select("id").limit(1).execute()
        print("Successfully connected and queried DB.")
    except Exception as e:
        print(f"Connection failed: {e}")
        
    try:
        # Try creating a dummy user to test auth (this might fail if rate limited)
        import random
        rand_email = f"test_{random.randint(1000,9999)}@example.com"
        res = supabase.auth.sign_up({"email": rand_email, "password": "password123"})
        print("Successfully created a user.")
    except Exception as e:
        print(f"Auth signup failed: {e}")


if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(test_conn())

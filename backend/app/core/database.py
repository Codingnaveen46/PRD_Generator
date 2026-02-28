from supabase import create_client, Client
from app.core.config import settings

# Use the service role key to bypass Row-Level Security (RLS)
supabase: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)


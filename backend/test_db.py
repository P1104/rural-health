import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()

async def test():
    db_url = os.getenv("DATABASE_URL")
    print(f"Testing connection to: {db_url.split('@')[1] if '@' in db_url else db_url}")
    
    import ssl
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE

    engine = create_async_engine(
        db_url,
        connect_args={"ssl": ssl_ctx, "statement_cache_size": 0}
    )
    
    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT 1"))
            print(f"✅ SUCCESS: Connection verified. Result: {result.scalar()}")
    except Exception as e:
        print(f"❌ FAILURE: {str(e)}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test())

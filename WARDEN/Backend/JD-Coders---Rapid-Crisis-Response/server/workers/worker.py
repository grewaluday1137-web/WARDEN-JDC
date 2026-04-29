import time
import asyncio
from services.bucket_service import get_next_alert
from core.decision_engine import handle_alert


async def start_worker():
    print("[WORKER] Worker started and listening for alerts...")
    while True:
        try:
            try:
                alerts = get_next_alert()
                if alerts:
                    print(f"[WORKER] [INFO] Processing {len(alerts)} alerts from bucket...")
                    await handle_alert(alerts)
                else:
                    # Silent tick or minor log
                    pass
            except Exception as e:
                try:
                    print(f"[WORKER] [ERROR] Error in worker loop: {str(e).encode('ascii', 'ignore').decode('ascii')}")
                except:
                    print("[WORKER] [ERROR] Error in worker loop (undisplayable character)")
        except Exception as e:
            print("[WORKER] [CRITICAL] Critical error in worker loop")
        
        await asyncio.sleep(0.5)


if __name__ == "__main__":
    asyncio.run(start_worker())
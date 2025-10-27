from apscheduler.schedulers.background import BackgroundScheduler
from .recommender import recsys
from ..config import settings

sched = BackgroundScheduler()

def start():
    # nightly at 02:00 UTC
    sched.add_job(lambda: recsys.rebuild_from_csv(settings.csv_seed_path),
                  trigger="cron", hour=2, minute=0, id="rebuild_index")
    sched.start()


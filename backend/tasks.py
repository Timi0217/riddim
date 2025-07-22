from celery_worker import celery_app
import yt_dlp
import os

@celery_app.task(bind=True)
def download_track_task(self, url, out_name):
    output_dir = "storage"
    os.makedirs(output_dir, exist_ok=True)
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f'{output_dir}/{out_name}.%(ext)s',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'wav',
            'preferredquality': '320',
        }],
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        filename = ydl.prepare_filename(info).replace('.webm', '.wav').replace('.m4a', '.wav')
    return {"filename": os.path.basename(filename)}

@celery_app.task(bind=True)
def process_track_task(self, filename):
    input_path = os.path.join("storage", filename)
    output_dir = os.path.join("storage", filename + "_stems")
    os.makedirs(output_dir, exist_ok=True)
    # Removed: separator = Separator('spleeter:2stems')
    # Removed: separator.separate_to_file(input_path, output_dir)
    return {"stems_dir": output_dir} 
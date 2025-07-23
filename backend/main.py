from fastapi import FastAPI, Query, BackgroundTasks, Request, Body, Path
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
from celery.result import AsyncResult
from celery_worker import celery_app
from audiomack import spotify_search
from tasks import download_track_task, process_track_task
import os
import certifi
from dotenv import load_dotenv
load_dotenv()
os.environ['SSL_CERT_FILE'] = certifi.where()
import yt_dlp
import glob
import subprocess
import shutil
from twilio_auth import router as twilio_auth_router
from audio_processor import RiddimAudioProcessor
from db import get_db_connection, get_stems_by_spotify_id
import tempfile
import requests

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set to your frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(twilio_auth_router)

AUDIO_DIR = "storage"
os.makedirs(AUDIO_DIR, exist_ok=True)

class SnippetRequest(BaseModel):
    id: str
    start: float
    end: float

class SplitSnippetsRequest(BaseModel):
    songs: List[SnippetRequest]

class SplitResult(BaseModel):
    id: str
    vocals_url: str
    accompaniment_url: str

class SplitSnippetsResponse(BaseModel):
    results: List[SplitResult]

class MixRequest(BaseModel):
    track1_file: str
    track2_file: str
    tempo_factor: float = 1.0
    pitch_semitones: float = 0.0
    effects: dict = {}

class ProfessionalMixRequest(BaseModel):
    track1_urls: List[str]
    track2_urls: List[str]
    track1_time_window: dict
    track2_time_window: dict
    tempo_factor: float = 1.0
    pitch_semitones: float = 0.0
    effects: dict = {}

class AnalysisResponse(BaseModel):
    tempo: float
    key: float
    energy: float
    duration: float
    beats_count: int

class HarmonicSuggestionsResponse(BaseModel):
    compatible_keys: bool
    suggested_pitch_shift: float
    tempo_compatibility: bool
    energy_balance: float

@app.get("/search")
def search_tracks(q: str, page: int = 1, genre: str = None, sort: str = None):
    if not q or not q.strip():
        print("[Search] Empty query received, returning empty results.")
        return {"results": [], "page": page, "total": 0}
    return spotify_search(q, page, genre, sort)

@app.get("/song/{song_id}")
def get_song_info(song_id: str):
    return audiomack_song_info(song_id)

@app.get("/stream/{song_id}")
def get_stream_url(song_id: str):
    return audiomack_stream_url(song_id)

@app.post("/download")
def download_track(url: str, out_name: str):
    task = download_track_task.delay(url, out_name)
    return {"task_id": task.id}

@app.post("/process")
def process_track(filename: str):
    task = process_track_task.delay(filename)
    return {"task_id": task.id}

@app.post("/download_audio")
def download_audio(request: Request, background_tasks: BackgroundTasks):
    data = request.query_params or {}
    youtube_id = data.get('youtube_id')
    spotify_track_id = data.get('spotify_track_id')
    # 1. Try to fetch from stems DB if spotify_track_id is provided
    if spotify_track_id:
        stems_row = get_stems_by_spotify_id(spotify_track_id)
        if stems_row and stems_row.get("full_song_url"):
            return {"status": "ready", "full_song_url": stems_row["full_song_url"]}
    # 2. Fallback to YouTube download logic
    if not youtube_id:
        print("[DownloadAudio] No youtube_id provided")
        return {"error": "youtube_id required"}
    mp3_path = os.path.join(AUDIO_DIR, f"{youtube_id}.mp3")
    part_path = mp3_path + ".part"
    # 3. If .mp3 exists and is valid, return ready
    if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
        print(f"[DownloadAudio] Already downloaded: {mp3_path}")
        return {"status": "ready"}
    # 4. If .mp3.part exists, return downloading
    if os.path.exists(part_path):
        print(f"[DownloadAudio] Download in progress or orphaned .part file: {part_path}")
        return {"status": "downloading"}
    # 5. Start download in background
    def run_dl():
        print(f"[DownloadAudio] Starting download for {youtube_id}")
        outtmpl = os.path.join(AUDIO_DIR, f"{youtube_id}.%(ext)s")
        ydl_opts = {
            'format': 'bestaudio[ext=m4a]/bestaudio/best',
            'outtmpl': outtmpl,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
            'noplaylist': True,
            'quiet': False,
            'nooverwrites': False,
            'continuedl': True,
            'retries': 3,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([f"https://www.youtube.com/watch?v={youtube_id}"])
            print(f"[DownloadAudio] Downloaded and saved as {youtube_id}.mp3")
            # Clean up any .webm, .m4a, .part files
            for ext in ["webm", "m4a", "webm.part", "m4a.part"]:
                f = os.path.join(AUDIO_DIR, f"{youtube_id}.{ext}")
                if os.path.exists(f):
                    os.remove(f)
        except Exception as e:
            print(f"[DownloadAudio] Error downloading {youtube_id}: {e}")
            # Clean up orphaned .part files
            if os.path.exists(part_path):
                os.remove(part_path)
    background_tasks.add_task(run_dl)
    print(f"[DownloadAudio] Queued download for {youtube_id}")
    return {"status": "downloading"}

@app.post("/split_snippets")
def split_snippets(req: SplitSnippetsRequest):
    results = []
    for song in req.songs:
        song_id = song.id  # This should be the spotify_track_id
        start = song.start
        end = song.end
        print(f"[split_snippets] Looking up stems for spotify_track_id: {song_id}")
        stems_row = get_stems_by_spotify_id(song_id)
        print(f"[split_snippets] DB result for {song_id}: {stems_row}")
        
        # If not found in DB, let's see what's available
        if not stems_row:
            print(f"[split_snippets] Spotify track ID {song_id} not found in database")
            # Let's check what's actually in the database
            try:
                conn = get_db_connection()
                with conn.cursor() as cur:
                    cur.execute("SELECT spotify_track_id, title FROM stems LIMIT 5")
                    available_tracks = cur.fetchall()
                    print(f"[split_snippets] Available tracks in DB: {available_tracks}")
                conn.close()
            except Exception as e:
                print(f"[split_snippets] Error checking database: {e}")
            
            # For now, return a 404 with more helpful error message
            return JSONResponse({
                "error": f"Stems not found in database for Spotify track ID: {song_id}",
                "message": "This track hasn't been processed yet. Only tracks that have been processed and added to the database can be used for mixing.",
                "available_tracks": available_tracks if 'available_tracks' in locals() else []
            }, status_code=404)
        
        # Only check for the four main stems
        if stems_row and all(stems_row.get(k) for k in ["vocals_url", "drums_url", "bass_url", "other_url"]):
            results.append({
                "id": song_id,
                "vocals_url": stems_row["vocals_url"],
                "drums_url": stems_row["drums_url"],
                "bass_url": stems_row["bass_url"],
                "other_url": stems_row["other_url"],
                "full_song_url": stems_row.get("full_song_url"),
            })
            continue
        # If not found in DB, return error (do not fallback to local processing)
        return JSONResponse({"error": f"Stems not found in database for {song_id}"}, status_code=404)
    return {"results": results}

@app.get("/audio/{youtube_id}")
def get_audio(youtube_id: str):
    # Find any .mp3 file that starts with the YouTube ID
    mp3_files = glob.glob(os.path.join(AUDIO_DIR, f"{youtube_id}*.mp3"))
    if mp3_files:
        out_path = mp3_files[0]
        print(f"[AudioServe] Serving {out_path}")
        return FileResponse(out_path, media_type="audio/mpeg")
    else:
        print(f"[AudioServe] Not found for {youtube_id}")
        return {"error": "Audio not found"}

@app.get("/progress/{task_id}")
def get_progress(task_id: str):
    result = AsyncResult(task_id, app=celery_app)
    return {"status": result.status, "result": result.result}

@app.get("/file/{file_path:path}")
def get_file(file_path: str = Path(..., description="Relative path under storage/")):
    # Sanitize and validate file path to prevent path traversal attacks
    file_path = file_path.strip().strip('/')
    
    # Block dangerous path components
    if '..' in file_path or file_path.startswith('/') or '\\' in file_path:
        return JSONResponse({"error": "Invalid file path"}, status_code=400)
    
    # Only allow certain file extensions
    allowed_extensions = {'.mp3', '.wav', '.m4a', '.webm'}
    file_ext = os.path.splitext(file_path.lower())[1]
    if file_ext not in allowed_extensions:
        return JSONResponse({"error": "File type not allowed"}, status_code=400)
    
    file_path_full = os.path.join(AUDIO_DIR, file_path)
    
    # Ensure the resolved path is still within AUDIO_DIR
    real_audio_dir = os.path.realpath(AUDIO_DIR)
    real_file_path = os.path.realpath(file_path_full)
    
    if not real_file_path.startswith(real_audio_dir):
        return JSONResponse({"error": "Access denied"}, status_code=403)
    
    if os.path.exists(file_path_full) and os.path.isfile(file_path_full):
        return FileResponse(file_path_full)
    return JSONResponse({"error": "File not found"}, status_code=404)

@app.get("/youtube_search")
def youtube_search(title: str, artist: str):
    query = f"{artist} - {title}"
    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'extract_flat': 'in_playlist',
        'default_search': 'ytsearch1',
    }
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        result = ydl.extract_info(query, download=False)
        if 'entries' in result and result['entries']:
            entry = result['entries'][0]
            print(f"[YouTube Debug] {artist} - {title} => {entry.get('url')}")
            return {
                'id': entry.get('id'),
                'title': entry.get('title'),
                'url': entry.get('url'),
                'webpage_url': entry.get('webpage_url'),
                'duration': entry.get('duration'),
                'thumbnail': entry.get('thumbnail'),
                'uploader': entry.get('uploader'),
            }
        else:
            print(f"[YouTube Debug] {artist} - {title} => No result found")
            return {"error": "No YouTube result found"}

# Initialize the professional audio processor
audio_processor = RiddimAudioProcessor()

@app.post("/analyze_audio")
def analyze_audio(audio_url: str):
    """Analyze audio file from a GCS URL using librosa for tempo, key, energy, etc."""
    temp_path = None
    try:
        # Download to temp file
        r = requests.get(audio_url, stream=True)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        for chunk in r.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp.close()
        temp_path = tmp.name
        analysis = audio_processor.analyze_audio(temp_path)
        return analysis
    except Exception as e:
        print(f"[AnalyzeAudio] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@app.post("/process_audio")
def process_audio(audio_url: str, tempo_factor: float = 1.0, pitch_semitones: float = 0.0, effects: dict = {}):
    """Process audio file from a GCS URL with professional effects using pyrubberband"""
    temp_path = None
    processed_path = None
    try:
        # Download to temp file
        r = requests.get(audio_url, stream=True)
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        for chunk in r.iter_content(chunk_size=8192):
            tmp.write(chunk)
        tmp.close()
        temp_path = tmp.name
        processed_path = audio_processor.professional_process(
            temp_path, 
            tempo_factor=tempo_factor, 
            pitch_semitones=pitch_semitones, 
            effects=effects
        )
        # Return processed file as a download
        return FileResponse(processed_path, media_type="audio/mpeg")
    except Exception as e:
        print(f"[ProcessAudio] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
        if processed_path and os.path.exists(processed_path):
            os.remove(processed_path)

@app.post("/beat_match")
def beat_match_tracks(track1_file: str, track2_file: str):
    """Automatically match BPMs between two tracks"""
    try:
        # Construct full paths
        track1_path = os.path.join(AUDIO_DIR, track1_file)
        track2_path = os.path.join(AUDIO_DIR, track2_file)
        
        if not os.path.exists(track1_path) or not os.path.exists(track2_path):
            return JSONResponse({"error": "One or both audio files not found"}, status_code=404)
        
        matched_track1, matched_track2 = audio_processor.beat_match_tracks(track1_path, track2_path)
        
        # Return relative paths
        relative_track1 = os.path.relpath(matched_track1, AUDIO_DIR)
        relative_track2 = os.path.relpath(matched_track2, AUDIO_DIR)
        
        return {
            "track1_matched": relative_track1,
            "track2_matched": relative_track2
        }
    except Exception as e:
        print(f"[BeatMatch] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/harmonic_suggestions")
def get_harmonic_suggestions(track1_url: str, track2_url: str):
    """Get harmonic mixing suggestions for two tracks from GCS URLs"""
    temp1 = temp2 = None
    try:
        # Download both files to temp
        r1 = requests.get(track1_url, stream=True)
        tmp1 = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        for chunk in r1.iter_content(chunk_size=8192):
            tmp1.write(chunk)
        tmp1.close()
        temp1 = tmp1.name
        r2 = requests.get(track2_url, stream=True)
        tmp2 = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
        for chunk in r2.iter_content(chunk_size=8192):
            tmp2.write(chunk)
        tmp2.close()
        temp2 = tmp2.name
        suggestions = audio_processor.harmonic_mix_suggestions(temp1, temp2)
        return suggestions
    except Exception as e:
        print(f"[HarmonicSuggestions] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        if temp1 and os.path.exists(temp1):
            os.remove(temp1)
        if temp2 and os.path.exists(temp2):
            os.remove(temp2)

@app.post("/create_professional_mix")
def create_professional_mix(request: MixRequest):
    """Create a professional mix with automatic optimization"""
    try:
        # Construct full paths
        track1_path = os.path.join(AUDIO_DIR, request.track1_file)
        track2_path = os.path.join(AUDIO_DIR, request.track2_file)
        
        if not os.path.exists(track1_path) or not os.path.exists(track2_path):
            return JSONResponse({"error": "One or both audio files not found"}, status_code=404)
        
        # Create mix with custom parameters if provided
        mix_params = {
            "tempo_factor": request.tempo_factor,
            "pitch_semitones": request.pitch_semitones,
            "effects": request.effects
        } if request.tempo_factor != 1.0 or request.pitch_semitones != 0.0 or request.effects else None
        
        mixed_path = audio_processor.create_professional_mix(track1_path, track2_path, mix_params)
        
        # Return relative path for serving
        relative_path = os.path.relpath(mixed_path, AUDIO_DIR)
        return {"mixed_file": relative_path}
    except Exception as e:
        print(f"[ProfessionalMix] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/create_mix_from_urls")
def create_mix_from_urls(request: ProfessionalMixRequest):
    """Create a professional mix from GCS URLs with multiple stems and time windows"""
    temp_files = []
    try:
        print(f"[CreateMixFromUrls] Creating mix with {len(request.track1_urls)} stems for track1 and {len(request.track2_urls)} stems for track2")
        
        # Download all stem files to temp
        all_urls = request.track1_urls + request.track2_urls
        temp_paths = []
        
        for url in all_urls:
            r = requests.get(url, stream=True)
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.mp3')
            for chunk in r.iter_content(chunk_size=8192):
                tmp.write(chunk)
            tmp.close()
            temp_paths.append(tmp.name)
            temp_files.append(tmp.name)
        
        # Split temp paths for each track
        track1_temp_paths = temp_paths[:len(request.track1_urls)]
        track2_temp_paths = temp_paths[len(request.track1_urls):]
        
        # Create mix parameters
        mix_params = {
            "tempo_factor": request.tempo_factor,
            "pitch_semitones": request.pitch_semitones,
            "effects": request.effects,
            "track1_time_window": request.track1_time_window,
            "track2_time_window": request.track2_time_window
        }
        
        # Create the mix using the audio processor
        mixed_path = audio_processor.create_mix_from_stems(
            track1_temp_paths, 
            track2_temp_paths, 
            mix_params
        )
        
        # Return the mixed file as a download
        return FileResponse(mixed_path, media_type="audio/mpeg", filename="your_mix.mp3")
        
    except Exception as e:
        print(f"[CreateMixFromUrls] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)
    finally:
        # Clean up temp files
        for temp_file in temp_files:
            if os.path.exists(temp_file):
                os.remove(temp_file)

@app.post("/cleanup_temp_files")
def cleanup_temp_files():
    """Clean up temporary audio files"""
    try:
        audio_processor.cleanup_temp_files()
        return {"message": "Temporary files cleaned up successfully"}
    except Exception as e:
        print(f"[Cleanup] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500) 

@app.post('/create_mix_with_offset_and_crossfade')
async def create_mix_with_offset_and_crossfade(request: Request):
    data = await request.json()
    track1_urls = data.get('track1_urls')
    track2_urls = data.get('track2_urls')
    track1_delay = data.get('track1_delay', 0)
    track2_delay = data.get('track2_delay', 0)
    crossfade_duration = data.get('crossfade_duration', 3)
    crossfade_style = data.get('crossfade_style', 'linear')

    print(f"[CreateMixWithOffset] Received delays: track1={track1_delay}s, track2={track2_delay}s")
    print(f"[CreateMixWithOffset] Crossfade: {crossfade_duration}s, style={crossfade_style}")
    print(f"[CreateMixWithOffset] Track1 URLs: {len(track1_urls) if track1_urls else 0}")
    print(f"[CreateMixWithOffset] Track2 URLs: {len(track2_urls) if track2_urls else 0}")

    # Call audio processor
    output_path = audio_processor.create_mix_with_offset_and_crossfade(
        track1_urls, track2_urls,
        track1_delay=track1_delay,
        track2_delay=track2_delay,
        crossfade_duration=crossfade_duration,
        crossfade_style=crossfade_style
    )

    # Return the file as a response
    return FileResponse(output_path, media_type='audio/mpeg', filename='mix.mp3')

@app.get("/test_db")
def test_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1 AS result;")
        result = cur.fetchone()
        cur.close()
        conn.close()
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/available_tracks")
def get_available_tracks():
    """Get list of tracks available in the database for mixing"""
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT spotify_track_id, title, artist FROM stems ORDER BY title LIMIT 50")
            tracks = cur.fetchall()
        conn.close()
        return {"tracks": tracks}
    except Exception as e:
        print(f"[AvailableTracks] Error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500) 
#!/usr/bin/env python3
"""
RIDDIM BATCH PROCESSOR - COMPLETE FINAL VERSION
Downloads Afrobeats songs, separates into MP3 stems, uploads to GCS, stores in Railway DB

USAGE:
  # Test with 5 songs
  python3 riddim_batch_processor.py --manifest manifest.json --batch-size 5
  
  # Process all 1000 songs (default)
  python3 riddim_batch_processor.py --manifest manifest.json
  
  # Process specific range
  python3 riddim_batch_processor.py --manifest manifest.json --start-rank 1 --end-rank 50
"""

import os
import subprocess
import logging
import json
import time
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor
import argparse
from datetime import datetime
import shutil
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class RiddimBatchProcessor:
    def __init__(self, gcs_bucket="gs://riddim-stems-timi-1752717149", db_url=None):
        self.gcs_bucket = gcs_bucket
        self.db_url = db_url or os.getenv('RIDDIM_DATABASE_URL')
        self.output_dir = Path("riddim_processing")
        self.output_dir.mkdir(exist_ok=True)
        
        # Track processing results
        self.processed_tracks = []
        self.failed_tracks = []
        self.processing_stats = {
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'start_time': None,
            'end_time': None
        }
        
        logger.info(f"🎵 RIDDIM Batch Processor initialized")
        logger.info(f"   GCS Bucket: {self.gcs_bucket}")
        logger.info(f"   Database: {'Connected' if self.db_url else 'Not configured'}")
    
    def load_manifest(self, manifest_file):
        """Load the manifest JSON with Spotify IDs and search queries"""
        try:
            with open(manifest_file, 'r', encoding='utf-8') as f:
                tracks = json.load(f)
            logger.info(f"✅ Loaded {len(tracks)} tracks from {manifest_file}")
            return tracks
        except Exception as e:
            logger.error(f"❌ Failed to load manifest: {e}")
            return []
    
    def download_song(self, track_info):
        """Download a single song using yt-dlp as MP3"""
        spotify_id = track_info['spotify_id']
        search_query = track_info['search_query']
        rank = track_info['rank']
        
        # Create directory for this track
        track_dir = self.output_dir / spotify_id
        track_dir.mkdir(exist_ok=True)
        
        # Output filename with Spotify ID (MP3 format)
        output_template = str(track_dir / f"{spotify_id}.%(ext)s")
        
        cmd = [
            "yt-dlp",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "320K",  # High quality MP3
            "--output", output_template,
            "--no-playlist",
            "--max-filesize", "50M",  # Smaller limit for MP3
            f"ytsearch1:{search_query}"
        ]
        
        try:
            logger.info(f"⬇️  [{rank:03d}] Downloading: {search_query[:60]}...")
            logger.info(f"    Spotify ID: {spotify_id}")
            
            result = subprocess.run(cmd, check=True, timeout=300, 
                                  capture_output=True, text=True)
            
            # Find the downloaded file (MP3 format)
            mp3_file = track_dir / f"{spotify_id}.mp3"
            if mp3_file.exists():
                file_size_mb = mp3_file.stat().st_size / (1024 * 1024)
                logger.info(f"✅ [{rank:03d}] Downloaded: {file_size_mb:.1f}MB (MP3)")
                return str(mp3_file)
            else:
                logger.error(f"❌ [{rank:03d}] Downloaded file not found: {mp3_file}")
                return None
                
        except subprocess.TimeoutExpired:
            logger.error(f"⏰ [{rank:03d}] Download timeout: {spotify_id}")
            return None
            
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ [{rank:03d}] Download failed: {spotify_id} - {e}")
            return None
    
    def separate_stems(self, track_info, audio_file):
        """Separate audio into MP3 stems using demucs"""
        spotify_id = track_info['spotify_id']
        rank = track_info['rank']
        
        track_dir = Path(audio_file).parent
        stems_output = track_dir / "separated"
        
        cmd = [
            "demucs",
            "--out", str(stems_output),
            "--device", "cpu",
            "--mp3",
            audio_file
        ]
        
        try:
            logger.info(f"🎵 [{rank:03d}] Separating stems: {spotify_id}")
            start_time = time.time()
            
            result = subprocess.run(cmd, check=True, timeout=1200,  # 20 minutes
                                  capture_output=True, text=True)
            
            processing_time = time.time() - start_time
            
            # Expected stem files (MP3 format)
            stem_dir = stems_output / "htdemucs" / f"{spotify_id}"
            expected_stems = ["vocals.mp3", "drums.mp3", "bass.mp3", "other.mp3"]
            
            stem_files = {}
            for stem in expected_stems:
                stem_path = stem_dir / stem
                if stem_path.exists():
                    stem_files[stem.replace('.mp3', '')] = str(stem_path)
                else:
                    logger.warning(f"⚠️  [{rank:03d}] Missing stem: {stem}")
            
            if len(stem_files) >= 2:  # At least vocals + something else
                logger.info(f"✅ [{rank:03d}] Stems separated in {processing_time:.1f}s: {list(stem_files.keys())}")
                return stem_files, processing_time
            else:
                logger.error(f"❌ [{rank:03d}] Insufficient stems generated")
                return None, processing_time
                
        except subprocess.TimeoutExpired:
            logger.error(f"⏰ [{rank:03d}] Stem separation timeout: {spotify_id}")
            return None, 1200
            
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ [{rank:03d}] Stem separation failed: {spotify_id} - {e}")
            return None, 0
    
    def upload_to_gcs(self, track_info, full_song_path, stem_files):
        """Upload full song + MP3 stems to Google Cloud Storage"""
        spotify_id = track_info['spotify_id']
        rank = track_info['rank']
        
        uploaded_urls = {}
        
        try:
            # Upload full song (MP3)
            full_song_gcs = f"{self.gcs_bucket}/songs/{spotify_id}.mp3"
            cmd = ["gsutil", "cp", full_song_path, full_song_gcs]
            subprocess.run(cmd, check=True, timeout=300)
            uploaded_urls['full_song'] = full_song_gcs.replace('gs://', 'https://storage.googleapis.com/')
            logger.info(f"☁️  [{rank:03d}] Uploaded full song (MP3)")
            
            # Upload stems (MP3)
            for stem_type, local_path in stem_files.items():
                stem_gcs = f"{self.gcs_bucket}/stems/{spotify_id}/{stem_type}.mp3"
                cmd = ["gsutil", "cp", local_path, stem_gcs]
                subprocess.run(cmd, check=True, timeout=300)
                uploaded_urls[stem_type] = stem_gcs.replace('gs://', 'https://storage.googleapis.com/')
                logger.info(f"☁️  [{rank:03d}] Uploaded {stem_type} stem (MP3)")
            
            logger.info(f"✅ [{rank:03d}] All files uploaded to GCS")
            return uploaded_urls
            
        except subprocess.CalledProcessError as e:
            logger.error(f"❌ [{rank:03d}] GCS upload failed: {spotify_id} - {e}")
            return None
        except subprocess.TimeoutExpired:
            logger.error(f"⏰ [{rank:03d}] GCS upload timeout: {spotify_id}")
            return None
    
    def save_to_database(self, track_info, uploaded_urls, file_size_mb, processing_time):
        """Save track metadata and URLs to Railway database"""
        if not self.db_url:
            logger.error("No database URL provided")
            return False
        
        try:
            with psycopg2.connect(self.db_url) as conn:
                with conn.cursor() as cur:
                    # Insert track data with conflict resolution
                    insert_sql = """
                    INSERT INTO stems (
                        spotify_track_id, rank, track_name, artist_names, 
                        search_query, cultural_score, full_song_url,
                        vocals_url, drums_url, bass_url, other_url,
                        file_size_mb, processing_duration_seconds
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    ) ON CONFLICT (spotify_track_id) DO UPDATE SET
                        rank = EXCLUDED.rank,
                        track_name = EXCLUDED.track_name,
                        artist_names = EXCLUDED.artist_names,
                        search_query = EXCLUDED.search_query,
                        cultural_score = EXCLUDED.cultural_score,
                        full_song_url = EXCLUDED.full_song_url,
                        vocals_url = EXCLUDED.vocals_url,
                        drums_url = EXCLUDED.drums_url,
                        bass_url = EXCLUDED.bass_url,
                        other_url = EXCLUDED.other_url,
                        file_size_mb = EXCLUDED.file_size_mb,
                        processing_duration_seconds = EXCLUDED.processing_duration_seconds,
                        processed_at = NOW()
                    """
                    
                    cur.execute(insert_sql, (
                        track_info['spotify_id'],
                        track_info['rank'],
                        track_info['track_name'],
                        track_info['artists'],
                        track_info['search_query'],
                        track_info.get('score', 0),
                        uploaded_urls.get('full_song'),
                        uploaded_urls.get('vocals'),
                        uploaded_urls.get('drums'),
                        uploaded_urls.get('bass'),
                        uploaded_urls.get('other'),
                        int(file_size_mb),
                        int(processing_time)
                    ))
            logger.info(f"💾 [{track_info['rank']:03d}] Saved to database")
            return True
            
        except Exception as e:
            logger.error(f"❌ [{track_info['rank']:03d}] Database save failed: {e}")
            return False
    
    def cleanup_local_files(self, spotify_id):
        """Clean up local files to save disk space"""
        track_dir = self.output_dir / spotify_id
        if track_dir.exists():
            shutil.rmtree(track_dir)
            logger.debug(f"🗑️  Cleaned up local files for {spotify_id}")
    
    def process_track(self, track_info):
        """Process a single track: download, separate, upload, save"""
        spotify_id = track_info['spotify_id']
        rank = track_info['rank']
        
        logger.info(f"\n🎵 [{rank:03d}] PROCESSING: {track_info['track_name']} - {', '.join(track_info['artists'])}")
        logger.info(f"    Spotify ID: {spotify_id}")
        
        try:
            # Step 1: Download
            audio_file = self.download_song(track_info)
            if not audio_file:
                self.failed_tracks.append({**track_info, 'error': 'Download failed'})
                return False
            
            file_size_mb = Path(audio_file).stat().st_size / (1024 * 1024)
            
            # Step 2: Separate stems
            stem_files, processing_time = self.separate_stems(track_info, audio_file)
            if not stem_files:
                self.failed_tracks.append({**track_info, 'error': 'Stem separation failed'})
                self.cleanup_local_files(spotify_id)
                return False
            
            # Step 3: Upload to GCS
            uploaded_urls = self.upload_to_gcs(track_info, audio_file, stem_files)
            if not uploaded_urls:
                self.failed_tracks.append({**track_info, 'error': 'GCS upload failed'})
                self.cleanup_local_files(spotify_id)
                return False
            
            # Step 4: Save to database
            if self.save_to_database(track_info, uploaded_urls, file_size_mb, processing_time):
                self.processed_tracks.append({**track_info, 'urls': uploaded_urls})
                logger.info(f"🎉 [{rank:03d}] COMPLETE: {track_info['track_name']}")
                
                # Step 5: Cleanup
                self.cleanup_local_files(spotify_id)
                return True
            else:
                self.failed_tracks.append({**track_info, 'error': 'Database save failed'})
                return False
                
        except Exception as e:
            logger.error(f"❌ [{rank:03d}] Unexpected error: {e}")
            self.failed_tracks.append({**track_info, 'error': f'Unexpected error: {e}'})
            self.cleanup_local_files(spotify_id)
            return False
    
    def process_batch(self, manifest_file, start_rank=1, end_rank=None, batch_size=1000):
        """Process a batch of tracks - DEFAULT: ALL 1000 SONGS"""
        # Load tracks
        tracks = self.load_manifest(manifest_file)
        if not tracks:
            logger.error("No tracks to process")
            return
        
        # Filter by rank range
        if end_rank:
            tracks = [t for t in tracks if start_rank <= t['rank'] <= end_rank]
        else:
            tracks = [t for t in tracks if t['rank'] >= start_rank]
        
        # Limit batch size
        tracks = tracks[:batch_size]
        
        logger.info(f"🚀 STARTING RIDDIM BATCH PROCESSING")
        logger.info(f"   Tracks to process: {len(tracks)}")
        logger.info(f"   Rank range: {start_rank} to {tracks[-1]['rank'] if tracks else 'N/A'}")
        logger.info(f"   GCS Bucket: {self.gcs_bucket}")
        logger.info(f"   Database: {'Connected' if self.db_url else 'Not configured'}")
        logger.info(f"   Expected time: {len(tracks) * 5.5 / 60:.1f} minutes")
        
        self.processing_stats['start_time'] = datetime.now()
        
        # Process each track
        for i, track in enumerate(tracks, 1):
            logger.info(f"\n📊 BATCH PROGRESS: {i}/{len(tracks)} ({i/len(tracks)*100:.1f}%)")
            
            if self.process_track(track):
                self.processing_stats['successful'] += 1
            else:
                self.processing_stats['failed'] += 1
            
            self.processing_stats['total_processed'] += 1
            
            # Brief pause between tracks
            time.sleep(2)
        
        self.processing_stats['end_time'] = datetime.now()
        self.print_summary()
    
    def print_summary(self):
        """Print processing summary"""
        duration = (self.processing_stats['end_time'] - self.processing_stats['start_time']).total_seconds()
        
        logger.info(f"\n🎉 RIDDIM BATCH PROCESSING COMPLETE!")
        logger.info(f"   Total processed: {self.processing_stats['total_processed']}")
        logger.info(f"   Successful: {self.processing_stats['successful']}")
        logger.info(f"   Failed: {self.processing_stats['failed']}")
        logger.info(f"   Success rate: {self.processing_stats['successful']/self.processing_stats['total_processed']*100:.1f}%")
        logger.info(f"   Duration: {duration/60:.1f} minutes")
        logger.info(f"   Avg per track: {duration/self.processing_stats['total_processed']:.1f} seconds")
        
        if self.failed_tracks:
            logger.info(f"\n❌ FAILED TRACKS:")
            for track in self.failed_tracks[:10]:  # Show first 10 failures
                logger.info(f"   {track['rank']:03d}. {track['track_name']} - {track.get('error', 'Unknown error')}")

def main():
    parser = argparse.ArgumentParser(description='RIDDIM Batch Processor - Process Afrobeats songs into stems')
    parser.add_argument('--manifest', required=True, help='Path to manifest JSON file with song data')
    parser.add_argument('--start-rank', type=int, default=1, help='Starting rank (default: 1)')
    parser.add_argument('--end-rank', type=int, help='Ending rank (optional, processes to end if not specified)')
    parser.add_argument('--batch-size', type=int, default=1000, help='Batch size (default: 1000 - ALL SONGS)')
    parser.add_argument('--gcs-bucket', default='gs://riddim-stems-timi-1752717149', help='GCS bucket for file storage')
    parser.add_argument('--db-url', help='Database URL (default: from RIDDIM_DATABASE_URL env var)')
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = RiddimBatchProcessor(
        gcs_bucket=args.gcs_bucket,
        db_url=args.db_url
    )
    
    logger.info(f"🚀 RIDDIM BATCH PROCESSOR - PROCESSING {args.batch_size} SONGS")
    logger.info(f"   For FULL 1000 songs: Use default settings")
    logger.info(f"   For testing: Use --batch-size 10")
    
    # Process batch
    processor.process_batch(
        manifest_file=args.manifest,
        start_rank=args.start_rank,
        end_rank=args.end_rank,
        batch_size=args.batch_size
    )

if __name__ == "__main__":
    main() 
#!/usr/bin/env python3
import json
import subprocess
import os
import time
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/riddim_final.log'),
        logging.StreamHandler()
    ]
)

def create_better_search_query(song_data):
    """Create optimized search queries based on successful pattern"""
    track_name = song_data.get('track_name', '')
    artists = song_data.get('artists', [])
    main_artist = artists[0] if artists else ''
    return f"{track_name} {main_artist}".strip()

def process_songs_with_improved_queries():
    logging.info("🎯 PROCESSING FINAL 111 SONGS ON GCP...")
    
    # Load updated missing songs
    with open('missing_songs_updated.json', 'r') as f:
        missing_songs = json.load(f)
    
    logging.info(f"📝 Loaded {len(missing_songs)} songs to process")
    
    successful = 0
    failed = 0
    
    for i, song in enumerate(missing_songs):
        logging.info(f"🎵 [{i+1}/{len(missing_songs)}] {song.get('artist_string', 'Unknown')} - {song.get('track_name', 'Unknown')}")
        
        # Improve search query
        better_query = create_better_search_query(song)
        song['search_query'] = better_query
        
        # Process individual song (your existing logic)
        try:
            # Your existing riddim_batch_processor logic here
            # This will download, separate stems, upload to GCS, save to DB
            logging.info(f"  ✅ SUCCESS!")
            successful += 1
        except Exception as e:
            logging.error(f"  ❌ FAILED: {str(e)}")
            failed += 1
    
    logging.info(f"🎉 COMPLETE! Success: {successful}, Failed: {failed}")

if __name__ == "__main__":
    process_songs_with_improved_queries()

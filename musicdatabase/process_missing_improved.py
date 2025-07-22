#!/usr/bin/env python3
import json
import subprocess
import os
import time

def create_better_search_query(song_data):
    """Create optimized search queries"""
    track_name = song_data.get('track_name', '')
    artists = song_data.get('artists', [])
    
    # Get main artist (first in list)
    main_artist = artists[0] if artists else ''
    
    # Strategy 1: Track name + main artist (this worked!)
    query1 = f"{track_name} {main_artist}".strip()
    
    # Strategy 2: Main artist + track name
    query2 = f"{main_artist} {track_name}".strip()
    
    # Strategy 3: Just track name
    query3 = track_name.strip()
    
    return [query1, query2, query3]

def process_missing_songs():
    print("🎯 PROCESSING 112 MISSING RIDDIM SONGS (IMPROVED)...")
    
    # Load missing songs
    with open('missing_songs_fixed.json', 'r') as f:
        missing_songs = json.load(f)
    
    print(f"📝 Loaded {len(missing_songs)} missing songs")
    
    # Set environment variable
    os.environ['RIDDIM_DATABASE_URL'] = 'postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway'
    
    # Process each song individually with better search queries
    successful = 0
    failed = 0
    
    for i, song in enumerate(missing_songs):
        print(f"\n🎵 [{i+1}/{len(missing_songs)}] {song['artist_string']} - {song['track_name']}")
        
        # Create temporary manifest with corrected search query
        queries = create_better_search_query(song)
        
        # Try each query until one works
        song_processed = False
        for j, query in enumerate(queries):
            if song_processed:
                break
                
            print(f"  🔍 Query {j+1}: '{query}'")
            
            # Update song with better search query
            improved_song = song.copy()
            improved_song['search_query'] = query
            
            temp_manifest = f"temp_song_{song['spotify_id']}.json"
            with open(temp_manifest, 'w') as f:
                json.dump([improved_song], f, indent=2)
            
            try:
                cmd = [
                    'python3', 'riddim_batch_processor.py',
                    '--manifest', temp_manifest,
                    '--batch-size', '1'
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
                
                if result.returncode == 0:
                    print(f"  ✅ SUCCESS with query {j+1}!")
                    successful += 1
                    song_processed = True
                else:
                    print(f"  ❌ Failed query {j+1}: {result.stderr[:100]}...")
                    
            except Exception as e:
                print(f"  💥 Error with query {j+1}: {str(e)}")
            
            # Cleanup
            if os.path.exists(temp_manifest):
                os.remove(temp_manifest)
        
        if not song_processed:
            print(f"  ❌ ALL QUERIES FAILED for this song")
            failed += 1
        
        # Small delay between songs
        time.sleep(2)
    
    print(f"\n🎉 PROCESSING COMPLETE!")
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")

if __name__ == "__main__":
    process_missing_songs()

#!/usr/bin/env python3
import json
import subprocess
import os
import time

def create_better_search_query(song_data):
    """Create optimized search queries based on successful pattern"""
    track_name = song_data.get('track_name', '')
    artists = song_data.get('artists', [])
    
    # Get main artist (first in list)
    main_artist = artists[0] if artists else ''
    
    # Use the EXACT pattern that worked: "Track Name Main Artist"
    return f"{track_name} {main_artist}".strip()

def process_missing_songs():
    print("🎯 PROCESSING ALL 112 MISSING RIDDIM SONGS...")
    
    # Load missing songs
    with open('missing_songs_fixed.json', 'r') as f:
        missing_songs = json.load(f)
    
    print(f"📝 Loaded {len(missing_songs)} missing songs")
    print(f"⏱️  Estimated time: {len(missing_songs) * 5.2} minutes ({len(missing_songs) * 5.2 / 60:.1f} hours)")
    
    # Set environment variable
    os.environ['RIDDIM_DATABASE_URL'] = 'postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway'
    
    successful = 0
    failed = 0
    
    for i, song in enumerate(missing_songs):
        print(f"\n🎵 [{i+1}/{len(missing_songs)}] {song['artist_string']} - {song['track_name']}")
        
        # Create improved search query
        better_query = create_better_search_query(song)
        print(f"  🔍 Query: '{better_query}'")
        
        # Update song with better search query
        improved_song = song.copy()
        improved_song['search_query'] = better_query
        
        temp_manifest = f"temp_song_{i+1}.json"
        with open(temp_manifest, 'w') as f:
            json.dump([improved_song], f, indent=2)
        
        try:
            cmd = [
                'python3', 'riddim_batch_processor.py',
                '--manifest', temp_manifest,
                '--batch-size', '1'
            ]
            
            # 10-minute timeout per song (double the successful time)
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
            
            if result.returncode == 0:
                print(f"  ✅ SUCCESS! ({successful + 1}/{len(missing_songs)})")
                successful += 1
            else:
                print(f"  ❌ FAILED: {result.stderr[:100]}...")
                failed += 1
                
        except subprocess.TimeoutExpired:
            print(f"  ⏱️ TIMEOUT (>10 minutes)")
            failed += 1
        except Exception as e:
            print(f"  💥 ERROR: {str(e)}")
            failed += 1
        
        # Cleanup
        if os.path.exists(temp_manifest):
            os.remove(temp_manifest)
        
        # Progress update
        remaining = len(missing_songs) - (i + 1)
        eta_minutes = remaining * 5.2
        print(f"  📊 Progress: {((i+1)/len(missing_songs)*100):.1f}% | ETA: {eta_minutes:.0f} minutes")
    
    print(f"\n🎉 PROCESSING COMPLETE!")
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"🎯 Your RIDDIM database now has {888 + successful} songs!")

if __name__ == "__main__":
    process_missing_songs()

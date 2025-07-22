#!/usr/bin/env python3
import json
import subprocess

def get_processed_songs_from_db():
    """Get list of already processed songs from database"""
    try:
        cmd = [
            'psql', 
            'postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway',
            '-t', '-c', 
            'SELECT DISTINCT spotify_track_id FROM stems;'
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        
        # Parse the result
        processed_ids = set()
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                processed_ids.add(line.strip())
        
        return processed_ids
    except Exception as e:
        print(f"❌ Error getting processed songs: {e}")
        return set()

def main():
    print("🔍 REFRESHING MISSING SONGS LIST...")
    
    # Get currently processed songs from database
    processed_songs = get_processed_songs_from_db()
    print(f"📊 Songs already in database: {len(processed_songs)}")
    
    # Load original missing songs
    with open('missing_songs_fixed.json', 'r') as f:
        missing_songs = json.load(f)
    
    print(f"📝 Original missing songs: {len(missing_songs)}")
    
    # Filter out already processed songs
    still_missing = []
    for song in missing_songs:
        if song['spotify_id'] not in processed_songs:
            still_missing.append(song)
        else:
            print(f"✅ Already processed: {song['artist_string']} - {song['track_name']}")
    
    print(f"🎯 Songs still needed: {len(still_missing)}")
    
    # Save updated missing list
    with open('missing_songs_updated.json', 'w') as f:
        json.dump(still_missing, f, indent=2)
    
    print(f"💾 Updated missing songs saved to: missing_songs_updated.json")
    print(f"🚀 Ready to process {len(still_missing)} remaining songs!")

if __name__ == "__main__":
    main()

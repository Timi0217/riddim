#!/usr/bin/env python3
import json
import subprocess
import sys

def get_gcs_song_list():
    """Get list of songs already processed in GCS"""
    try:
        result = subprocess.run([
            'gsutil', 'ls', 'gs://riddim-stems-timi-1752717149/songs/'
        ], capture_output=True, text=True, check=True)
        
        # Extract song IDs from GCS paths
        processed_ids = []
        for line in result.stdout.strip().split('\n'):
            if line.strip():
                song_id = line.split('/')[-1].replace('.mp3', '')
                processed_ids.append(song_id)
        
        return set(processed_ids)
    except subprocess.CalledProcessError:
        return set()

def get_manifest_songs():
    """Get all songs from manifest"""
    try:
        with open('afrobeats_intelligence_20250717_103640_manifest.json', 'r') as f:
            manifest = json.load(f)
        return {song['spotify_id']: song for song in manifest}
    except FileNotFoundError:
        print("❌ Manifest file not found!")
        return {}

def main():
    print("🔍 ANALYZING RIDDIM PROCESSING STATUS...")
    
    processed_songs = get_gcs_song_list()
    all_songs = get_manifest_songs()
    
    print(f"📊 Total songs in manifest: {len(all_songs)}")
    print(f"✅ Songs successfully processed: {len(processed_songs)}")
    print(f"❌ Songs still needed: {len(all_songs) - len(processed_songs)}")
    
    # Find missing songs
    missing_songs = []
    for song_id, song_data in all_songs.items():
        if song_id not in processed_songs:
            missing_songs.append({
                'spotify_id': song_id,
                'rank': song_data.get('rank', 'unknown'),
                'title': song_data.get('name', 'Unknown'),
                'artist': song_data.get('artist', 'Unknown')
            })
    
    # Sort by rank
    missing_songs.sort(key=lambda x: x['rank'] if isinstance(x['rank'], int) else 9999)
    
    print(f"\n🎵 MISSING SONGS ({len(missing_songs)}):")
    for song in missing_songs[:20]:  # Show first 20
        print(f"  Rank {song['rank']}: {song['artist']} - {song['title']} ({song['spotify_id']})")
    
    if len(missing_songs) > 20:
        print(f"  ... and {len(missing_songs) - 20} more")
    
    # Save missing songs for batch processing
    with open('missing_songs.json', 'w') as f:
        json.dump(missing_songs, f, indent=2)
    
    print(f"\n💾 Missing songs saved to: missing_songs.json")
    print(f"🚀 Ready to process {len(missing_songs)} remaining songs!")

if __name__ == "__main__":
    main()

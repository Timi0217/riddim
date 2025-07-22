#!/usr/bin/env python3
import json
import subprocess
import os
import time

def process_missing_songs():
    print("🎯 PROCESSING 112 MISSING RIDDIM SONGS...")
    
    # Load missing songs
    with open('missing_songs_fixed.json', 'r') as f:
        missing_songs = json.load(f)
    
    print(f"📝 Loaded {len(missing_songs)} missing songs")
    
    # Process in batches of 5 to avoid rate limits
    batch_size = 5
    successful = 0
    failed = 0
    
    for i in range(0, len(missing_songs), batch_size):
        batch = missing_songs[i:i+batch_size]
        batch_num = (i // batch_size) + 1
        total_batches = (len(missing_songs) + batch_size - 1) // batch_size
        
        print(f"\n🚀 Processing batch {batch_num}/{total_batches}...")
        
        for song in batch:
            print(f"  🎵 {song['artist_string']} - {song['track_name']}")
        
        # Create temporary manifest for this batch
        batch_manifest = f"temp_batch_{batch_num}.json"
        with open(batch_manifest, 'w') as f:
            json.dump(batch, f, indent=2)
        
        try:
            # Set environment variable
            env = os.environ.copy()
            env['RIDDIM_DATABASE_URL'] = 'postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway'
            
            # Process batch
            cmd = [
                'python3', 'riddim_batch_processor.py',
                '--manifest', batch_manifest,
                '--batch-size', str(len(batch))
            ]
            
            print(f"    ⚡ Running: {' '.join(cmd)}")
            result = subprocess.run(cmd, env=env, capture_output=True, text=True, timeout=1800)
            
            if result.returncode == 0:
                print(f"    ✅ Batch {batch_num} completed!")
                successful += len(batch)
            else:
                print(f"    ❌ Batch {batch_num} failed:")
                print(f"       stdout: {result.stdout}")
                print(f"       stderr: {result.stderr}")
                failed += len(batch)
                
        except subprocess.TimeoutExpired:
            print(f"    ⏱️ Batch {batch_num} timed out (30 min)")
            failed += len(batch)
        except Exception as e:
            print(f"    💥 Batch {batch_num} error: {str(e)}")
            failed += len(batch)
        
        # Cleanup
        if os.path.exists(batch_manifest):
            os.remove(batch_manifest)
        
        # Wait between batches to avoid rate limits
        if batch_num < total_batches:
            print(f"    😴 Waiting 30 seconds before next batch...")
            time.sleep(30)
    
    print(f"\n🎉 PROCESSING COMPLETE!")
    print(f"✅ Successful: {successful}")
    print(f"❌ Failed: {failed}")
    print(f"🎯 Database should now have stems for successful songs!")

if __name__ == "__main__":
    process_missing_songs()

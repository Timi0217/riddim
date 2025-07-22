#!/usr/bin/env python3
import json
import subprocess
import os

# Set environment variable
os.environ['RIDDIM_DATABASE_URL'] = 'postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway'

# Create test manifest for Rahman Jago with better search query
test_song = [{
    "spotify_id": "6oOQSvqz8JL9hUTdXQiNEo",
    "rank": 5,
    "track_name": "Rahman Jago",
    "artists": ["DJ Boat", "Alorman"],
    "search_query": "Rahman Jago DJ Boat"  # This worked!
}]

with open('test_rahman_debug.json', 'w') as f:
    json.dump(test_song, f, indent=2)

print("🎵 Processing Rahman Jago with 20-minute timeout...")

try:
    cmd = [
        'python3', 'riddim_batch_processor.py',
        '--manifest', 'test_rahman_debug.json',
        '--batch-size', '1'
    ]
    
    # Much longer timeout (20 minutes)
    result = subprocess.run(cmd, capture_output=False, text=True, timeout=1200)
    
    if result.returncode == 0:
        print("✅ SUCCESS!")
    else:
        print(f"❌ Failed with return code: {result.returncode}")
        
except subprocess.TimeoutExpired:
    print("⏱️ Still timed out after 20 minutes - something is wrong")
except Exception as e:
    print(f"💥 Error: {str(e)}")

print("🔍 Checking database for new stems...")

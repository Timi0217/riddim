#!/bin/bash
echo "🚀 Starting RIDDIM processor: riddim-processor-19"
echo "📊 Processing ranks 901-950"

# Update system
apt-get update -y
apt-get install -y python3 python3-pip git ffmpeg postgresql-client

# Install Python packages
pip3 install psycopg2-binary google-cloud-storage
pip3 install "numpy<2"  # Fix NumPy compatibility
pip3 install yt-dlp demucs

# Setup working directory
mkdir -p /home/riddim
cd /home/riddim

# Download processing files from GCS
gsutil cp gs://riddim-stems-timi-1752717149/riddim_batch_processor.py ./
gsutil cp gs://riddim-stems-timi-1752717149/afrobeats_intelligence_20250717_103640_manifest.json ./

# Set environment variables
export RIDDIM_DATABASE_URL="postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway"

# Start processing specific range
echo "🎵 Processing ranks 901 to 950"
python3 riddim_batch_processor.py     --manifest afrobeats_intelligence_20250717_103640_manifest.json     --start-rank 901     --end-rank 950     --batch-size 50     > /var/log/riddim_processor.log 2>&1

# Log completion
echo "✅ COMPLETE: Processed ranks 901-950" >> /var/log/riddim_processor.log
echo "done-901-950" > /tmp/riddim_complete

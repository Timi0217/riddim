#!/bin/bash
# RIDDIM GCP Instance Setup

# Update system
apt-get update -y
apt-get install -y python3 python3-pip git ffmpeg curl

# Install NVIDIA drivers
/opt/deeplearning/install-driver.sh

# Install Python packages
pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip3 install demucs
pip3 install yt-dlp
pip3 install google-cloud-storage

# Create working directory
mkdir -p /home/riddim
cd /home/riddim

# Download processor script
gsutil cp gs://riddim-stems-timi-1752717149/riddim_processor.py ./

# Make executable
chmod +x riddim_processor.py

# Start processing
python3 riddim_processor.py > /var/log/riddim.log 2>&1

# Mark completion
echo "done" > /tmp/riddim_complete

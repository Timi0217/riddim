#!/bin/bash
# Deploy 12 GCP instances for parallel Riddim processing
# Each instance processes ~83-84 songs (1000 total)

set -e

# Configuration
PROJECT_ID="amiable-port-466223-u2"
MACHINE_TYPE="e2-standard-2"
IMAGE_FAMILY="ubuntu-2204-lts"
IMAGE_PROJECT="ubuntu-os-cloud"
GCS_BUCKET="gs://riddim-stems-timi-1752717149"
DATABASE_URL="postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway"

# List of regions and a default zone per region
REGIONS=("us-central1" "us-east1" "us-west1" "us-west2")
ZONES=("us-central1-a" "us-east1-b" "us-west1-b" "us-west2-a")
TOTAL_INSTANCES=12
TOTAL_SONGS=1000

# Calculate songs per instance (distribute remainder to first few)
SONGS_PER_INSTANCE=$((TOTAL_SONGS / TOTAL_INSTANCES))
REMAINDER=$((TOTAL_SONGS % TOTAL_INSTANCES))

# Create startup script template
create_startup_script() {
    local start_rank=$1
    local end_rank=$2
    local instance_name=$3
    
    cat > startup-script-${instance_name}.sh << EOF
#!/bin/bash
echo "🚀 Starting RIDDIM processor: ${instance_name}"
echo "📊 Processing ranks ${start_rank}-${end_rank}"

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
gsutil cp ${GCS_BUCKET}/riddim_batch_processor.py ./
gsutil cp ${GCS_BUCKET}/afrobeats_intelligence_20250717_103640_manifest.json ./

# Set environment variables
export RIDDIM_DATABASE_URL="${DATABASE_URL}"

# Start processing specific range
echo "🎵 Processing ranks ${start_rank} to ${end_rank}"
python3 riddim_batch_processor.py \
    --manifest afrobeats_intelligence_20250717_103640_manifest.json \
    --start-rank ${start_rank} \
    --end-rank ${end_rank} \
    --batch-size $((end_rank - start_rank + 1)) \
    > /var/log/riddim_processor.log 2>&1

# Log completion
echo "✅ COMPLETE: Processed ranks ${start_rank}-${end_rank}" >> /var/log/riddim_processor.log
echo "done-${start_rank}-${end_rank}" > /tmp/riddim_complete
EOF
}

echo "🚀 DEPLOYING 12 RIDDIM PROCESSORS ACROSS MULTIPLE REGIONS"
echo "   Total songs: ${TOTAL_SONGS}"
echo "   Songs per instance: ~${SONGS_PER_INSTANCE} (some will have +1)"
echo "   Regions: ${REGIONS[*]}"
echo "   Estimated time: 5-6 hours"
echo "   Estimated cost: ~$12"

# Upload processing files to GCS
echo "📤 Uploading processing files..."
gsutil cp riddim_batch_processor.py ${GCS_BUCKET}/
gsutil cp afrobeats_intelligence_20250717_103640_manifest.json ${GCS_BUCKET}/

# Deploy instances evenly across regions
start_rank=1
for ((i=1; i<=TOTAL_INSTANCES; i++)); do
    # Distribute remainder: first REMAINDER instances get one extra song
    songs_this_instance=$SONGS_PER_INSTANCE
    if (( i <= REMAINDER )); then
        songs_this_instance=$((SONGS_PER_INSTANCE + 1))
    fi
    end_rank=$((start_rank + songs_this_instance - 1))
    region_idx=$(( (i-1) % ${#REGIONS[@]} ))
    region="${REGIONS[$region_idx]}"
    zone="${ZONES[$region_idx]}"
    instance_name="riddim-processor-$(printf "%02d" $i)"
    
    echo "🔄 Creating instance ${i}/${TOTAL_INSTANCES}: ${instance_name} (ranks ${start_rank}-${end_rank}) in ${zone}"
    
    create_startup_script ${start_rank} ${end_rank} ${instance_name}
    
    if [ ! -f "startup-script-${instance_name}.sh" ]; then
        echo "❌ Failed to create startup script for ${instance_name}"
        exit 1
    fi
    
    (
      gcloud compute instances create ${instance_name} \
        --project=${PROJECT_ID} \
        --zone=${zone} \
        --machine-type=${MACHINE_TYPE} \
        --image-family=${IMAGE_FAMILY} \
        --image-project=${IMAGE_PROJECT} \
        --boot-disk-size=30GB \
        --boot-disk-type=pd-standard \
        --metadata-from-file startup-script=startup-script-${instance_name}.sh \
        --tags=riddim-processor \
        --scopes=https://www.googleapis.com/auth/cloud-platform
      rm startup-script-${instance_name}.sh
    ) &
    
    start_rank=$((end_rank + 1))
    sleep 3
done

wait

echo ""
echo "🎉 ALL 12 INSTANCES DEPLOYED!"
echo ""
echo "📊 Monitor progress:"
echo "   gcloud compute instances list --filter='name:riddim-processor'"
echo "   psql '${DATABASE_URL}' -c \"SELECT COUNT(*) FROM stems;\""
echo ""
echo "🕒 Expected completion: 5-6 hours"
echo "💰 Estimated cost: ~$12"
echo ""
echo "🎵 Check processing logs:"
echo "   gcloud compute ssh riddim-processor-01 --zone=${ZONES[0]} --command='tail -f /var/log/riddim_processor.log'"
 
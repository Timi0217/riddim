#!/bin/bash

# Stop any existing processing
for i in {1..12}; do
    instance_name="riddim-processor-$(printf "%02d" $i)"
    zones=("us-central1-a" "us-east1-b" "us-west1-b" "us-west2-a")
    zone=${zones[$((($i-1) % 4))]}
    
    echo "🛑 Stopping any existing processing on $instance_name..."
    gcloud compute ssh $instance_name --zone=$zone --command='pkill -f riddim_batch_processor || echo "No existing process"' 2>/dev/null &
done
wait

echo "🚀 Deploying to all 12 instances..."

# Deploy to each instance with specific song ranges
for i in {1..12}; do
    start_song=$(( (i-1) * 9 + 1 ))
    end_song=$(( i * 9 ))
    if [ $i -eq 12 ]; then
        end_song=111  # Last instance gets remaining songs
    fi
    
    instance_name="riddim-processor-$(printf "%02d" $i)"
    zones=("us-central1-a" "us-east1-b" "us-west1-b" "us-west2-a")
    zone=${zones[$((($i-1) % 4))]}
    
    echo "📤 $instance_name: songs $start_song-$end_song..."
    
    gcloud compute ssh $instance_name --zone=$zone --command="
    cd /home/riddim && 
    export RIDDIM_DATABASE_URL='postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway' && 
    gsutil cp gs://riddim-stems-timi-1752717149/missing_songs_updated.json ./ && 
    nohup python3 riddim_batch_processor.py --manifest missing_songs_updated.json --start-rank $start_song --end-rank $end_song --batch-size $(($end_song - $start_song + 1)) > final_batch_$i.log 2>&1 &
    echo 'Instance $i processing songs $start_song-$end_song'
    " 2>/dev/null &
done

wait
echo "🎉 ALL 12 INSTANCES PROCESSING IN PARALLEL!"
echo "⏱️ ETA: ~45 minutes (instead of 10 hours!)"

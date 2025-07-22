#!/bin/bash
echo "🔍 RIDDIM PARALLEL PROCESSING STATUS (12 INSTANCES)"
echo "=================================================="

echo "📊 Database count:"
db_count=$(psql "postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway" -t -c "SELECT COUNT(*) FROM stems;" 2>/dev/null | tr -d ' ')
echo "   Current: $db_count/1000 songs ($(echo "scale=1; $db_count/10" | bc)%)"

echo -e "\n☁️ GCS songs count:" 
gcs_count=$(gsutil ls gs://riddim-stems-timi-1752717149/songs/ 2>/dev/null | wc -l)
echo "   Files: $gcs_count"

echo -e "\n🖥️ Processing status across all 12 instances:"
total_active=0
zones=("us-central1-a" "us-east1-b" "us-west1-b" "us-west2-a")

for i in {1..12}; do
    instance_name="riddim-processor-$(printf "%02d" $i)"
    zone=${zones[$((($i-1) % 4))]}
    
    # Calculate song range for this instance
    start_song=$(( (i-1) * 9 + 1 ))
    end_song=$(( i * 9 ))
    if [ $i -eq 12 ]; then
        end_song=111
    fi
    
    # Check if processing is active
    active=$(gcloud compute ssh $instance_name --zone=$zone --command='ps aux | grep riddim_batch_processor | grep -v grep | wc -l' 2>/dev/null || echo "0")
    
    if [ "$active" -gt 0 ]; then
        echo "   ✅ $instance_name: Processing songs $start_song-$end_song"
        total_active=$((total_active + 1))
    else
        echo "   ❌ $instance_name: Idle (songs $start_song-$end_song)"
    fi
done

echo -e "\n📈 Summary:"
echo "   Active instances: $total_active/12"
echo "   Progress: $((db_count - 889)) completed out of 111 target songs"
remaining=$((1000 - db_count))
echo "   Remaining: $remaining songs to reach 1000"

if [ $total_active -gt 0 ]; then
    echo "   ⏱️ ETA: ~$((remaining * 5 / total_active)) minutes"
else
    echo "   ⚠️ No instances processing - may be complete or failed"
fi

echo -e "\n📝 Recent logs from active instances:"
for i in {1..3}; do  # Show logs from first 3 instances
    instance_name="riddim-processor-$(printf "%02d" $i)"
    zone=${zones[$((($i-1) % 4))]}
    
    log_sample=$(gcloud compute ssh $instance_name --zone=$zone --command="tail -n 1 /home/riddim/final_batch_$i.log 2>/dev/null" 2>/dev/null)
    if [ ! -z "$log_sample" ]; then
        echo "   $instance_name: $log_sample"
    fi
done

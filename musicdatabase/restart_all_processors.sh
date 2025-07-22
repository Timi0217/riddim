#!/bin/bash

# Define the song ranges for each instance
declare -A ranges=(
    ["riddim-processor-01"]="1-84"
    ["riddim-processor-02"]="85-168"
    ["riddim-processor-03"]="169-252"
    ["riddim-processor-04"]="253-336"
    ["riddim-processor-05"]="337-419"
    ["riddim-processor-06"]="420-502"
    ["riddim-processor-07"]="503-585"
    ["riddim-processor-08"]="586-668"
    ["riddim-processor-09"]="669-751"
    ["riddim-processor-10"]="752-834"
    ["riddim-processor-11"]="835-917"
    ["riddim-processor-12"]="918-1000"
)

# Restart processing on all instances
for instance in "${!ranges[@]}"; do
    zone=$(gcloud compute instances list --filter="name:${instance}" --format="value(zone)")
    range=${ranges[$instance]}
    start_rank=${range%-*}
    end_rank=${range#*-}
    
    echo "🔄 Restarting $instance (ranks $range) in $zone"
    
    gcloud compute ssh $instance --zone=$zone --command="
        cd /home/riddim &&
        export RIDDIM_DATABASE_URL='postgresql://postgres:WBhsVyVHrrnqBMJqEoPlODRjdUJSyFtw@trolley.proxy.rlwy.net:27141/railway' &&
        nohup python3 riddim_batch_processor.py --manifest afrobeats_intelligence_20250717_103640_manifest.json --start-rank $start_rank --end-rank $end_rank --batch-size $((end_rank - start_rank + 1)) > /var/log/riddim_processor.log 2>&1 &
        echo 'Started processing ranks $start_rank-$end_rank'
    " &
done

wait
echo "🎉 All 12 instances restarted!"

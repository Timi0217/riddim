#!/bin/bash

echo "🎵 Setting up Afrobeats Intelligence Crawler..."

# Install dependencies
pip3 install -r requirements.txt

# Create .env file template
cat > .env << EOF
# Spotify API Credentials
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
EOF

echo "✅ Dependencies installed"
echo "📝 Please update .env file with your Spotify credentials"
echo ""
echo "🚀 USAGE EXAMPLES:"
echo ""
echo "# Emergency mode - Top 100 tracks for fast launch"
echo "python3 afrobeats_intelligence.py --client-id YOUR_ID --client-secret YOUR_SECRET --emergency-top-100"
echo ""
echo "# Full crawl - Top 1000 tracks"
echo "python3 afrobeats_intelligence.py --client-id YOUR_ID --client-secret YOUR_SECRET --limit 1000"
echo ""
echo "# Custom limit"
echo "python3 afrobeats_intelligence.py --client-id YOUR_ID --client-secret YOUR_SECRET --limit 500"
echo ""
echo "💡 TIP: For your Monday launch, run emergency mode today!" 
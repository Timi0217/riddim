#!/usr/bin/env python3
"""
AFROBEATS INTELLIGENCE CRAWLER
Discovers and ranks the top 1000 Afrobeats songs using Cultural Relevance Scoring
"""

import os
import requests
import json
import time
import logging
from collections import defaultdict, Counter
from datetime import datetime
import spotipy
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv
load_dotenv()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class AfrobeatsIntelligence:
    def __init__(self, client_id, client_secret):
        # Spotify API setup
        self.spotify = spotipy.Spotify(
            client_credentials_manager=SpotifyClientCredentials(
                client_id=client_id,
                client_secret=client_secret
            )
        )
        
        # Track intelligence data
        self.track_scores = defaultdict(float)
        self.track_metadata = {}
        self.playlist_penetration = defaultdict(list)
        self.discovery_sources = defaultdict(list)
        
    def get_official_playlists(self):
        """Get official Spotify Afrobeats playlists"""
        official_playlists = [
            # Tier 1: Official Spotify (40% weight)
            {"id": "37i9dQZF1DX1HVhqeJQFiZ", "name": "Afrobeats Hits", "weight": 10},
            {"id": "37i9dQZF1DXbKaBcHJ7z5c", "name": "African Heat", "weight": 8},
            {"id": "37i9dQZF1DWYJLOjCfWKxk", "name": "Naija Hits", "weight": 8},
            {"id": "37i9dQZF1DX7Yr2LboYdOC", "name": "Afrobeats Central", "weight": 6},
            {"id": "37i9dQZF1DWYJHYeOPCcUe", "name": "Ghana Bounce", "weight": 6},
            
            # Tier 2: Popular Community (30% weight)
            {"id": "6bnfXsKx2VA8Mx8kheMuhj", "name": "AFROBEATS 2025🔥🌴", "weight": 5},
            {"id": "4HXMPRVKOAfzoUwws8fqHW", "name": "AFROBEATS 2025🌴 🔥", "weight": 5},
            {"id": "32HovauslOCYTENgeZlk6M", "name": "afrobeats music", "weight": 4},
            
            # Tier 3: Cross-genre validation (20% weight)
            {"id": "37i9dQZF1DX0XUfTFmNBRM", "name": "Afro-fusion", "weight": 3},
            {"id": "37i9dQZF1DWVem8BovhQaW", "name": "Amapiano", "weight": 3},
        ]
        return official_playlists
    
    def search_afro_playlists(self, limit=50):
        """Search for community playlists with 'afro' in the name"""
        afro_terms = [
            "afrobeats", "afrobeat", "afro beats", "afropop", "afrofusion", 
            "afrohouse", "naija", "afrowave", "afrotrap", "amapiano"
        ]
        
        community_playlists = []
        
        for term in afro_terms:
            try:
                logger.info(f"🔍 Searching playlists for: {term}")
                results = self.spotify.search(q=term, type='playlist', limit=50, market='US')
                
                for playlist in results['playlists']['items']:
                    if playlist and playlist['tracks']['total'] > 20:  # Filter small playlists
                        follower_count = playlist.get('followers', {}).get('total', 0)
                        
                        # Weight by follower count
                        if follower_count >= 10000:
                            weight = 3  # High-follower community
                        elif follower_count >= 1000:
                            weight = 2  # Medium community
                        else:
                            weight = 1  # Underground/niche
                            
                        community_playlists.append({
                            "id": playlist['id'],
                            "name": playlist['name'],
                            "weight": weight,
                            "followers": follower_count,
                            "source": f"search:{term}"
                        })
                        
                time.sleep(0.1)  # Rate limiting
                
            except Exception as e:
                logger.error(f"Error searching for {term}: {e}")
                continue
        
        # Remove duplicates and sort by follower count
        seen_ids = set()
        unique_playlists = []
        for playlist in community_playlists:
            if playlist['id'] not in seen_ids:
                seen_ids.add(playlist['id'])
                unique_playlists.append(playlist)
        
        # Sort by followers and take top 50
        unique_playlists.sort(key=lambda x: x['followers'], reverse=True)
        return unique_playlists[:limit]
    
    def get_playlist_tracks(self, playlist_id, playlist_name, weight):
        """Extract tracks from a playlist and score them"""
        try:
            logger.info(f"📊 Processing playlist: {playlist_name}")
            
            tracks = []
            results = self.spotify.playlist_tracks(playlist_id, limit=100)
            tracks.extend(results['items'])
            
            # Handle pagination
            while results['next']:
                results = self.spotify.next(results)
                tracks.extend(results['items'])
                time.sleep(0.1)  # Rate limiting
            
            processed_count = 0
            for idx, item in enumerate(tracks):
                if not item or not item['track']:
                    continue
                    
                track = item['track']
                if not track.get('id'):
                    continue
                
                # Calculate position weight (earlier in playlist = higher weight)
                position_weight = max(1, (100 - idx) / 100) if idx < 100 else 0.5
                
                # Calculate cultural relevance score
                track_score = weight * position_weight
                
                # Store track data
                track_id = track['id']
                self.track_scores[track_id] += track_score
                self.playlist_penetration[track_id].append(playlist_name)
                
                # Store metadata
                if track_id not in self.track_metadata:
                    artists = [artist['name'] for artist in track.get('artists', [])]
                    self.track_metadata[track_id] = {
                        'name': track.get('name', ''),
                        'artists': artists,
                        'popularity': track.get('popularity', 0),
                        'duration_ms': track.get('duration_ms', 0),
                        'external_urls': track.get('external_urls', {}),
                        'album': track.get('album', {}).get('name', ''),
                        'release_date': track.get('album', {}).get('release_date', ''),
                        'search_query': f"{' '.join(artists)} {track.get('name', '')}"
                    }
                
                processed_count += 1
            
            logger.info(f"✅ Processed {processed_count} tracks from {playlist_name}")
            return processed_count
            
        except Exception as e:
            logger.error(f"❌ Error processing playlist {playlist_name}: {e}")
            return 0
    
    def calculate_cultural_relevance_score(self, track_id):
        """Calculate final Cultural Relevance Score for a track"""
        base_score = self.track_scores[track_id]
        metadata = self.track_metadata.get(track_id, {})
        
        # Playlist penetration bonus (appears in multiple playlists)
        penetration_bonus = len(set(self.playlist_penetration[track_id])) * 0.5
        
        # Popularity bonus (Spotify's internal popularity score)
        popularity_bonus = metadata.get('popularity', 0) / 100 * 2
        
        # Recency bonus (newer tracks get slight boost)
        release_date = metadata.get('release_date', '')
        recency_bonus = 0
        if release_date:
            try:
                if len(release_date) >= 4:
                    year = int(release_date[:4])
                    current_year = datetime.now().year
                    if year >= current_year - 1:  # Released in last 2 years
                        recency_bonus = 1
                    elif year >= current_year - 3:  # Released in last 3 years
                        recency_bonus = 0.5
            except:
                pass
        
        # Final Cultural Relevance Score
        final_score = base_score + penetration_bonus + popularity_bonus + recency_bonus
        return final_score
    
    def run_intelligence_crawl(self, emergency_mode=False):
        """Run the full intelligence crawl"""
        logger.info("🚀 AFROBEATS INTELLIGENCE CRAWL STARTING...")
        
        # Get official playlists
        official_playlists = self.get_official_playlists()
        logger.info(f"📋 Found {len(official_playlists)} official playlists")
        
        # Get community playlists (skip in emergency mode for speed)
        community_playlists = []
        if not emergency_mode:
            community_playlists = self.search_afro_playlists(limit=30)
            logger.info(f"🔍 Found {len(community_playlists)} community playlists")
        
        all_playlists = official_playlists + community_playlists
        
        # Process all playlists
        total_tracks_processed = 0
        for playlist in all_playlists:
            tracks_processed = self.get_playlist_tracks(
                playlist['id'], 
                playlist['name'], 
                playlist['weight']
            )
            total_tracks_processed += tracks_processed
            time.sleep(0.5)  # Rate limiting between playlists
        
        logger.info(f"📊 CRAWL COMPLETE: Processed {total_tracks_processed} total track instances")
        logger.info(f"🎵 Unique tracks discovered: {len(self.track_metadata)}")
        
        return self.generate_ranked_list()
    
    def generate_ranked_list(self, limit=1000):
        """Generate final ranked list of tracks"""
        logger.info("📈 Calculating Cultural Relevance Scores...")
        
        # Calculate final scores for all tracks
        final_rankings = []
        for track_id in self.track_metadata:
            score = self.calculate_cultural_relevance_score(track_id)
            metadata = self.track_metadata[track_id]
            
            final_rankings.append({
                'track_id': track_id,  # Spotify track ID
                'score': score,
                'name': metadata['name'],
                'artists': metadata['artists'],
                'search_query': metadata['search_query'],
                'playlist_count': len(set(self.playlist_penetration[track_id])),
                'playlists': list(set(self.playlist_penetration[track_id])),
                'popularity': metadata['popularity'],
                'album': metadata['album'],
                'release_date': metadata['release_date']
            })
        
        # Sort by Cultural Relevance Score
        final_rankings.sort(key=lambda x: x['score'], reverse=True)
        
        # Return top N tracks
        top_tracks = final_rankings[:limit]
        
        logger.info(f"🏆 TOP {len(top_tracks)} AFROBEATS TRACKS RANKED BY CULTURAL RELEVANCE:")
        for i, track in enumerate(top_tracks[:10], 1):
            artists_str = ', '.join(track['artists'])
            logger.info(f"  {i:2d}. {track['name']} - {artists_str} (Score: {track['score']:.2f}) | Spotify ID: {track['track_id']}")
        
        return top_tracks
    
    def save_results(self, ranked_tracks, filename=None):
        """Save results in optimal format for processing pipeline"""
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"afrobeats_intelligence_{timestamp}"
        
        # 1. MASTER JSON - Complete data with Spotify IDs
        json_file = f"{filename}_master.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(ranked_tracks, f, indent=2, ensure_ascii=False)
        
        # 2. PROCESSING MANIFEST - ID mapping for batch processor
        manifest_file = f"{filename}_manifest.json"
        manifest_data = []
        for i, track in enumerate(ranked_tracks, 1):
            manifest_data.append({
                'rank': i,
                'spotify_id': track['track_id'],
                'search_query': f"{track['search_query']} official audio",
                'track_name': track['name'],
                'artists': track['artists'],
                'score': track['score']
            })
        
        with open(manifest_file, 'w', encoding='utf-8') as f:
            json.dump(manifest_data, f, indent=2, ensure_ascii=False)
        
        # 3. CLEAN SEARCH QUERIES - Pure queries for yt-dlp (NO IDs)
        queries_file = f"{filename}_ytdlp_queries.txt"
        with open(queries_file, 'w', encoding='utf-8') as f:
            for i, track in enumerate(ranked_tracks, 1):
                # Clean search query only - no Spotify ID confusion
                f.write(f"{track['search_query']} official audio\n")
        
        # 4. ID MAPPING - For database lookups
        mapping_file = f"{filename}_id_mapping.csv"
        with open(mapping_file, 'w', encoding='utf-8') as f:
            f.write("rank,spotify_id,track_name,artists,search_query\n")
            for i, track in enumerate(ranked_tracks, 1):
                artists_str = '; '.join(track['artists']).replace(',', ';')  # CSV safe
                search_clean = track['search_query'].replace(',', ';')
                f.write(f"{i},{track['track_id']},{track['name']},{artists_str},{search_clean}\n")
        
        # 5. HUMAN READABLE - For review
        readable_file = f"{filename}_readable.txt"
        with open(readable_file, 'w', encoding='utf-8') as f:
            f.write("🎵 AFROBEATS TOP 1000 - CULTURAL RELEVANCE RANKING\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            for i, track in enumerate(ranked_tracks, 1):
                artists_str = ', '.join(track['artists'])
                f.write(f"{i:3d}. {track['name']} - {artists_str}\n")
                f.write(f"     Spotify ID: {track['track_id']}\n")
                f.write(f"     Score: {track['score']:.2f} | Playlists: {track['playlist_count']}\n")
                f.write(f"     Search: {track['search_query']}\n\n")
        
        logger.info(f"💾 Optimal file structure created:")
        logger.info(f"   📊 Master data: {json_file}")
        logger.info(f"   🔧 Processing manifest: {manifest_file}")
        logger.info(f"   🔍 Clean yt-dlp queries: {queries_file}")
        logger.info(f"   🗃️  ID mapping: {mapping_file}")
        logger.info(f"   📖 Human readable: {readable_file}")
        
        return {
            'master_json': json_file,
            'manifest': manifest_file,
            'ytdlp_queries': queries_file,
            'id_mapping': mapping_file,
            'readable': readable_file
        }

def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Afrobeats Intelligence Crawler')
    parser.add_argument('--emergency-top-100', action='store_true', 
                       help='Emergency mode: process only official playlists for top 100')
    parser.add_argument('--limit', type=int, default=1000, 
                       help='Number of top tracks to return (default: 1000)')
    parser.add_argument('--output', type=str, 
                       help='Output filename prefix (default: timestamp-based)')
    
    args = parser.parse_args()

    client_id = os.getenv('SPOTIFY_CLIENT_ID')
    client_secret = os.getenv('SPOTIFY_CLIENT_SECRET')
    if not client_id or not client_secret:
        logger.error("❌ Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env file")
        exit(1)

    # Initialize intelligence crawler
    intelligence = AfrobeatsIntelligence(client_id, client_secret)
    
    # Run the crawl
    emergency_mode = args.emergency_top_100
    if emergency_mode:
        logger.info("⚡ EMERGENCY MODE: Fast crawl for top 100 tracks")
        limit = min(args.limit, 100)
    else:
        limit = args.limit
    
    ranked_tracks = intelligence.run_intelligence_crawl(emergency_mode=emergency_mode)
    
    # Limit results
    final_tracks = ranked_tracks[:limit]
    
    # Save results
    intelligence.save_results(final_tracks, args.output)
    
    logger.info(f"🎉 INTELLIGENCE CRAWL COMPLETE!")
    logger.info(f"🏆 Top {len(final_tracks)} Afrobeats tracks ready for stem processing")

if __name__ == "__main__":
    main() 
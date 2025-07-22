import os
import requests
from dotenv import load_dotenv

load_dotenv()

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")

# Get Spotify access token
def get_spotify_token():
    auth_url = "https://accounts.spotify.com/api/token"
    auth_response = requests.post(auth_url, {
        'grant_type': 'client_credentials',
        'client_id': SPOTIFY_CLIENT_ID,
        'client_secret': SPOTIFY_CLIENT_SECRET,
    })
    auth_response.raise_for_status()
    return auth_response.json()['access_token']

# Search Spotify tracks
def spotify_search(query, page=1, genre=None, sort=None):
    token = get_spotify_token()
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "q": query,
        "type": "track",
        "limit": 20,
        "offset": (page-1)*20
    }
    if genre:
        params["q"] += f" genre:{genre}"
    url = "https://api.spotify.com/v1/search"
    r = requests.get(url, headers=headers, params=params)
    r.raise_for_status()
    data = r.json()
    results = []
    for item in data.get("tracks", {}).get("items", []):
        results.append({
            "id": item["id"],
            "title": item["name"],
            "artist": ", ".join([a["name"] for a in item["artists"]]),
            "album": item["album"]["name"],
            "artwork": item["album"]["images"][0]["url"] if item["album"]["images"] else None,
            "duration": item["duration_ms"] // 1000,
            "preview_url": item["preview_url"]
        })
    return {"results": results, "page": page, "total": data.get("tracks", {}).get("total", 0)} 
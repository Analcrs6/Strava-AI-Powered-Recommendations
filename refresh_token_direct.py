#!/usr/bin/env python3
"""
Direct token refresh script with proxy handling
"""
import json
import requests
import os
from pathlib import Path

def refresh_token():
    """Refresh the Strava access token"""

    # Load tokens
    tokens_path = Path("tokens.json")
    if not tokens_path.exists():
        print("❌ tokens.json not found!")
        return False

    tokens = json.loads(tokens_path.read_text())
    refresh_token = tokens.get('refresh_token')

    if not refresh_token:
        print("❌ No refresh_token found in tokens.json!")
        return False

    # Load credentials from env file
    env_path = Path("env")
    if not env_path.exists():
        print("❌ env file not found!")
        return False

    env_vars = {}
    for line in env_path.read_text().splitlines():
        if '=' in line and not line.strip().startswith('#'):
            key, value = line.split('=', 1)
            env_vars[key.strip()] = value.strip()

    client_id = env_vars.get('STRAVA_CLIENT_ID')
    client_secret = env_vars.get('STRAVA_CLIENT_SECRET')

    if not client_id or not client_secret:
        print("❌ CLIENT_ID or CLIENT_SECRET not found in env file!")
        return False

    print(f"🔄 Refreshing token for client ID: {client_id}")

    # Temporarily disable proxy for this request
    # Save original proxy settings
    original_http_proxy = os.environ.get('http_proxy')
    original_https_proxy = os.environ.get('https_proxy')
    original_HTTP_PROXY = os.environ.get('HTTP_PROXY')
    original_HTTPS_PROXY = os.environ.get('HTTPS_PROXY')

    try:
        # Disable proxies
        if 'http_proxy' in os.environ:
            del os.environ['http_proxy']
        if 'https_proxy' in os.environ:
            del os.environ['https_proxy']
        if 'HTTP_PROXY' in os.environ:
            del os.environ['HTTP_PROXY']
        if 'HTTPS_PROXY' in os.environ:
            del os.environ['HTTPS_PROXY']

        # Make refresh request
        response = requests.post(
            'https://www.strava.com/oauth/token',
            data={
                'client_id': client_id,
                'client_secret': client_secret,
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token
            },
            proxies={'http': None, 'https': None},  # Explicitly no proxy
            timeout=15
        )

        if response.status_code == 200:
            new_tokens = response.json()

            # Merge with existing athlete data
            new_tokens['athlete'] = tokens.get('athlete', {})

            # Save updated tokens
            tokens_path.write_text(json.dumps(new_tokens, indent=2))

            print("✓ Token refreshed successfully!")
            print(f"  New access token: {new_tokens['access_token'][:20]}...")
            print(f"  Expires at: {new_tokens['expires_at']}")
            return True
        else:
            print(f"❌ Token refresh failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False

    except Exception as e:
        print(f"❌ Error during token refresh: {e}")
        return False

    finally:
        # Restore proxy settings
        if original_http_proxy:
            os.environ['http_proxy'] = original_http_proxy
        if original_https_proxy:
            os.environ['https_proxy'] = original_https_proxy
        if original_HTTP_PROXY:
            os.environ['HTTP_PROXY'] = original_HTTP_PROXY
        if original_HTTPS_PROXY:
            os.environ['HTTPS_PROXY'] = original_HTTPS_PROXY

if __name__ == "__main__":
    print("="*70)
    print("🔐 STRAVA TOKEN REFRESH")
    print("="*70)
    success = refresh_token()
    exit(0 if success else 1)

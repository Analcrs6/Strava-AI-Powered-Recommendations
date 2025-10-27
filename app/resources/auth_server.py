#!/usr/bin/env python3
import os
import json
from pathlib import Path
from urllib.parse import urlencode

import requests
from flask import Flask, request, redirect, jsonify
from dotenv import load_dotenv

# ------------------------------
# Config
# ------------------------------
load_dotenv()

CLIENT_ID = os.getenv("STRAVA_CLIENT_ID")
CLIENT_SECRET = os.getenv("STRAVA_CLIENT_SECRET")
CALLBACK_DOMAIN = os.getenv("CALLBACK_DOMAIN", "http://localhost:8888").rstrip("/")
SCOPES = ["read", "profile:read_all", "activity:read_all"]  # adjust to your need
TOKENS_PATH = Path("tokens.json")  # DO NOT COMMIT THIS

if not CLIENT_ID or not CLIENT_SECRET:
    raise RuntimeError("Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET in environment/.env")

# Flask app
app = Flask(__name__)

# ------------------------------
# Helpers
# ------------------------------
def tokens_exist() -> bool:
    return TOKENS_PATH.exists()

def save_tokens(tokens: dict) -> None:
    TOKENS_PATH.write_text(json.dumps(tokens, indent=2))
    print("[auth_server] Tokens saved to tokens.json")

def load_tokens() -> dict:
    if not tokens_exist():
        return {}
    return json.loads(TOKENS_PATH.read_text())

def build_auth_url() -> str:
    params = {
        "client_id": CLIENT_ID,
        "response_type": "code",
        "redirect_uri": f"{CALLBACK_DOMAIN}/exchange",
        "scope": ",".join(SCOPES),
        "approval_prompt": "auto",
    }
    return "https://www.strava.com/oauth/authorize?" + urlencode(params)

def exchange_code_for_token(code: str) -> dict:
    url = "https://www.strava.com/oauth/token"
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
    }
    r = requests.post(url, data=data, timeout=30)
    r.raise_for_status()
    return r.json()

def refresh_access_token(refresh_token: str) -> dict:
    url = "https://www.strava.com/oauth/token"
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }
    r = requests.post(url, data=data, timeout=30)
    r.raise_for_status()
    return r.json()

# ------------------------------
# Routes
# ------------------------------
@app.route("/")
def index():
    auth_url = build_auth_url()
    msg = (
        "<h2>Strava Auth Server</h2>"
        "<p>Click the button below to authorize with Strava.</p>"
        f'<p><a href="{auth_url}"><button>Authorize Strava</button></a></p>'
        "<p>Callback URL configured: <code>{}/exchange</code></p>"
        "<p>Tokens will be saved to <code>tokens.json</code>.</p>"
    ).format(CALLBACK_DOMAIN)
    return msg

@app.route("/start")
def start():
    return redirect(build_auth_url(), code=302)

@app.route("/exchange")
def exchange():
    code = request.args.get("code")
    if not code:
        return "Missing 'code' parameter from Strava.", 400

    try:
        tokens = exchange_code_for_token(code)
        save_tokens(tokens)
    except requests.HTTPError as e:
        return f"<h3>Token exchange failed</h3><pre>{e.response.text}</pre>", 400

    # Pretty print & show a success page
    pretty = json.dumps(tokens, indent=2)
    print("[auth_server] Token exchange successful.")
    return (
        "<h3>Authorization Complete ✅</h3>"
        "<p>Tokens saved to <code>tokens.json</code>. You can close this tab.</p>"
        f"<pre>{pretty}</pre>"
    )

@app.route("/refresh", methods=["POST", "GET"])
def refresh():
    # Use existing tokens.json by default
    body = request.get_json(silent=True) or {}
    rt = body.get("refresh_token") or request.args.get("refresh_token")

    if not rt:
        saved = load_tokens()
        rt = saved.get("refresh_token")

    if not rt:
        return jsonify({"error": "No refresh_token provided or found in tokens.json"}), 400

    try:
        new_tokens = refresh_access_token(rt)
        save_tokens(new_tokens)
    except requests.HTTPError as e:
        return f"<h3>Refresh failed</h3><pre>{e.response.text}</pre>", 400

    return jsonify(new_tokens)

# ------------------------------
# Main
# ------------------------------
if __name__ == "__main__":
    print("[auth_server] Visit this URL to authorize:")
    print(build_auth_url())
    # Bind to 0.0.0.0 so it works in containers/WSL as well. Port inferred from CALLBACK_DOMAIN or default 8888.
    port_str = CALLBACK_DOMAIN.split(":")[-1]
    try:
        port = int(port_str)
    except ValueError:
        port = 8888
    app.run(host="0.0.0.0", port=port, debug=True)

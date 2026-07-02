#!/usr/bin/env python3
import json
import os

path = os.path.expanduser("~/.nemoclawd/agents/main/agent/auth-profiles.json")
os.makedirs(os.path.dirname(path), exist_ok=True)
profiles = {}
if os.environ.get("ZAI_API_KEY"):
    profiles["zai:glm-5.2"] = {
        "type": "api_key",
        "provider": "zai",
        "model": "zai/glm-5.2",
        "keyRef": {"source": "env", "id": "ZAI_API_KEY"},
        "profileId": "zai:glm-5.2",
    }
if os.environ.get("NVIDIA_API_KEY"):
    profiles["nvidia:manual"] = {
        "type": "api_key",
        "provider": "nvidia",
        "keyRef": {"source": "env", "id": "NVIDIA_API_KEY"},
        "profileId": "nvidia:manual",
    }
json.dump(profiles, open(path, "w"), indent=2)
os.chmod(path, 0o600)

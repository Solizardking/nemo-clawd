#!/usr/bin/env python3
import argparse
import json
import os


def build_profiles(env):
    profiles = {}
    if env.get("ZAI_API_KEY"):
        profiles["zai:glm-5.2"] = {
            "type": "api_key",
            "provider": "zai",
            "model": "zai/glm-5.2",
            "keyRef": {"source": "env", "id": "ZAI_API_KEY"},
            "profileId": "zai:glm-5.2",
        }
    if env.get("NVIDIA_API_KEY"):
        profiles["nvidia:manual"] = {
            "type": "api_key",
            "provider": "nvidia",
            "keyRef": {"source": "env", "id": "NVIDIA_API_KEY"},
            "profileId": "nvidia:manual",
        }
    return profiles


def main():
    parser = argparse.ArgumentParser(description="Write Nemo Clawd auth profile references from environment variables.")
    parser.add_argument("--dry-run", "--smoke-test", action="store_true", dest="dry_run", help="Print the profile JSON without writing it.")
    args = parser.parse_args()

    path = os.path.expanduser("~/.nemoclawd/agents/main/agent/auth-profiles.json")
    profiles = build_profiles(os.environ)

    if args.dry_run:
        print(json.dumps(profiles, indent=2))
        return

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(profiles, f, indent=2)
    os.chmod(path, 0o600)


if __name__ == "__main__":
    main()

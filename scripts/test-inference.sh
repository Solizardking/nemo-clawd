#!/usr/bin/env bash
# Test inference.local routing through OpenShell provider
echo '{"model":"zai/glm-5.2","messages":[{"role":"user","content":"say hello"}]}' > /tmp/req.json
curl -s https://inference.local/v1/chat/completions -H "Content-Type: application/json" -d @/tmp/req.json

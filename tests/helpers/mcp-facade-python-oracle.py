#!/usr/bin/env python3
import hashlib
import json
import sys


def fail(code):
    raise ValueError(code)


def main():
    raw = sys.stdin.buffer.read(1_048_577)
    if len(raw) > 1_048_576:
        fail("MCP_ORACLE_INPUT_TOO_LARGE")
    document = json.loads(raw.decode("utf-8"))
    if not isinstance(document, dict) or set(document) != {"vectors"}:
        fail("MCP_ORACLE_INPUT_INVALID")
    vectors = document["vectors"]
    if not isinstance(vectors, list) or not 1 <= len(vectors) <= 64:
        fail("MCP_ORACLE_INPUT_INVALID")
    results = []
    for vector in vectors:
        if not isinstance(vector, dict) or set(vector) != {"domain", "body"}:
            fail("MCP_ORACLE_INPUT_INVALID")
        domain = vector["domain"]
        if not isinstance(domain, str) or not domain.isascii() or not 1 <= len(domain) <= 128:
            fail("MCP_ORACLE_INPUT_INVALID")
        canonical = json.dumps(vector["body"], ensure_ascii=False, allow_nan=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
        digest = hashlib.sha256(domain.encode("ascii") + b"\x00" + canonical).hexdigest()
        results.append({"address": f"sha256:{digest}", "canonicalHex": canonical.hex()})
    sys.stdout.write(json.dumps({"results": results}, sort_keys=True, separators=(",", ":")) + "\n")


try:
    main()
except Exception:
    sys.stderr.write("MCP_ORACLE_FAILED\n")
    sys.exit(2)

#!/usr/bin/env python3
import hashlib
import json
import sys
import unicodedata

MAX_SAFE_INTEGER = 9007199254740991


def reject(message):
    raise ValueError(message)


def validate(value, depth=0):
    if depth > 32:
        reject("depth")
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int) and not isinstance(value, bool):
        if value < -MAX_SAFE_INTEGER or value > MAX_SAFE_INTEGER:
            reject("integer")
        return
    if isinstance(value, float):
        reject("number")
    if isinstance(value, str):
        if unicodedata.normalize("NFC", value) != value:
            reject("nfc")
        if len(value.encode("utf-8")) > 16384:
            reject("string")
        for character in value:
            point = ord(character)
            if 0xFDD0 <= point <= 0xFDEF or point & 0xFFFF in (0xFFFE, 0xFFFF):
                reject("noncharacter")
        return
    if isinstance(value, list):
        if len(value) > 1024:
            reject("array")
        for member in value:
            validate(member, depth + 1)
        return
    if isinstance(value, dict):
        if len(value) > 64:
            reject("object")
        for key, member in value.items():
            validate(key, depth + 1)
            validate(member, depth + 1)
        return
    reject("type")


def string_bytes(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def utf16_key(value):
    return value.encode("utf-16-be", "surrogatepass")


def canonical(value):
    if value is None:
        return b"null"
    if value is True:
        return b"true"
    if value is False:
        return b"false"
    if isinstance(value, int):
        return str(value).encode("ascii")
    if isinstance(value, str):
        return string_bytes(value)
    if isinstance(value, list):
        return b"[" + b",".join(canonical(member) for member in value) + b"]"
    if isinstance(value, dict):
        members = []
        for key in sorted(value, key=utf16_key):
            members.append(string_bytes(key) + b":" + canonical(value[key]))
        return b"{" + b",".join(members) + b"}"
    reject("type")


def main():
    request = json.loads(sys.stdin.buffer.read(), parse_float=lambda _: reject("number"))
    if set(request) != {"domain", "value"} or not isinstance(request["domain"], str):
        reject("request")
    validate(request["value"])
    body = canonical(request["value"])
    addressed = request["domain"].encode("ascii") + b"\x00" + body
    response = {
        "canonicalHex": body.hex(),
        "objectDigest": "sha256:" + hashlib.sha256(addressed).hexdigest(),
    }
    sys.stdout.write(json.dumps(response, separators=(",", ":"), sort_keys=True) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stderr.write(type(error).__name__ + "\n")
        sys.exit(2)

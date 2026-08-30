#!/usr/bin/env python3
import hashlib
import json
import sys
import unicodedata


def reject_pairs(pairs):
    output = {}
    for key, value in pairs:
        if key in output:
            raise ValueError('DUPLICATE_KEY')
        output[key] = value
    return output


def validate(value, depth=0):
    if depth > 32:
        raise ValueError('DEPTH')
    if isinstance(value, str):
        if unicodedata.normalize('NFC', value) != value or len(value.encode('utf-8')) > 16384:
            raise ValueError('STRING')
        return
    if value is None or isinstance(value, bool):
        return
    if isinstance(value, int) and not isinstance(value, bool):
        if abs(value) > 9007199254740991:
            raise ValueError('INTEGER')
        return
    if isinstance(value, list):
        if len(value) > 1024:
            raise ValueError('ARRAY')
        for entry in value:
            validate(entry, depth + 1)
        return
    if isinstance(value, dict):
        if len(value) > 64:
            raise ValueError('OBJECT')
        for key, entry in value.items():
            validate(key, depth + 1)
            validate(entry, depth + 1)
        return
    raise ValueError('TYPE')


def main():
    raw = sys.stdin.buffer.read(1048577)
    if len(raw) > 1048576:
        raise ValueError('BYTES')
    request = json.loads(raw.decode('utf-8'), object_pairs_hook=reject_pairs,
                         parse_float=lambda _: (_ for _ in ()).throw(ValueError('FLOAT')))
    if set(request) != {'domain', 'value'} or not isinstance(request['domain'], str):
        raise ValueError('REQUEST')
    validate(request['value'])
    canonical = json.dumps(request['value'], ensure_ascii=False, sort_keys=True,
                           separators=(',', ':')).encode('utf-8')
    digest = hashlib.sha256(request['domain'].encode('ascii') + b'\x00' + canonical).hexdigest()
    sys.stdout.write(json.dumps({'digest': f'sha256:{digest}'}, separators=(',', ':')) + '\n')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        sys.stderr.write(str(error) + '\n')
        sys.exit(2)

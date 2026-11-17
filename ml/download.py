"""Downloads the training data and verifies it against the published checksum.

Dataset: "Disease and symptoms dataset 2023", Mendeley Data, version 1
DOI 10.17632/2cxccsxydc.1 · licence CC BY 4.0 · https://data.mendeley.com/datasets/2cxccsxydc/1

    ml/.venv/Scripts/python ml/download.py
"""

from __future__ import annotations

import hashlib
import sys
import urllib.request
from pathlib import Path

URL = "https://data.mendeley.com/public-files/datasets/2cxccsxydc/files/a16f2141-6e3c-466f-9ce9-28d3d8d91070/file_downloaded"
SHA256 = "8de90603ebada467fc2703db2ee4292856e52d64e94982ef926df22fa0c21320"
DEST = Path(__file__).parent / "data" / "disease_symptoms_2023.csv"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    if DEST.exists() and sha256(DEST) == SHA256:
        print(f"Already downloaded and verified: {DEST}")
        return 0
    tmp = DEST.with_suffix(".part")
    print(f"Downloading {URL}\n  -> {DEST}")
    req = urllib.request.Request(URL, headers={"User-Agent": "cleardx-training/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r, tmp.open("wb") as out:
        total = int(r.headers.get("Content-Length") or 0)
        done = 0
        while chunk := r.read(1 << 20):
            out.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r  {done / 1e6:6.1f} / {total / 1e6:.1f} MB", end="", flush=True)
    print()
    digest = sha256(tmp)
    if digest != SHA256:
        tmp.unlink()
        print(f"Checksum mismatch: got {digest}, expected {SHA256}", file=sys.stderr)
        return 1
    tmp.replace(DEST)
    print("Checksum verified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

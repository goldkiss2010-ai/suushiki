#!/usr/bin/env python3
"""Package the three *already measured* SUUSHIKI runs for the v0.1 archive.

Not a benchmark runner. This script does not generate or find collisions.
It refuses to freeze input that does not match the documented source JSON.
"""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

SOURCE_ROOT = Path("build/v0.1")
DIST = Path("dist")
SOURCES = {
    "01-fourway": {
        "run": 38091544273,
        "file": "suushiki-four-way-matrix.json",
        "digest": "d6229023a2a27312217d7f90b16bdbf087e4e0d7089c2edcd89580852e65006e",
        "collection": "cases",
        "count": 12,
    },
    "02-line-edge": {
        "run": 38092208319,
        "file": "suushiki-line-edge-sweep.json",
        "digest": "2cdaa327d3d648897dba1c136fbfdf07f781c1cb430bfaf3c4e982ba91ae4ee1",
        "collection": "observations",
        "count": 1026,
    },
    "03-css-isolation": {
        "run": 38093345109,
        "file": "suushiki-css-isolation.json",
        "digest": "59891d5310e2852497fd929969d2e8f9e1549b9ddb31a74b0094f4ac6cfe1758",
        "collection": "observations",
        "count": 2944,
    },
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def main():
    files = {}
    provenance = []
    for folder, expected in SOURCES.items():
        directory = SOURCE_ROOT / folder
        target = directory / expected["file"]
        if not target.is_file():
            raise SystemExit(f"Missing measured dataset: {target}")
        raw = target.read_bytes()
        if digest(raw) != expected["digest"]:
            raise SystemExit(f"SHA-256 mismatch for {target}: got {digest(raw)}")
        obj = json.loads(raw)
        if len(obj[expected["collection"]]) != expected["count"]:
            raise SystemExit(f"Observation count mismatch for {target}")
        image_count = 0
        for path in sorted(directory.rglob("*")):
            if not path.is_file():
                continue
            if path.is_symlink():
                raise SystemExit(f"Symlink not allowed: {path}")
            if path.suffix not in (".json", ".png"):
                raise SystemExit(f"Unexpected archived data extension: {path}")
            relative = path.relative_to(SOURCE_ROOT)
            archive_name = "evidence/" + relative.as_posix()
            files[archive_name] = path.read_bytes()
            if path.suffix == ".png":
                image_count += 1
        if image_count < 1:
            raise SystemExit(f"Original screenshots are missing from {directory}")
        provenance.append({
            "experiment": folder,
            "github_actions_run": expected["run"],
            "data_file": "evidence/" + (Path(folder) / expected["file"]).as_posix(),
            "sha256": expected["digest"],
            "measured_conditions": expected["count"],
            "screenshots": image_count,
        })

    manifest = {
        "schema": "suushiki/research-freeze/1",
        "version": "v0.1",
        "frozen_on": "2026-10-11",
        "description": "既知の日本語・行内数式組版の調査データ（新しい衝突を生成しない）",
        "conditions": {
            "chromium": "140.0.7339.186",
            "playwright": "1.55.1",
            "platform": "GitHub Actions Ubuntu",
            "font": "sans-serif / OS fallback",
            "font_size_css_px": 20,
        },
        "experiments": provenance,
        "files_sha256": {name: digest(data) for name, data in sorted(files.items())},
    }
    manifest_bytes = (json.dumps(manifest, indent=2, ensure_ascii=False) + "\n").encode("utf-8")
    guide = """SUUSHIKI v0.1 — 日本語の組版調査・測定データ
凍結日：2026年10月11日

これは既知の衝突（T01〜T07）のうち、実測した条件の証拠を保存したアーカイブです。
ブラウザーやMathJaxの不具合認定、JLREQ完全適合、視覚品質の認証ではありません。

evidence/ 以下を調査実行ごとに分けて保存しています。
同じファイル名でも、対応する元のGitHub Actions実行は manifest.json に記載。
manifest.json の files_sha256 と中身を照合できます。

検索用の日本語解説：
https://github.com/goldkiss2010-ai/suushiki/blob/v0.1/docs/research/README.md

実験と限界：
https://github.com/goldkiss2010-ai/suushiki/blob/v0.1/docs/research/05-method-and-evidence.md
"""
    files["manifest.json"] = manifest_bytes
    files["README-JA.txt"] = guide.encode("utf-8")
    DIST.mkdir(parents=True, exist_ok=True)
    package = DIST / "SUUSHIKI-v0.1-evidence.zip"
    # Stable member ordering helps archived files remain easy to inspect.
    with ZipFile(package, "w", ZIP_DEFLATED, compresslevel=9) as zipfile:
        for name in sorted(files):
            zipfile.writestr(name, files[name])
    (DIST / "SUUSHIKI-v0.1-manifest.json").write_bytes(manifest_bytes)
    print("Archived %s files, %s bytes" % (len(files), package.stat().st_size))
    print("Archive SHA-256:", digest(package.read_bytes()))
    print("Full dataset counts:", [item["measured_conditions"] for item in provenance])


if __name__ == "__main__":
    main()

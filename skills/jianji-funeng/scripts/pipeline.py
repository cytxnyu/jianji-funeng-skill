#!/usr/bin/env python3
"""Deterministic media preparation, plan checks and non-destructive assembly."""
import argparse
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


def save_json(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def run(command):
    result = subprocess.run(command, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode:
        raise ValueError(f"Command failed ({result.returncode}): {command[0]}\n{result.stderr[-4000:]}")
    return result.stdout


def probe(path):
    data = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(path)]))
    video = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    if not video:
        raise ValueError("No video stream")
    ratio = video.get("avg_frame_rate", "0/1").split("/")
    fps = int(ratio[0]) / max(1, int(ratio[1]))
    return {"file": str(Path(path).resolve()), "width": video["width"], "height": video["height"],
            "fps": fps, "fpsRational": video["avg_frame_rate"],
            "duration": float(video.get("duration") or data["format"]["duration"]),
            "audio": [{"codec": s.get("codec_name"), "sampleRate": s.get("sample_rate"), "channels": s.get("channels")}
                      for s in data["streams"] if s["codec_type"] == "audio"]}


def srt_cues(path):
    text = Path(path).read_text(encoding="utf-8-sig").replace("\r\n", "\n").strip()
    stamp = r"(\d{2,}):(\d{2}):(\d{2})[,.](\d{3})"
    pattern = re.compile(stamp + r"\s*-->\s*" + stamp + r"[^\n]*\n(.*?)(?=\n\s*\n|\Z)", re.S)
    def seconds(values):
        h, m, s, ms = map(int, values)
        if m >= 60 or s >= 60:
            raise ValueError("Invalid SRT timestamp")
        return h * 3600 + m * 60 + s + ms / 1000
    cues = []
    for match in pattern.finditer(text):
        start, end = seconds(match.groups()[:4]), seconds(match.groups()[4:8])
        if end <= start or (cues and start < cues[-1]["start"]):
            raise ValueError("SRT cues must be chronological with positive duration")
        body = re.sub(r"<[^>]+>", "", match.group(9)).strip()
        if not body:
            raise ValueError("Empty SRT cue")
        cues.append({"id": len(cues) + 1, "start": start, "end": end, "text": body})
    if not cues:
        raise ValueError("No timed SRT cues; use UTF-8 SRT with timestamps")
    return cues


def number(value, label, minimum=0):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < minimum:
        raise ValueError(f"{label} must be a finite number >= {minimum}")
    return value


def units(text):
    return sum(0.5 if ord(c) < 128 else 1 for c in text)


def validate(plan, cues=None):
    if plan.get("schemaVersion") != 1 or plan.get("purpose") not in ("edit", "preview"):
        raise ValueError("schemaVersion=1 and purpose=edit|preview are required")
    fps = number(plan.get("fps"), "fps", 1)
    if fps > 120:
        raise ValueError("fps must be <= 120")
    source = plan.get("source", {})
    duration = number(source.get("duration"), "source.duration", 0.1)
    for key in ("width", "height"):
        v = source.get(key)
        if isinstance(v, bool) or not isinstance(v, int) or v < 2 or v % 2:
            raise ValueError(f"source.{key} must be a positive even integer")
    if abs(source["width"] / source["height"] - 16 / 9) > 0.025:
        raise ValueError("Bundled layout is 16:9. Reflow the layout for other aspect ratios before assembly.")
    if not isinstance(plan.get("segments"), list):
        raise ValueError("segments must be an array")
    warnings, ids, previous_end, total = [], set(), 0, 0
    for segment in plan["segments"]:
        name = segment.get("id", "")
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", name) or name in ids:
            raise ValueError("Each segment requires a unique filename-safe id")
        ids.add(name)
        start = number(segment.get("start"), f"{name}.start")
        end = number(segment.get("end"), f"{name}.end")
        a, b = round(start * fps), round(end * fps)
        if b <= a or a < previous_end or b > round(duration * fps):
            raise ValueError(f"{name}: overlap, reversed interval, unsorted segment or outside source duration")
        if (b - a) / fps < 2 - 1e-6:
            raise ValueError(f"{name}: components require at least 2 seconds")
        previous_end, total = b, total + b - a
        evidence = segment.get("evidence", [])
        if plan["purpose"] == "edit" and not evidence:
            raise ValueError(f"{name}: timed source evidence is required")
        for e in evidence:
            es = number(e.get("start"), "evidence.start")
            ee = number(e.get("end"), "evidence.end")
            quote = e.get("quote")
            if ee <= es or ee > duration + 0.05 or not isinstance(quote, str) or not quote.strip():
                raise ValueError(f"{name}: invalid evidence")
            if cues is not None:
                passage = "".join(c["text"] for c in cues if c["end"] > es and c["start"] < ee)
                norm = lambda s: re.sub(r"\s+", "", s)
                if norm(quote) not in norm(passage):
                    raise ValueError(f"{name}: quoted evidence is absent from the supplied timed transcript")
        if evidence and not any(e["end"] >= start - 0.5 and e["start"] <= end for e in evidence):
            raise ValueError(f"{name}: evidence does not match the component time window")
        props = segment.get("props", {})
        kind = segment.get("type")
        if kind == "chapter":
            lines = props.get("titleLines")
            if not isinstance(lines, list) or not 1 <= len(lines) <= 3:
                raise ValueError(f"{name}: chapter needs 1–3 titleLines")
            if any(not isinstance(s, str) or not s.strip() or units(s) > 18 for s in lines):
                raise ValueError(f"{name}: split or shorten chapter lines to <= 18 CJK-equivalent characters")
            if (b-a)/fps > 10:
                raise ValueError(f"{name}: chapter duration must be <= 10 seconds")
        elif kind == "prompt":
            lines = props.get("lines")
            if not isinstance(lines, list) or not 1 <= len(lines) <= 5:
                raise ValueError(f"{name}: prompt needs 1–5 lines")
            if any(not isinstance(s, str) or not s.strip() or units(s) > 46 for s in lines):
                raise ValueError(f"{name}: split or shorten prompt lines to <= 46 CJK-equivalent characters")
            h = props.get("highlightLine", 0)
            if isinstance(h, bool) or not isinstance(h, int) or not 0 <= h < len(lines):
                raise ValueError(f"{name}: highlightLine must reference an existing line (zero-based)")
            minimum = max(3, 1.5 + sum(units(s) for s in lines)/9)
            if plan["purpose"] == "edit" and (b-a)/fps + 0.01 < minimum:
                raise ValueError(f"{name}: reading time requires {minimum:.2f}s; use fewer words, split the card or a longer evidenced window")
            if (b-a)/fps > 60:
                raise ValueError(f"{name}: split prompt cards longer than 60 seconds")
        else:
            raise ValueError(f"{name}: type must be chapter or prompt")
        for k, value in props.items():
            if k.endswith("Color") and (not isinstance(value, str) or not re.fullmatch(r"#[0-9A-Fa-f]{6}", value)):
                raise ValueError(f"{name}: {k} must be #RRGGBB")
        if "durationSeconds" in props:
            raise ValueError(f"{name}: durationSeconds is computed from start/end; omit it from props")
    if plan["purpose"] == "preview":
        warnings.append("Preview mode checks appearance, not full-text reading time")
    elif total / fps > duration * 0.25:
        warnings.append("Components cover over 25% of the video; review whether all additions are necessary")
    return {"result": "PASS", "segments": len(ids), "fps": fps, "warnings": warnings}


def inspect(args):
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=False)
    meta = probe(args.video)
    save_json(out / "media.json", meta)
    if args.srt:
        save_json(out / "cues.json", srt_cues(args.srt))
    for i, fraction in enumerate((0.08, 0.3, 0.5, 0.7, 0.92)):
        run(["ffmpeg", "-v", "error", "-ss", str(meta["duration"] * fraction), "-i", args.video,
             "-frames:v", "1", "-vf", "scale=960:-2", str(out / f"sample-{i+1}.jpg")])
    print(json.dumps({"result": "PASS", "metadata": meta, "samples": 5}, ensure_ascii=False))


def assemble(args):
    plan_path = Path(args.plan).resolve()
    plan = read_json(plan_path)
    validate(plan)
    if plan["purpose"] != "edit":
        raise ValueError("Assembly requires purpose=edit, not preview")
    source_path = Path(args.video).resolve()
    out = Path(args.out).resolve()
    if out == source_path or out.exists():
        raise ValueError("Output must be a new file distinct from the source")
    if out.suffix.lower() != ".mp4":
        raise ValueError("Assembly output must use .mp4")
    meta = probe(source_path)
    for k in ("width", "height"):
        if meta[k] != plan["source"][k]:
            raise ValueError(f"Source {k} differs from plan; re-inspect source")
    if abs(meta["duration"]-plan["source"]["duration"]) > 2/plan["fps"] or abs(meta["fps"]-plan["fps"]) > 0.03:
        raise ValueError("Source duration/fps differs from plan; re-inspect source")
    out.parent.mkdir(parents=True, exist_ok=True)
    if not plan["segments"]:
        shutil.copy2(source_path, out)
        print(json.dumps({"result": "PASS", "segments": 0, "sourceUnchanged": True, "byteIdentical": True}))
        return
    clips = Path(args.clips).resolve()
    manifest = read_json(clips / "manifest.json")
    digest = hashlib.sha256(plan_path.read_bytes()).hexdigest()
    if manifest["planSha256"] != digest:
        raise ValueError("Plan changed after render; rerender clips")
    if [x["id"] for x in manifest["clips"]] != [x["id"] for x in plan["segments"]]:
        raise ValueError("Rendered clips do not match the plan")
    command = ["ffmpeg", "-v", "error", "-n", "-i", str(source_path)]
    filters = ["[0:v]setpts=PTS-STARTPTS[v0]"]
    for i, (segment, item) in enumerate(zip(plan["segments"], manifest["clips"])):
        clip = (clips / item["file"]).resolve()
        if not clip.is_relative_to(clips) or not clip.is_file():
            raise ValueError("Missing or invalid clip path")
        if hashlib.sha256(clip.read_bytes()).hexdigest() != item["sha256"]:
            raise ValueError("Clip content changed after render")
        command += ["-i", str(clip)]
        start, end = round(segment["start"]*plan["fps"])/plan["fps"], round(segment["end"]*plan["fps"])/plan["fps"]
        filters += [f"[{i+1}:v]scale={meta['width']}:{meta['height']},setsar=1,setpts=PTS-STARTPTS+{start}/TB[c{i}]",
                    f"[v{i}][c{i}]overlay=eof_action=pass:repeatlast=0:enable='gte(t,{start})*lt(t,{end})'[v{i+1}]"]
    audio_codec = "copy" if all(a["codec"] in ("aac", "mp3", "alac") for a in meta["audio"]) else "aac"
    command += ["-filter_complex", ";".join(filters), "-map", f"[v{len(plan['segments'])}]", "-map", "0:a?",
                "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(plan["fps"]),
                "-c:a", audio_codec, "-t", str(meta["duration"]), "-movflags", "+faststart", str(out)]
    before = hashlib.sha256(source_path.read_bytes()).hexdigest()
    run(command)
    result = probe(out)
    run(["ffmpeg", "-v", "error", "-i", str(out), "-f", "null", "-"])
    if abs(result["duration"]-meta["duration"]) > 2/plan["fps"] or len(result["audio"]) != len(meta["audio"]):
        raise ValueError("Assembly duration/audio verification failed")
    unchanged = before == hashlib.sha256(source_path.read_bytes()).hexdigest()
    assert unchanged
    report = {"result": "PASS", "output": str(out), "segments": len(plan["segments"]), "audioCodecMode": audio_codec,
              "duration": result["duration"], "sourceSha256": before, "sourceUnchanged": unchanged, "command": command}
    save_json(out.with_suffix(".verification.json"), report)
    print(json.dumps({k: v for k, v in report.items() if k != "command"}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    p = sub.add_parser("inspect"); p.add_argument("--video", required=True); p.add_argument("--srt"); p.add_argument("--out", required=True)
    p = sub.add_parser("cues"); p.add_argument("--srt", required=True); p.add_argument("--out", required=True)
    p = sub.add_parser("validate"); p.add_argument("--plan", required=True); p.add_argument("--cues")
    p = sub.add_parser("init"); p.add_argument("--workdir", required=True)
    p = sub.add_parser("assemble"); p.add_argument("--video", required=True); p.add_argument("--plan", required=True); p.add_argument("--clips", required=True); p.add_argument("--out", required=True)
    args = parser.parse_args()
    try:
        if args.action == "inspect": inspect(args)
        elif args.action == "cues":
            if Path(args.out).exists(): raise ValueError("Choose a new cues output file")
            result = srt_cues(args.srt); save_json(args.out, result)
            print(json.dumps({"result": "PASS", "cues": len(result)}))
        elif args.action == "validate":
            print(json.dumps(validate(read_json(args.plan), read_json(args.cues) if args.cues else None), ensure_ascii=False))
        elif args.action == "init":
            target = Path(args.workdir).resolve()
            if target.exists(): raise ValueError("Choose a new workdir; installed skill files stay unchanged")
            shutil.copytree(ROOT / "assets/remotion-template", target)
            print(json.dumps({"result": "PASS", "project": str(target), "next": "npm ci, then node scripts/render-plan.mjs --plan PLAN --out OUT"}, ensure_ascii=False))
        else: assemble(args)
    except (ValueError, KeyError, TypeError, OSError, subprocess.SubprocessError) as exc:
        print(json.dumps({"result": "FAIL", "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())

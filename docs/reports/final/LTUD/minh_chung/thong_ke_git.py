#!/usr/bin/env python3
"""Reproduce the report's Git snapshot attribution; no worktree files are changed."""
from pathlib import Path
from collections import Counter
import argparse
import json
import math
import subprocess

MEMBERS = {
    "vinhlieu1942@gmail.com": "Hoàng Văn Tùng",
    "dohoikute@gmail.com": "Đỗ Thùy Linh",
    "103394848+xwomen1@users.noreply.github.com": "Đỗ Thùy Linh",
    "anhdungdt2003@gmail.com": "Nguyễn Việt Dũng",
    "nguyendinhphuc02012002@gmail.com": "Nguyễn Đình Phúc",
}

def selected(path):
    if Path(path).suffix not in {".ts", ".tsx", ".js", ".kt", ".java"}:
        return False
    return path == "code/booking_classroom/App.tsx" or path.startswith((
        "code/booking_classroom/src/",
        "code/booking_classroom/__tests__/",
        "code/booking_classroom/quality-tests/",
        "code/booking_classroom/android/app/src/main/java/",
        "code/booking-server/src/",
    ))

def collect(repo, revision):
    def git(*args):
        return subprocess.check_output(["git", "-C", str(repo), *args]).decode()
    commit = git("rev-parse", revision).strip()
    paths = [p for p in git("ls-tree", "-r", "--name-only", commit).splitlines() if selected(p)]
    people = {name: {"source": 0, "tests": 0, "commits": 0, "files": []}
              for name in dict.fromkeys(MEMBERS.values())}
    files = []
    for path in paths:
        author = None
        per_file = Counter()
        for line in git("blame", "-w", "--line-porcelain", commit, "--", path).splitlines():
            if line.startswith("author-mail "):
                author = line.removeprefix("author-mail ").strip("<>")
            elif line.startswith("\t") and line[1:].strip():
                if author not in MEMBERS:
                    raise ValueError("Author identity needs explicit mapping before aggregation.")
                per_file[MEMBERS[author]] += 1
        category = "tests" if any(x in path for x in ("__tests__/", "quality-tests/", "src/test/")) else "source"
        for name, count in per_file.items():
            people[name][category] += count
            people[name]["files"].append(path)
        files.append({"path": path, "category": category, "nonblank_lines_by_member": dict(per_file)})
    for author in git("log", "--no-merges", "--format=%ae", commit).splitlines():
        if author not in MEMBERS:
            raise ValueError("Commit author identity needs explicit mapping.")
        people[MEMBERS[author]]["commits"] += 1
    total = sum(p["source"] + p["tests"] for p in people.values())
    shares = {n: 1000 * (p["source"] + p["tests"]) / total for n, p in people.items()}
    units = {n: math.floor(v) for n, v in shares.items()}
    for name in sorted(shares, key=lambda n: shares[n] - units[n], reverse=True)[:1000 - sum(units.values())]:
        units[name] += 1
    for name, person in people.items():
        person["total"] = person["source"] + person["tests"]
        person["percent"] = units[name] / 10
    return {
        "commit": commit,
        "method": "git blame -w; tracked nonblank source/test lines; comments included; commits exclude merges; shares rounded by largest remainder to 0.1 percent",
        "total_files": len(paths),
        "total_lines": total,
        "members": people,
        "files": files,
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[5])
    parser.add_argument("--commit", default="2631689113451dc705970ab3e4b1b9da5afa6677")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = collect(args.repo, args.commit)
    encoded = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(encoded + "\n")
    print("Commit:", result["commit"])
    print("Files:", result["total_files"], "Nonblank lines:", result["total_lines"])
    for name, person in result["members"].items():
        print(name, "source:", person["source"], "tests:", person["tests"],
              "commits:", person["commits"], "share:", person["percent"])

if __name__ == "__main__":
    main()

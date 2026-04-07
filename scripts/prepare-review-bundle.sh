#!/usr/bin/env bash

set -euo pipefail

print_usage() {
    cat <<'EOF'
Usage:
  prepare-review-bundle.sh [--repo <path>] [--output <bundle-dir>] [--base <git-ref>]

Creates a read-only review bundle for an isolated reviewer. The bundle contains:
  - snapshot/      current tracked + untracked non-ignored files, without .git
  - status.txt     git status --short --untracked-files=all
  - review.patch   git diff --binary against the chosen base ref
  - README.txt     bundle metadata and reviewer guidance
  - base-ref.txt   requested base ref
  - base-commit.txt resolved commit for the base ref when available

Defaults:
  --repo   current git toplevel
  --output mktemp directory under /tmp
  --base   HEAD
EOF
}

fail() {
    printf '%s\n' "$1" >&2
    exit 1
}

resolve_abs_path() {
    local target="$1"
    local parent
    local name

    parent=$(dirname "$target")
    name=$(basename "$target")
    mkdir -p "$parent"
    (
        cd "$parent"
        printf '%s/%s\n' "$(pwd)" "$name"
    )
}

repo_root=""
bundle_dir=""
base_ref="HEAD"

while [[ $# -gt 0 ]]; do
    case "$1" in
        --repo)
            repo_root="${2:-}"
            shift 2
            ;;
        --output)
            bundle_dir="${2:-}"
            shift 2
            ;;
        --base)
            base_ref="${2:-}"
            shift 2
            ;;
        --help|-h)
            print_usage
            exit 0
            ;;
        *)
            fail "Unknown argument: $1"
            ;;
    esac
done

if [[ -z "$repo_root" ]]; then
    repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
fi

if [[ -z "$repo_root" ]]; then
    fail "Could not resolve a git repository. Pass --repo <path>."
fi

repo_root=$(
    cd "$repo_root"
    pwd
)

git -C "$repo_root" rev-parse --is-inside-work-tree >/dev/null 2>&1 || fail "Not a git worktree: $repo_root"
repo_root=$(git -C "$repo_root" rev-parse --show-toplevel)

if [[ -n "$bundle_dir" ]]; then
    bundle_dir=$(resolve_abs_path "$bundle_dir")
    if [[ -e "$bundle_dir" && ! -d "$bundle_dir" ]]; then
        fail "Output path exists and is not a directory: $bundle_dir"
    fi
    mkdir -p "$bundle_dir"
    if [[ -n "$(find "$bundle_dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]]; then
        fail "Output directory must be empty: $bundle_dir"
    fi
else
    bundle_dir=$(mktemp -d "/tmp/$(basename "$repo_root")-review.XXXXXX")
fi

snapshot_dir="$bundle_dir/snapshot"
mkdir -p "$snapshot_dir"

file_list=$(mktemp)
cleanup() {
    rm -f "$file_list"
}
trap cleanup EXIT

while IFS= read -r -d '' relative_path; do
    if [[ -e "$repo_root/$relative_path" || -L "$repo_root/$relative_path" ]]; then
        printf '%s\0' "$relative_path" >> "$file_list"
    fi
done < <(git -C "$repo_root" ls-files -z --cached --others --exclude-standard)

if [[ -s "$file_list" ]]; then
    tar -C "$repo_root" --null -T "$file_list" -cf - | tar -C "$snapshot_dir" -xf -
fi

git -C "$repo_root" status --short --untracked-files=all > "$bundle_dir/status.txt"
printf '%s\n' "$base_ref" > "$bundle_dir/base-ref.txt"

resolved_base=""
if resolved_base=$(git -C "$repo_root" rev-parse --verify "$base_ref" 2>/dev/null); then
    printf '%s\n' "$resolved_base" > "$bundle_dir/base-commit.txt"
    git -C "$repo_root" diff --binary --no-ext-diff --no-color "$base_ref" > "$bundle_dir/review.patch"
else
    : > "$bundle_dir/base-commit.txt"
    : > "$bundle_dir/review.patch"
fi

created_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > "$bundle_dir/README.txt" <<EOF
Review bundle for: $repo_root
Created at (UTC): $created_at
Requested base ref: $base_ref
Resolved base commit: ${resolved_base:-unavailable}

Bundle contents:
- snapshot/: current tracked and untracked non-ignored files, copied without .git
- status.txt: git status --short --untracked-files=all from the source worktree
- review.patch: git diff --binary against the base ref when available
- base-ref.txt: requested base ref
- base-commit.txt: resolved base commit when available

Recommended reviewer policy:
- mount this bundle read-only
- disable network
- strip secrets and write credentials
- do not start a nested sandbox inside the reviewer worker
EOF

chmod -R a-w "$bundle_dir"

printf 'Prepared review bundle: %s\n' "$bundle_dir"
printf 'Snapshot: %s\n' "$snapshot_dir"
printf 'Status: %s/status.txt\n' "$bundle_dir"
printf 'Patch: %s/review.patch\n' "$bundle_dir"
if [[ -z "$resolved_base" ]]; then
    printf 'Warning: base ref %s could not be resolved; review.patch was left empty.\n' "$base_ref" >&2
fi

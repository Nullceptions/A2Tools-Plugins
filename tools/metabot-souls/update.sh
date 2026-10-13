#!/usr/bin/env bash
# Refresh the pet soul sources from metabot.gg and rebuild
# plugins/pet-souls/sources.js.
#
# Pages are kept in cache/ with their ETag; a page is downloaded again only
# when metabot.gg says it changed (a "304 Not Modified" costs no download).
# One request every 1.5 s, well under their ~60 a minute. Their terms allow
# reusing the data with a link to each page it came from, which the plugin
# shows under every pet.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
CACHE="$HERE/cache"
OUT="$HERE/../../plugins/pet-souls/sources.js"
UA="A2Tools Pet Soul Tracker data (github.com/taengu/A2Tools-Plugins)"
mkdir -p "$CACHE/pages"

# The soul pages, from the item sitemaps (new pets show up here).
: > "$CACHE/urls.txt"
for map in aion-2-items-1 aion-2-items-2; do
    xml="$(curl -fsS -m 30 -A "$UA" "https://metabot.gg/sitemaps/$map.xml")"
    # A sitemap may hold no soul pages at all.
    grep -o '<loc>[^<]*/en/aion-2/items/soul-[^<]*</loc>' <<<"$xml" | sed 's/<[^>]*>//g' >> "$CACHE/urls.txt" || true
    sleep 1.5
done
sort -u -o "$CACHE/urls.txt" "$CACHE/urls.txt"

fetched=0 same=0 failed=0
while read -r url; do
    name="$(basename "$url")"
    page="$CACHE/pages/$name.html" etag="$CACHE/pages/$name.etag" tmp="$CACHE/pages/$name.tmp"
    args=(-s -m 30 -A "$UA" -o "$tmp" -w '%{http_code}' --etag-save "$etag.new")
    [ -s "$page" ] && [ -s "$etag" ] && args+=(--etag-compare "$etag")
    code="$(curl "${args[@]}" "$url" || echo 000)"
    case "$code" in
        200) mv "$tmp" "$page"; mv "$etag.new" "$etag"; fetched=$((fetched + 1)) ;;
        304) rm -f "$tmp" "$etag.new"; same=$((same + 1)) ;;
        *) rm -f "$tmp" "$etag.new"; failed=$((failed + 1)); echo "failed ($code): $url" >&2 ;;
    esac
    sleep 1.5
done < "$CACHE/urls.txt"
echo "pages: $fetched downloaded, $same unchanged, $failed failed"

python3 -I "$HERE/build.py" "$CACHE/pages" "$HERE/../../plugins/pet-souls/pets.js" > "$OUT"
echo "wrote $OUT"

"""Build the al-folio post (2026-11-05-weight-games.md) from preview.html.

Usage: python make_post.py   (run inside the post folder)

The body of preview.html is copied unchanged, minus the title and subtitle (al-folio takes those from
the front matter). The front matter, a small width override for this post and the script tags are added.
"""
import re

TOC_SKIP = {"Task 1"}

s = open("preview.html").read()
body = s[s.index("<main>") + len("<main>"):s.index("</main>")]
body = re.sub(r"\s*<h1 class=\"l-body\">.*?</h1>\s*", "\n", body, count=1, flags=re.S)
m = re.search(r"\s*<p class=\"subtitle l-body\">(.*?)</p>\s*", body, flags=re.S)
desc = m.group(1)
body = body[:m.start()] + "\n" + body[m.end():]

q = lambda t: '"' + t.replace("\\", "\\\\").replace('"', '\\"') + '"'
h2 = [re.sub("<[^>]+>", "", x) for x in re.findall(r"<h2 class=\"l-body\"[^>]*>(.*?)</h2>", body)]
front = [
    "---",
    "layout: distill",
    "title: " + q("You can also read raw network weights!"),
    "description: " + q(desc),
    "tags: code artificial-intelligence",
    "date: 2026-11-05",
    "authors:",
    "  - name: " + q("Raymond Fan"),
    "    affiliations:",
    "      name: FLAB",
    "      url: https://flab.world/",
    "toc:",
] + ["  - name: " + q(h) for h in h2 if h not in TOC_SKIP] + ["---", ""]

width = """
<style>
  /* This post only: text and figures share one wider column, from the text's left edge to the
     right edge of the page column (888px on a wide screen instead of 704px for text). The
     table of contents keeps its place on the left. */
  @media (min-width: 1000px) {
    d-article > *:not(d-contents) { grid-column: text-start / page-end !important; }
  }
</style>
"""

scripts = """
<!-- The weights, then the drawing code. ?v= changes on every build, so readers never get a stale copy. -->
""" + "".join(
    f"<script defer src=\"{n}.js?v={{{{ site.time | date: '%s' }}}}\"></script>\n"
    for n in ["net1", "net2", "net3", "net4", "diff1", "diff2", "diff3", "weight-viz"]
)

md = "\n".join(front) + width + "\n" + body.strip() + "\n" + scripts
md = re.sub(r"\n{3,}", "\n\n", md)
open("2026-11-05-weight-games.md", "w").write(md)
print("wrote 2026-11-05-weight-games.md;", len(h2), "sections,", sum(h not in TOC_SKIP for h in h2), "in the TOC")

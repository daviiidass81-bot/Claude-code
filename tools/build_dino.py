"""Builds a single self-contained HTML file for Dino Island Builder: python3 tools/build_dino.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = root / 'dino-island'
html = (src / 'index.html').read_text(encoding='utf-8')
def inline_css(m):
    return '<style>\n' + (src / m.group(1)).read_text(encoding='utf-8') + '\n</style>'
html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">', inline_css, html)
def inline(m):
    js = (src / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>'
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
out = root / 'Dino-Island-Builder.html'
out.write_text(html, encoding='utf-8')
print('written:', out, round(len(html) / 1024), 'KB')

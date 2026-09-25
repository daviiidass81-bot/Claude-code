"""Baut eine einzelne, eigenständige HTML-Datei: python3 tools/build.py"""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'css/style.css').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
def inline(m):
    js = (root / m.group(1)).read_text(encoding='utf-8')
    return '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>'
html = re.sub(r'<script src="(js/[^"]+)"></script>', inline, html)
out = root / 'Neon-Nights-Casino.html'
out.write_text(html, encoding='utf-8')
print('geschrieben:', out, round(len(html) / 1024), 'KB')

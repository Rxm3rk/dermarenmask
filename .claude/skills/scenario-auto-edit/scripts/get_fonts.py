#!/usr/bin/env python3
"""Download the three type families the edit uses from the public google/fonts repository.

usage: python get_fonts.py [--dest DIR] [--force] [--check]

Fonts (all SIL Open Font License 1.1, each saved next to its OFL text):
  Oswald[wght].ttf                display type (rendered at weight 700)
  InstrumentSans[wdth,wght].ttf   captions and labels (weights 700 and 400)
  InstrumentSerif-Regular.ttf     emphasis words

Default folder: $AUTOEDIT_FONTS, else ~/.cache/scenario-auto-edit/fonts (pro.py reads the same place).
The files come from one pinned commit of github.com/google/fonts and are checked against their
SHA-256, so every machine renders the same glyphs. Safe to run again: files that are already
present and correct are kept; a file that differs is only replaced with --force.
"""
import argparse, hashlib, os, shutil, subprocess, sys, tempfile, urllib.parse, urllib.request

COMMIT = '2c605eeda2de57af2b34822b79986f5140299862'
BASE = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/'
FILES = [  # (path in google/fonts, local name, sha256)
    ('ofl/oswald/Oswald[wght].ttf', 'Oswald[wght].ttf',
     '5b38c246e255a12f5712d640d56bcced0472466fc68983d2d0410ec0457c2817'),
    ('ofl/oswald/OFL.txt', 'Oswald-OFL.txt',
     '0fd731a904b729a4e02eaf5e8ebd06783edd9abe400e8882760160230675b652'),
    ('ofl/instrumentsans/InstrumentSans[wdth,wght].ttf', 'InstrumentSans[wdth,wght].ttf',
     'b24f1812584816958afcf22e22d08e44318c5e51651e25d2438efdde389b33b1'),
    ('ofl/instrumentsans/OFL.txt', 'InstrumentSans-OFL.txt',
     '9e27a72ed30eb49a08678f6a5d6ed98ec7ba5368f541637ee0683ec9134ef966'),
    ('ofl/instrumentserif/InstrumentSerif-Regular.ttf', 'InstrumentSerif-Regular.ttf',
     '498efd461f6ddfcb7a111bf9a565709d2085d48201d501ead960d93e84ffbb88'),
    ('ofl/instrumentserif/OFL.txt', 'InstrumentSerif-OFL.txt',
     '129ed7618959716959f2941fdd5b49e0ad6e6c1d78726761786a00253d865521'),
]


def default_dest():
    return os.environ.get('AUTOEDIT_FONTS') or os.path.join(os.path.expanduser('~'), '.cache', 'scenario-auto-edit', 'fonts')


def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 16), b''):
            h.update(block)
    return h.hexdigest()


def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=60) as r:
            return r.read()
    except Exception as error:
        # Some Python builds on macOS ship without CA certificates; curl uses the system store.
        if shutil.which('curl'):
            r = subprocess.run(['curl', '-fsSL', '--max-time', '120', url], capture_output=True)
            if r.returncode == 0:
                return r.stdout
        raise RuntimeError(f'could not download {url}: {error}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--dest', default=default_dest(), help='folder for the fonts (default: %(default)s)')
    ap.add_argument('--force', action='store_true', help='replace files whose contents differ from the pinned ones')
    ap.add_argument('--check', action='store_true', help='only report what is missing or different; download nothing')
    a = ap.parse_args()
    dest = os.path.abspath(os.path.expanduser(a.dest))
    if not a.check:
        os.makedirs(dest, exist_ok=True)
    problems = 0
    for path, name, digest in FILES:
        target = os.path.join(dest, name)
        existed = os.path.exists(target)
        if existed:
            if sha256(target) == digest:
                print(f'ok        {name}')
                continue
            if a.check or not a.force:
                print(f'differs   {name} (pass --force to replace it)')
                problems += 1
                continue
        elif a.check:
            print(f'missing   {name}')
            problems += 1
            continue
        try:
            data = fetch(BASE + urllib.parse.quote(path))
        except RuntimeError as error:
            print(f'error     {name}: {error}', file=sys.stderr)
            problems += 1
            continue
        if hashlib.sha256(data).hexdigest() != digest:
            print(f'error     {name}: downloaded file does not match the pinned SHA-256; nothing written', file=sys.stderr)
            problems += 1
            continue
        fd, tmp = tempfile.mkstemp(dir=dest, prefix='.part-')
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
        os.replace(tmp, target)
        print(f'{"replaced" if existed else "fetched "}  {name}')
    print(f'fonts folder: {dest}')
    if problems:
        sys.exit(1)


if __name__ == '__main__':
    main()

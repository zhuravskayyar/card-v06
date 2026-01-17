#!/usr/bin/env python3
from PIL import Image
import glob, os

def main():
    folder = os.path.join(os.path.dirname(__file__), '..', 'assets', 'cards')
    folder = os.path.abspath(folder)
    patterns = [os.path.join(folder, '*.[jJ][pP][gG]'), os.path.join(folder, '*.[jJ][pP][eE][gG]')]
    paths = []
    for p in patterns:
        paths.extend(glob.glob(p))
    if not paths:
        print('NO_JPG_FILES')
        return 0

    for path in paths:
        try:
            base, ext = os.path.splitext(path)
            out = base + '.png'
            print('Converting', path, '->', out)
            im = Image.open(path).convert('RGBA')
            im.save(out, optimize=True)
            os.remove(path)
            print('OK:', out)
        except Exception as e:
            print('ERROR converting', path, e)
    return 0

if __name__ == '__main__':
    raise SystemExit(main())

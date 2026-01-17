#!/usr/bin/env python
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print('PIL missing')
    sys.exit(2)

if len(sys.argv) < 5:
    print('Usage: process_image.py input output width height')
    sys.exit(1)

inp = Path(sys.argv[1])
out = Path(sys.argv[2])
W = int(sys.argv[3])
H = int(sys.argv[4])

if not inp.exists():
    print('Input not found:', inp)
    sys.exit(1)

img = Image.open(inp).convert('RGBA')
# Resize to cover (crop if necessary)
ratio = max(W / img.width, H / img.height)
new_size = (int(img.width * ratio), int(img.height * ratio))
img = img.resize(new_size, Image.LANCZOS)
# center crop
left = (img.width - W) // 2
top = (img.height - H) // 2
img = img.crop((left, top, left + W, top + H))

# Save with optimization
img.save(out, format='PNG', optimize=True)
print('Saved', out)

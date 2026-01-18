import os
import sys
from pathlib import Path
import shutil

root = Path(__file__).resolve().parent.parent
cards_dir = root / 'cards'
assets_dir = root / 'assets' / 'cards'
assets_dir.mkdir(parents=True, exist_ok=True)

# collect files in cards/ (case-insensitive) to move/convert
candidates = list(cards_dir.glob('*'))

try:
    from PIL import Image
    have_pil = True
except Exception:
    have_pil = False

moved = []

for p in candidates:
    if not p.is_file():
        continue
    name = p.stem.lower()  # without suffix, lowercased
    target = assets_dir / f"{name}.png"
    try:
        if p.suffix.lower() in ('.jpg', '.jpeg') and have_pil:
            with Image.open(p) as im:
                im.save(target, format='PNG')
            p.unlink()
            moved.append((str(p), str(target)))
        elif p.suffix.lower() == '.png':
            shutil.copy2(p, target)
            p.unlink()
            moved.append((str(p), str(target)))
        else:
            # copy other extensions as-is
            shutil.copy2(p, target)
            p.unlink()
            moved.append((str(p), str(target)))
    except Exception as e:
        print(f"Failed to process {p}: {e}")

print('Moved/converted files:')
for src, dst in moved:
    print(f"{src} -> {dst}")

if not moved:
    print('No files moved.')

# Exit code 0

import os
import sys

root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
collection = sys.argv[1] if len(sys.argv) > 1 else 'F02'

# generate ids like F02-R1..F02-R6
ids = [f"{collection}-R{i}" for i in range(1, 7)]

for id in ids:
    found = []
    up = id.upper()
    low = id.lower()
    candidates = [
        f'assets/cards/{up}.png',
        f'assets/cards/{up}.jpg',
        f'assets/cards/{low}.png',
        f'assets/cards/{low}.jpg',
        f'assets/cards/{id}.png',
        f'assets/cards/{id}.jpg',
        f'cards/{low}.png',
        f'cards/{low}.jpg',
        f'cards/{id}.png',
        f'cards/{id}.jpg',
    ]
    for c in candidates:
        if os.path.exists(os.path.join(root, c)):
            found.append(c)
    if found:
        print(f"{id}: FOUND -> {', '.join(found)}")
    else:
        print(f"{id}: MISSING")

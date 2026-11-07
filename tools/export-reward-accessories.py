"""Crop and size generated PNG assets, preserving their existing RGBA pixels.

No drawing or color edits: ImageGen owns the artwork. Export alpha bounds and
slice metadata for a divider whose endcaps must not grow with dialog width.
"""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs/ui-style/sources/reward-accessories'
DEST = ROOT / 'tmp/asset-exports/reward-accessories'
DEST.mkdir(parents=True, exist_ok=True)
metadata = {}
for key, filename in [('selection', 'selection-mineral-muted-v2.png'), ('divider', 'divider-engraved-bluegray-v2.png')]:
    image = Image.open(SOURCE / f'{key}-source.png').convert('RGBA')
    alpha = image.getchannel('A')
    assert alpha.getextrema()[0] == 0, 'expected genuine transparent PNG'
    bounds = alpha.point(lambda a: 255 if a >= 32 else 0).getbbox()
    padding = 8 if key == 'selection' else 3
    x0, y0, x1, y1 = bounds
    crop = (max(0, x0-padding), max(0, y0-padding), min(image.width, x1+padding), min(image.height, y1+padding))
    image = image.crop(crop)
    if key == 'selection':
        image = image.resize((round(image.width * 512/image.height), 512), Image.Resampling.LANCZOS)
    else:
        # Keep the source's full horizontal pixel resolution for CSS three-slice.
        cap = round(image.width * .13)
        metadata['dividerCapPixels'] = cap
        central = image.getchannel('A').crop((cap, 0, image.width-cap, image.height))
        assert central.getbbox(), 'missing divider rule'
        metadata['dividerRuleBounds'] = central.getbbox()
    image.save(DEST / filename, optimize=True)
    metadata[key] = {'file': filename, 'crop': crop, 'width': image.width, 'height': image.height}
(DEST / 'export.json').write_text(json.dumps(metadata, indent=2)+'\n', encoding='utf-8')
print(json.dumps(metadata, indent=2))

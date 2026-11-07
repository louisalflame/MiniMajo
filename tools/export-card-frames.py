"""Export the three alpha-separated ImageGen borders per profession.

Only slice/size the supplied raster assets; no borders are painted by this tool.
Run with the bundled Python (Pillow). Originals remain beside the contact sheet.
"""
from pathlib import Path
import json
import argparse
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--jobs', nargs='+', choices=['melee', 'ranged', 'tank', 'healer'], default=['melee', 'ranged', 'tank', 'healer'])
args = parser.parse_args()
SOURCES = ROOT / 'docs/ui-style/sources/card-frames'
DEST = ROOT / 'tmp/asset-exports/card-frames'
DEST.mkdir(parents=True, exist_ok=True)
manifest = []
def export_size(image, size):
    # Uniform vertical scaling preserves jewel/corner proportions. Only the
    # two quiet stretches between corners and central jewel change in width.
    width, height = size
    scaled = image.resize((round(image.width * height / image.height), height), Image.Resampling.LANCZOS)
    edge, middle = round(height * .18), round(height * .18)
    src_mid = (scaled.width - middle) // 2
    dst_mid = (width - middle) // 2
    src = [0, edge, src_mid, src_mid + middle, scaled.width - edge, scaled.width]
    dst = [0, edge, dst_mid, dst_mid + middle, width - edge, width]
    assert all(b > a for a, b in zip(src, src[1:])), 'frame too narrow for fixed parts'
    result = Image.new(image.mode, size)
    for a, b, x, y in zip(src, src[1:], dst, dst[1:]):
        strip = scaled.crop((a, 0, b, height)).resize((y - x, height), Image.Resampling.LANCZOS)
        result.paste(strip, (x, 0))
    return result

for job in args.jobs:
    im = Image.open(SOURCES / (job + '-source.png')).convert('RGBA')
    alpha = im.getchannel('A')
    solid = alpha.point(lambda a: 255 if a >= 128 else 0)
    columns = [solid.crop((x, 0, x + 1, im.height)).histogram()[255] > 8 for x in range(im.width)]
    runs = []
    for x, occupied in enumerate(columns):
        if occupied and (x == 0 or not columns[x - 1]):
            start = x
        if occupied and (x == im.width - 1 or not columns[x + 1]):
            if x - start > 30:
                runs.append((start, x + 1))
    if len(runs) != 3:
        raise ValueError(f'{job}: expected three separate borders, got {runs}')
    y0, y1 = solid.getbbox()[1::2]
    for i, ((x0, x1), rarity) in enumerate(zip(runs, ('sr', 'ssr', 'ur'))):
        if job == 'healer':
            # Align actual painted top/bottom, not just equal-sized PNG canvases.
            y0, y1 = solid.crop((x0, 0, x1, im.height)).getbbox()[1::2]
        box = (max(0, x0 - 2), max(0, y0 - 2), min(im.width, x1 + 2), min(im.height, y1 + 2))
        cropped = im.crop(box)
        # Extract the enclosed transparent window so art cannot leak outside
        # rounded shoulders / arrow tips. Keep the generated border untouched.
        window = cropped.getchannel('A').point(lambda a: 255 if a >= 32 else 0)
        ImageDraw.floodfill(window, (window.width // 2, window.height // 2), 128)
        assert window.getpixel((0, 0)) != 128, f'{job}: open border cannot contain artwork'
        window = window.point(lambda a: 255 if a == 128 else 0)
        # V2 is authored closer to actual 134/274/415px by 200px card aspect ratios.
        size = (432 * (i + 1), 640)
        frame = export_size(cropped, size)
        # ImageGen can leave nearly invisible alpha=1 rounding noise in cutouts.
        assert frame.getpixel((frame.width // 2, frame.height // 2))[3] <= 8, f'{job}: opaque window'
        name = f'{job}-{rarity}.png'
        frame.save(DEST / name, optimize=True)
        export_size(window, size).save(DEST / f'{job}-{rarity}-window.png', optimize=True)
        manifest.append(dict(file=name, job=job, rarity=rarity.upper(), width=frame.width, height=frame.height, sourceCrop=box))
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest, indent=2))

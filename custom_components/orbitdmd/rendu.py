"""Image du panneau agrandie, avec l'aspect des LED (camera "Ecran en direct").

Chaque pixel du panneau devient un carre de SCALE x SCALE : une LED aux coins arrondis et un
espace noir autour. Pillow est fourni avec Home Assistant ; ces fonctions tournent dans un
fil d'execution a part (async_add_executor_job), car l'agrandissement d'une GIF prend du temps.
"""
from __future__ import annotations

import io
from functools import lru_cache

SCALE = 6           # 128 x 32 -> 768 x 192
MAX_FRAMES = 400    # au-dela, la GIF est coupee (taille de l'image envoyee au navigateur)


@lru_cache(maxsize=4)
def _gaps(width: int, height: int):
    """Masque des espaces entre les LED (255 = noir) pour une image de width x height LED."""
    from PIL import Image

    cell = Image.new("L", (SCALE, SCALE), 0)
    for i in range(SCALE):
        cell.putpixel((SCALE - 1, i), 255)       # espace a droite
        cell.putpixel((i, SCALE - 1), 255)       # espace en bas
    for x, y in ((0, 0), (SCALE - 2, 0), (0, SCALE - 2), (SCALE - 2, SCALE - 2)):
        cell.putpixel((x, y), 255)               # coins arrondis
    mask = Image.new("L", (width * SCALE, height * SCALE), 0)
    for y in range(height):
        for x in range(width):
            mask.paste(cell, (x * SCALE, y * SCALE))
    return mask


def led_png(bmp: bytes) -> bytes:
    """Copie de l'ecran du panneau (BMP) -> PNG agrandi."""
    from PIL import Image

    small = Image.open(io.BytesIO(bmp)).convert("RGB")
    big = small.resize((small.width * SCALE, small.height * SCALE), Image.Resampling.NEAREST)
    big.paste((0, 0, 0), mask=_gaps(small.width, small.height))
    out = io.BytesIO()
    big.save(out, format="PNG", optimize=True)
    return out.getvalue()


def led_gif(gif: bytes) -> bytes:
    """GIF du panneau -> GIF animee agrandie (memes durees d'image)."""
    from PIL import Image, ImageSequence

    src = Image.open(io.BytesIO(gif))
    mask = _gaps(src.width, src.height)
    small, durations = [], []
    for frame in ImageSequence.Iterator(src):
        small.append(frame.convert("RGB"))
        durations.append(max(20, int(frame.info.get("duration", 100) or 100)))
        if len(small) >= MAX_FRAMES:
            break
    # une seule palette pour toutes les images (la GIF ne garde alors que ce qui change d'une image
    # a l'autre) : 255 couleurs, la 256e (indice 255) est le noir des espaces entre les LED
    strip = Image.new("RGB", (src.width, src.height * len(small)))
    for i, rgb in enumerate(small):
        strip.paste(rgb, (0, i * src.height))
    palette = strip.quantize(colors=255)
    colors = (palette.getpalette() or [])[: 255 * 3]
    palette.putpalette(colors + [0] * (255 * 3 - len(colors)) + [0, 0, 0])
    frames = []
    for rgb in small:
        p = rgb.quantize(palette=palette, dither=Image.Dither.NONE)
        big = p.resize((src.width * SCALE, src.height * SCALE), Image.Resampling.NEAREST)
        big.paste(255, mask=mask)
        frames.append(big)
    out = io.BytesIO()
    frames[0].save(out, format="GIF", save_all=True, append_images=frames[1:], duration=durations, loop=0)
    return out.getvalue()

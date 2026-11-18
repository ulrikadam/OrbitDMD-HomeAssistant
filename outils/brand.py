"""Images de marque pour Home Assistant (2026.3 ou plus recent : dossier brand/ de l'integration).

Source : OrbitDMD.png (logo complet, fond transparent) du projet du panneau.
  icon.png 256x256, icon@2x.png 512x512 : l'embleme (orbite + grille) seul
  logo.png (hauteur 128), logo@2x.png (hauteur 256) : embleme + "OrbitDMD"
  dark_*.png : memes images, bleus eclaircis pour le theme sombre (couleurs de logo-sombre.png)

Utilisation : py -3.12 outils/brand.py <chemin de OrbitDMD.png>
"""
import os
import sys

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "custom_components", "orbitdmd", "brand")
EMBLEM_RIGHT = 600          # dans OrbitDMD.png (2172 px de large), le texte commence vers x = 615

# couleurs du logo -> version sombre (memes valeurs que dmd/web/logo-sombre.png)
DARK = {(1, 86, 208): (91, 155, 255), (1, 166, 196): (34, 198, 225)}


def trim(im: Image.Image) -> Image.Image:
    alpha = im.getchannel("A").point(lambda a: 255 if a > 24 else 0)
    return im.crop(alpha.getbbox())


def darken(im: Image.Image) -> Image.Image:
    """Bleus du logo eclaircis ; le reste (orange, transparence) inchange."""
    out = im.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            src, dst = min(DARK.items(), key=lambda kv: sum((c - k) ** 2 for c, k in zip((r, g, b), kv[0])))
            if sum((c - k) ** 2 for c, k in zip((r, g, b), src)) < 70 ** 2:
                px[x, y] = (*dst, a)
    return out


def square(im: Image.Image, size: int, margin: float = 0.06) -> Image.Image:
    inner = int(size * (1 - 2 * margin))
    scale = inner / max(im.size)
    small = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(small, ((size - small.width) // 2, (size - small.height) // 2), small)
    return canvas


def height(im: Image.Image, h: int) -> Image.Image:
    return im.resize((round(im.width * h / im.height), h), Image.LANCZOS)


def main() -> None:
    src = Image.open(sys.argv[1]).convert("RGBA")
    logo = trim(src)
    emblem = trim(src.crop((0, 0, EMBLEM_RIGHT, src.height)))
    os.makedirs(OUT, exist_ok=True)
    for prefix, conv in (("", lambda i: i), ("dark_", darken)):
        e, l = conv(emblem), conv(logo)
        square(e, 256).save(os.path.join(OUT, f"{prefix}icon.png"), optimize=True)
        square(e, 512).save(os.path.join(OUT, f"{prefix}icon@2x.png"), optimize=True)
        height(l, 128).save(os.path.join(OUT, f"{prefix}logo.png"), optimize=True)
        height(l, 256).save(os.path.join(OUT, f"{prefix}logo@2x.png"), optimize=True)
    for f in sorted(os.listdir(OUT)):
        im = Image.open(os.path.join(OUT, f))
        print(f, im.size, os.path.getsize(os.path.join(OUT, f)))


if __name__ == "__main__":
    main()

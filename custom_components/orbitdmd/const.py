"""Constantes de l'integration OrbitDMD."""
from datetime import timedelta

DOMAIN = "orbitdmd"
MANUFACTURER = "OrbitDMD"

CONF_HOST = "host"
CONF_PASSWORD = "password"
CONF_PANEL_ID = "panel_id"      # numero de serie du Raspberry Pi (/api/etat "id", panneau 1.6.0+)

# version minimale du programme du panneau (/api/notification, /api/luminosite, "id")
MIN_PANEL_VERSION = "1.6.0"
RELEASES_URL = "https://github.com/ulrikadam/OrbitDMD/releases/latest"

SCAN_INTERVAL = timedelta(seconds=5)          # etat du panneau
GIF_REFRESH = timedelta(minutes=5)            # liste des GIF (actions, liste deroulante)

# effets d'arrivee du texte (noms du panneau, Texte_Effet)
EFFECTS = ["defile", "inverse", "monte", "descend", "lettres", "pluie", "fondu"]
# couleurs connues du panneau (noms acceptes dans toutes les langues ; aussi RRGGBB)
COLORS = ["blanc", "rouge", "orange", "ambre", "jaune", "vert", "turquoise", "bleu", "violet", "rose", "arc-en-ciel"]

# categorie de GIF proposee en premier dans les listes (GIF de notification)
NOTIFY_CATEGORY = "Domotique"

SERVICE_NOTIFY = "notify"
ATTR_DEVICE = "device_id"
ATTR_MESSAGE = "message"
ATTR_GIF = "gif"
ATTR_EFFECT = "effect"
ATTR_COLOR = "color"
ATTR_SPEED = "speed"
ATTR_PASSES = "passes"
ATTR_FONT = "font"
ATTR_SIZE = "size"
ATTR_BLINK = "blink"


def version_tuple(version: str | None) -> tuple[int, ...]:
    """"1.6.0" -> (1, 6, 0) ; inconnu -> (0,)"""
    try:
        return tuple(int(x) for x in str(version).split(".")[:3])
    except (TypeError, ValueError):
        return (0,)


def panel_too_old(version: str | None) -> bool:
    return version_tuple(version) < version_tuple(MIN_PANEL_VERSION)


def panel_id(status: dict) -> str:
    """Identifiant stable du panneau : numero de serie (1.6.0+), sinon son nom."""
    return str(status.get("id") or "").lower() or str(status.get("nom") or "OrbitDMD").lower()

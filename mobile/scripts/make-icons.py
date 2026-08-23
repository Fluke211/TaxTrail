#!/usr/bin/env python3
"""Generate every app icon asset from one definition.

Run: python3 scripts/make-icons.py   (needs Pillow; nothing else imports this)

The icons used to be opaque binaries nobody could adjust — the Android
foreground was still Expo's default blue chevron, unrelated to the app. Keeping
the artwork as code means the next tweak is a diff, not a redraw.

Design notes, so the choices are not re-litigated:
  * The receipt is cut at BOTH ends, like a strip torn from a till roll.
  * The teeth are shallow and numerous. Deep teeth read as damaged paper at
    icon size — that was the bug this replaced (see DECISIONS.md D-038).
  * Notches are carved INTO the card, never drawn hanging off it, so the
    silhouette stays whole.
  * Corners are square where the cut edges are, because rounding fights a cut.
"""
from PIL import Image, ImageDraw

S = 1024
BG_TOP, BG_BOT = (23, 37, 74), (8, 13, 28)
PAPER  = (244, 247, 252)
INK    = (17, 24, 39)
MUTED  = (148, 163, 184)
ACCENT = (79, 118, 246)
CUT    = (11, 18, 38)
FLAT_BG = (15, 23, 42)          # #0f172a — matches app.json splash/adaptive

CARD_L, CARD_R, CARD_T, CARD_B = 286, 738, 214, 786
TEETH, DEPTH = 32, 18           # variant B4

def _bg(d):
    for y in range(S):
        t = y / S
        d.line([(0, y), (S, y)],
               fill=tuple(int(BG_TOP[i] + (BG_BOT[i]-BG_TOP[i])*t) for i in range(3)))

def _brackets(d):
    m, L, w = 76, 118, 26
    for (x, y, dx, dy) in [(m,m,1,1), (S-m,m,-1,1), (m,S-m,1,-1), (S-m,S-m,-1,-1)]:
        d.line([(x, y), (x+dx*L, y)], fill=ACCENT, width=w)
        d.line([(x, y), (x, y+dy*L)], fill=ACCENT, width=w)
        d.ellipse([x-w//2, y-w//2, x+w//2, y+w//2], fill=ACCENT)

def _notch(d, edge_y, downward, colour):
    step = (CARD_R - CARD_L) / TEETH
    for i in range(TEETH):
        if i % 2: continue
        x0 = CARD_L + i*step
        apex   = edge_y + DEPTH if downward else edge_y - DEPTH
        y_edge = edge_y - 2     if downward else edge_y + 2
        d.polygon([(x0, y_edge), (x0+step, y_edge), (x0+step/2, apex)], fill=colour)

def _card(d, cut_colour, paper=PAPER, content=True):
    d.rounded_rectangle([CARD_L, CARD_T, CARD_R, CARD_B], radius=48,
                        fill=paper, corners=(False, False, True, True))
    _notch(d, CARD_B, False, cut_colour)
    _notch(d, CARD_T, True,  cut_colour)
    if not content: return
    cx0, cx1 = CARD_L + 66, CARD_R - 66
    d.rounded_rectangle([cx0, 300, cx1-10, 340], radius=20, fill=INK)
    y = 400
    for w in (1.00, 0.84, 1.00):
        d.rounded_rectangle([cx0, y, cx0+(cx1-cx0)*w, y+26], radius=13, fill=MUTED)
        y += 60
    y += 22
    d.rounded_rectangle([cx0, y, cx0+186, y+44], radius=22, fill=ACCENT)
    d.rounded_rectangle([cx1-96, y, cx1, y+44], radius=22, fill=ACCENT)

def full_icon():
    im = Image.new("RGB", (S, S)); d = ImageDraw.Draw(im)
    _bg(d); _brackets(d); _card(d, CUT)
    return im

def receipt_only(mono=False):
    """Transparent background, no brackets — for Android's adaptive foreground,
    whose outer edge is masked away by the launcher."""
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    _card(d, (0, 0, 0, 0), paper=(255,255,255,255) if mono else PAPER, content=not mono)
    # Android masks the outer edge, leaving roughly the inner 66% guaranteed
    # visible. Crop to the card and re-fit it so it FILLS that safe zone —
    # scaling the whole canvas instead just shrinks the card into a speck,
    # which is what the first attempt at this did.
    card = im.crop((CARD_L, CARD_T, CARD_R, CARD_B))
    target_h = int(S * 0.60)
    target_w = int(card.width * target_h / card.height)
    card = card.resize((target_w, target_h), Image.LANCZOS)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(card, ((S - target_w)//2, (S - target_h)//2), card)
    return out

if __name__ == "__main__":
    import os
    here = os.path.join(os.path.dirname(__file__), "..", "assets")
    icon = full_icon()
    icon.save(os.path.join(here, "icon.png"))
    icon.save(os.path.join(here, "splash-icon.png"))

    fg = receipt_only()
    fg.resize((512, 512), Image.LANCZOS).save(os.path.join(here, "adaptive-icon.png"))
    fg.resize((512, 512), Image.LANCZOS).save(os.path.join(here, "android-icon-foreground.png"))

    bg = Image.new("RGBA", (512, 512), FLAT_BG + (255,))
    bg.save(os.path.join(here, "android-icon-background.png"))

    receipt_only(mono=True).resize((432, 432), Image.LANCZOS)\
        .save(os.path.join(here, "android-icon-monochrome.png"))

    icon.convert("RGBA").resize((48, 48), Image.LANCZOS)\
        .save(os.path.join(here, "favicon.png"))
    print("wrote every asset in", os.path.normpath(here))

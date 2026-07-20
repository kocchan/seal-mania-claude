#!/usr/bin/env python3
"""
ComfyUI生成イラストに日本語テキストを合成してブログサムネを完成させる。
（SD系モデルは日本語が描けないため、文字はPillowでフォント描画する）

使い方:
  python3 compose-text.py input.png output.png --title めじるしアクセサリー --badge 7月新作 --price 300円

出力: 1200x675 (16:9) PNG
  - 上部: 白ふち付きタイトル（丸ゴシック）
  - 右上: ピンクのスターバースト風「◯月新作」バッジ
  - 左下: 値札風の価格タグ（指定時のみ）
"""
import argparse
import math
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 675

# 同梱フォント（CI/ローカル共通で同じ見た目にする）→ 無ければmacOS標準へフォールバック
import os
_HERE = os.path.dirname(os.path.abspath(__file__))
FONT_CANDIDATES = [
    os.path.join(_HERE, '..', '..', 'assets', 'fonts', 'ZenMaruGothic-Bold.ttf'),
    '/System/Library/Fonts/ヒラギノ丸ゴ ProN W4.ttc',
    '/System/Library/Fonts/Hiragino Sans GB.ttc',
    '/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc',
    '/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc',
    '/Library/Fonts/Arial Unicode.ttf',
]


def load_font(size):
    for p in FONT_CANDIDATES:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            continue
    return ImageFont.load_default()


def draw_text_outline(draw, xy, text, font, fill, outline, width=6, anchor=None):
    x, y = xy
    for dx in range(-width, width + 1, 2):
        for dy in range(-width, width + 1, 2):
            if dx * dx + dy * dy <= width * width:
                draw.text((x + dx, y + dy), text, font=font, fill=outline, anchor=anchor)
    draw.text((x, y), text, font=font, fill=fill, anchor=anchor)


def draw_starburst(draw, cx, cy, r_out, r_in, n, fill, outline):
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.pi * i / n - math.pi / 2
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    draw.polygon(pts, fill=fill, outline=outline, width=4)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('output')
    ap.add_argument('--title', default='めじるしアクセサリー')
    ap.add_argument('--badge', default='新作')
    ap.add_argument('--price', default='')
    args = ap.parse_args()

    # ベース画像を16:9にリサイズ（cover）
    im = Image.open(args.input).convert('RGB')
    scale = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - W) // 2
    top = (im.height - H) // 2
    im = im.crop((left, top, left + W, top + H))

    draw = ImageDraw.Draw(im)

    # --- タイトル（上部・白ふち＋ピンク文字） ---
    # バッジ（右上）と重ならないよう、フォントの自動縮小＋中心の左シフトを行う
    badge_zone = 290 if args.badge else 40   # 右端の確保幅
    left_margin = 40
    size = 88
    title_font = load_font(size)
    while size > 48 and draw.textlength(args.title, font=title_font) > W - left_margin - badge_zone:
        size -= 4
        title_font = load_font(size)
    tw = draw.textlength(args.title, font=title_font)
    cx = W // 2
    # 中央配置で右端がバッジ域に食い込むなら、食い込まない位置まで左へ
    max_cx = W - badge_zone - tw / 2
    cx = int(min(cx, max_cx))
    cx = max(cx, int(left_margin + tw / 2))
    draw_text_outline(
        draw, (cx, 30), args.title, title_font,
        fill=(232, 80, 136), outline=(255, 255, 255), width=8, anchor='ma')

    # --- 新作バッジ（右上・黄色スターバースト） ---
    if args.badge:
        bx, by = W - 150, 170
        draw_starburst(draw, bx, by, 105, 82, 12,
                       fill=(255, 232, 120), outline=(240, 160, 60))
        badge_font = load_font(44)
        lines = args.badge if len(args.badge) <= 3 else args.badge.replace('月', '月\n')
        draw.multiline_text((bx, by), lines, font=badge_font,
                            fill=(210, 60, 90), anchor='mm', align='center', spacing=4)

    # --- 価格タグ（左下・白い値札） ---
    if args.price:
        price_font = load_font(40)
        tw = draw.textlength(args.price, font=price_font)
        pad, tag_h = 22, 64
        x0, y0 = 34, H - tag_h - 30
        x1 = x0 + tw + pad * 2 + 26
        draw.rounded_rectangle([x0, y0, x1, y0 + tag_h], radius=12,
                               fill=(255, 255, 255), outline=(180, 180, 190), width=3)
        # 値札の穴とヒモ風
        draw.ellipse([x0 + 10, y0 + tag_h / 2 - 7, x0 + 24, y0 + tag_h / 2 + 7],
                     fill=(240, 240, 244), outline=(180, 180, 190), width=3)
        draw.text((x0 + 36, y0 + tag_h / 2), args.price, font=price_font,
                  fill=(60, 60, 66), anchor='lm')

    im.save(args.output, 'PNG', optimize=True)
    print(f'composed: {args.output} ({W}x{H})')


if __name__ == '__main__':
    main()

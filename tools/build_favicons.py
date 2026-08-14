import cv2
import numpy as np
from PIL import Image

def generate_favicons():
    img = cv2.imread('redesign/public/img/logo.png', cv2.IMREAD_UNCHANGED)
    h, w = img.shape[:2]
    
    # Red emblem crop
    red_crop = img[0:54, 208:268]
    is_red = (red_crop[:, :, 2] > 130) & (red_crop[:, :, 0] < 70) & (red_crop[:, :, 1] < 60) & (red_crop[:, :, 3] > 80)

    # 1. Generate crisp SVG favicon
    scale = 8
    mask_hi = cv2.resize(is_red.astype(np.uint8) * 255, (60 * scale, 54 * scale), interpolation=cv2.INTER_CUBIC)
    _, mask_bin = cv2.threshold(mask_hi, 127, 255, cv2.THRESH_BINARY)
    contours, hier = cv2.findContours(mask_bin, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_L1)

    approx = cv2.approxPolyDP(contours[0], 0.4, True)
    pts = approx[:, 0, :] / scale

    min_x, min_y = pts[:, 0].min(), pts[:, 1].min()
    max_x, max_y = pts[:, 0].max(), pts[:, 1].max()
    cw = max_x - min_x
    ch = max_y - min_y

    target_size = 52.0
    s = target_size / max(cw, ch)
    pts_scaled = (pts - [min_x, min_y]) * s
    ox = (64.0 - cw * s) / 2
    oy = (64.0 - ch * s) / 2
    pts_final = pts_scaled + [ox, oy]

    cmd = [f"M {pts_final[0][0]:.2f} {pts_final[0][1]:.2f}"]
    for pt in pts_final[1:]:
        cmd.append(f"L {pt[0]:.2f} {pt[1]:.2f}")
    cmd.append("Z")
    path_d = " ".join(cmd)

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" fill="none">
  <path fill="#a9122b" fill-rule="evenodd" d="{path_d}" />
</svg>'''

    with open('redesign/public/favicon.svg', 'w', encoding='utf-8') as f:
        f.write(svg)
    print("Created redesign/public/favicon.svg")

    # 2. Generate PNG and ICO assets
    canvas_size = 512
    canvas = np.zeros((canvas_size, canvas_size, 4), dtype=np.uint8)
    scale_factor = 7.5
    nw, nh = int(60 * scale_factor), int(54 * scale_factor)
    resized = cv2.resize(red_crop, (nw, nh), interpolation=cv2.INTER_CUBIC)

    pox = (canvas_size - nw) // 2
    poy = (canvas_size - nh) // 2
    canvas[poy:poy+nh, pox:pox+nw] = resized

    pil_icon_512 = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGRA2RGBA))
    
    pil_icon_180 = pil_icon_512.resize((180, 180), Image.Resampling.LANCZOS)
    pil_icon_180.save('redesign/public/apple-touch-icon.png', 'PNG')
    
    pil_icon_32 = pil_icon_512.resize((32, 32), Image.Resampling.LANCZOS)
    pil_icon_32.save('redesign/public/favicon-32x32.png', 'PNG')

    pil_icon_16 = pil_icon_512.resize((16, 16), Image.Resampling.LANCZOS)
    pil_icon_16.save('redesign/public/favicon-16x16.png', 'PNG')

    pil_icon_512.save('redesign/public/favicon.ico', format='ICO', sizes=[(16,16), (32,32), (48,48), (64,64)])
    print("Created favicon.ico and PNGs")

if __name__ == '__main__':
    generate_favicons()

import cv2
import numpy as np

def contours_to_svg_path(contours, hierarchy, scale=8.0):
    if contours is None or len(contours) == 0:
        return ""
    
    path_strings = []
    hierarchy = hierarchy[0]
    
    for i, cnt in enumerate(contours):
        # Approximate contour for smooth vector fidelity
        epsilon = 0.4
        approx = cv2.approxPolyDP(cnt, epsilon, True)
        if len(approx) < 3:
            continue
        
        pts = approx[:, 0, :] / scale
        start = pts[0]
        cmd = [f"M {start[0]:.2f} {start[1]:.2f}"]
        for pt in pts[1:]:
            cmd.append(f"L {pt[0]:.2f} {pt[1]:.2f}")
        cmd.append("Z")
        path_strings.append(" ".join(cmd))
        
    return " ".join(path_strings)

def generate_logos():
    img = cv2.imread('redesign/public/img/logo.png', cv2.IMREAD_UNCHANGED)
    h, w = img.shape[:2]
    
    alpha = img[:, :, 3]
    b, g, r = img[:, :, 0], img[:, :, 1], img[:, :, 2]
    
    is_red = (r > 130) & (b < 70) & (g < 60) & (alpha > 80)
    is_gray = (alpha > 80) & ~is_red
    
    scale = 8
    mask_red_hi = cv2.resize(is_red.astype(np.uint8) * 255, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)
    mask_gray_hi = cv2.resize(is_gray.astype(np.uint8) * 255, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)
    
    _, mask_red_bin = cv2.threshold(mask_red_hi, 127, 255, cv2.THRESH_BINARY)
    _, mask_gray_bin = cv2.threshold(mask_gray_hi, 127, 255, cv2.THRESH_BINARY)
    
    contours_red, hier_red = cv2.findContours(mask_red_bin, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_L1)
    contours_gray, hier_gray = cv2.findContours(mask_gray_bin, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_L1)
    
    path_red = contours_to_svg_path(contours_red, hier_red, scale=scale)
    path_gray = contours_to_svg_path(contours_gray, hier_gray, scale=scale)
    
    # 1. Main Color SVG
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" fill="none">
  <!-- Summit Asset Management Vector Logo -->
  <path fill="#686664" fill-rule="evenodd" d="{path_gray}" />
  <path fill="#a9122b" fill-rule="evenodd" d="{path_red}" />
</svg>'''
    
    with open('redesign/public/img/logo.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
    print("Created redesign/public/img/logo.svg")
    
    # 2. Footer Monochrome SVG (White / Inverted)
    svg_footer = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" fill="none">
  <!-- Summit Asset Management Footer Vector Logo -->
  <path fill="#ffffff" fill-rule="evenodd" d="{path_gray}" opacity="0.9" />
  <path fill="#a9122b" fill-rule="evenodd" d="{path_red}" />
</svg>'''
    
    with open('redesign/public/img/logo-footer.svg', 'w', encoding='utf-8') as f:
        f.write(svg_footer)
    print("Created redesign/public/img/logo-footer.svg")
    
    # 3. Generate high-resolution 2x & 3x PNGs for complete backwards compatibility
    from PIL import Image
    # High-res 2x (536x134) & 3x (804x201)
    img_pil = Image.open('redesign/public/img/logo.png')
    img_2x = img_pil.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
    img_2x.save('redesign/public/img/logo@2x.png', 'PNG')
    print("Created redesign/public/img/logo@2x.png")
    
    img_3x = img_pil.resize((w * 3, h * 3), Image.Resampling.LANCZOS)
    img_3x.save('redesign/public/img/logo@3x.png', 'PNG')
    print("Created redesign/public/img/logo@3x.png")

if __name__ == '__main__':
    generate_logos()

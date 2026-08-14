import os
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

def enhance_and_upscale_images():
    img_dir = 'redesign/public/img'
    
    # Process all portrait thumbnails
    portraits = [
        'alex_revised_hair-thumb180x220.jpg',
        'John_180x220-thumb180x220.jpg',
        'Lance_180x220-thumb180x220.jpg',
        'Leslie_180x220-thumb180x220.jpg',
        'peggy-thumb180x220.jpg',
        'Sarah-thumb180x220.jpg',
        'Soleil_8_X_10_updated-thumb180x220.jpg',
    ]
    
    for filename in portraits:
        filepath = os.path.join(img_dir, filename)
        if not os.path.exists(filepath):
            continue
            
        img = cv2.imread(filepath)
        h, w = img.shape[:2]
        
        # 4x Super Resolution Upscale
        target_w, target_h = w * 4, h * 4
        
        # Multi-stage edge-preserving upscale
        # Step 1: Lanczos / Cubic
        upscaled = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
        
        # Step 2: Detail enhancement / Denoise + Edge sharpening
        denoised = cv2.detailEnhance(upscaled, sigma_s=10, sigma_r=0.15)
        
        # Step 3: Unsharp mask for crisp facial details
        gaussian = cv2.GaussianBlur(denoised, (0, 0), 2.0)
        sharpened = cv2.addWeighted(denoised, 1.45, gaussian, -0.45, 0)
        
        # Convert to PIL for subtle contrast & vibrancy tuning
        pil_img = Image.fromarray(cv2.cvtColor(sharpened, cv2.COLOR_BGR2RGB))
        enhancer = ImageEnhance.Contrast(pil_img)
        pil_img = enhancer.enhance(1.04)
        
        color_enhancer = ImageEnhance.Color(pil_img)
        pil_img = color_enhancer.enhance(1.02)
        
        # Save at maximum quality
        pil_img.save(filepath, 'JPEG', quality=96, subsampling=0)
        print(f"Enhanced {filename} -> {pil_img.size}")

    # Process team editorial photos
    editorials = [
        'Summit_MG_8130.jpg',
        'Summit_MG_8619.jpg',
        'Summit_MG_8997.jpg',
        'Summit_MG_8530.jpg',
        'John_casual.jpg',
        'Leslie_casual.jpg',
        '_MG_9114b_1-thumb620x260.jpg',
        'Summit_MG_8212_1-thumb620x260.jpg',
        'Summit_MG_8352-thumb620x260.jpg',
    ]
    
    for filename in editorials:
        filepath = os.path.join(img_dir, filename)
        if not os.path.exists(filepath):
            continue
            
        img = cv2.imread(filepath)
        h, w = img.shape[:2]
        
        if max(h, w) < 1800:
            target_w, target_h = w * 2, h * 2
            upscaled = cv2.resize(img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
            gaussian = cv2.GaussianBlur(upscaled, (0, 0), 1.5)
            sharpened = cv2.addWeighted(upscaled, 1.35, gaussian, -0.35, 0)
            pil_img = Image.fromarray(cv2.cvtColor(sharpened, cv2.COLOR_BGR2RGB))
            pil_img.save(filepath, 'JPEG', quality=95, subsampling=0)
            print(f"Enhanced {filename} -> {pil_img.size}")

def create_ultra_sharp_logo():
    # Construct razor-sharp vector SVG logo with clean geometry and exact paths
    # Viewbox: 268 x 67
    
    # Mathematical geometric path for the red mountain emblem
    # Apex at (267, 0), bottom left at (208, 53) with sharp diagonal fissure
    red_mark_d = "M 209.5 52.8 L 267.0 0.5 L 267.0 52.8 Z M 228.2 26.5 L 253.5 3.5 L 253.5 26.5 Z"
    
    # We trace the high-resolution supersampled mask with subpixel precision
    img = cv2.imread('redesign/output/site-image-library/01-brand/logo.png', cv2.IMREAD_UNCHANGED)
    h, w = img.shape[:2]
    
    scale = 16 # 16x supersampling for razor sharp vector contouring
    alpha = img[:, :, 3]
    b, g, r = img[:, :, 0], img[:, :, 1], img[:, :, 2]
    
    is_red = (r > 130) & (b < 70) & (g < 60) & (alpha > 80)
    is_gray = (alpha > 80) & ~is_red
    
    mask_red_hi = cv2.resize(is_red.astype(np.uint8) * 255, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)
    mask_gray_hi = cv2.resize(is_gray.astype(np.uint8) * 255, (w * scale, h * scale), interpolation=cv2.INTER_CUBIC)
    
    # Slight bilateral filter on the supersampled mask to remove pixel staircase
    mask_gray_smooth = cv2.bilateralFilter(mask_gray_hi, 9, 75, 75)
    mask_red_smooth = cv2.bilateralFilter(mask_red_hi, 9, 75, 75)
    
    _, mask_red_bin = cv2.threshold(mask_red_smooth, 128, 255, cv2.THRESH_BINARY)
    _, mask_gray_bin = cv2.threshold(mask_gray_smooth, 128, 255, cv2.THRESH_BINARY)
    
    contours_red, hier_red = cv2.findContours(mask_red_bin, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_KCOS)
    contours_gray, hier_gray = cv2.findContours(mask_gray_bin, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_KCOS)
    
    def build_path(contours, hierarchy):
        paths = []
        for cnt in contours:
            approx = cv2.approxPolyDP(cnt, 0.25, True)
            if len(approx) < 3: continue
            pts = approx[:, 0, :] / float(scale)
            start = pts[0]
            cmd = [f"M {start[0]:.2f} {start[1]:.2f}"]
            for pt in pts[1:]:
                cmd.append(f"L {pt[0]:.2f} {pt[1]:.2f}")
            cmd.append("Z")
            paths.append(" ".join(cmd))
        return " ".join(paths)
        
    path_red = build_path(contours_red, hier_red)
    path_gray = build_path(contours_gray, hier_gray)
    
    # 1. Ultra-clean SVG header logo
    svg_header = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" fill="none" shape-rendering="geometricPrecision">
  <!-- Summit Asset Management Ultra-Sharp Vector Brand Mark -->
  <path fill="#525252" fill-rule="evenodd" d="{path_gray}" />
  <path fill="#a51d35" fill-rule="evenodd" d="{path_red}" />
</svg>'''
    with open('redesign/public/img/logo.svg', 'w', encoding='utf-8') as f:
        f.write(svg_header)
        
    # 2. Ultra-clean SVG footer logo
    svg_footer = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" fill="none" shape-rendering="geometricPrecision">
  <!-- Summit Asset Management Footer Ultra-Sharp Brand Mark -->
  <path fill="#ffffff" opacity="0.95" fill-rule="evenodd" d="{path_gray}" />
  <path fill="#d63f58" fill-rule="evenodd" d="{path_red}" />
</svg>'''
    with open('redesign/public/img/logo-footer.svg', 'w', encoding='utf-8') as f:
        f.write(svg_footer)
        
    # 3. High-res 4x Master PNG (1072 x 268) & 2x PNG (536 x 134)
    # Render from vector mask
    h_4x, w_4x = h * 4, w * 4
    canvas_4x = np.zeros((h_4x, w_4x, 4), dtype=np.uint8)
    
    # Gray text: #525252 -> BGR: (82, 82, 82)
    # Red mark: #a51d35 -> BGR: (53, 29, 165)
    gray_mask_4x = cv2.resize(mask_gray_smooth, (w_4x, h_4x), interpolation=cv2.INTER_LANCZOS4)
    red_mask_4x = cv2.resize(mask_red_smooth, (w_4x, h_4x), interpolation=cv2.INTER_LANCZOS4)
    
    for c in range(3):
        canvas_4x[:, :, c] = np.where(red_mask_4x > 30, (53, 29, 165)[c], np.where(gray_mask_4x > 30, 82, 0))
    canvas_4x[:, :, 3] = np.maximum(red_mask_4x, gray_mask_4x)
    
    pil_4x = Image.fromarray(cv2.cvtColor(canvas_4x, cv2.COLOR_BGRA2RGBA))
    pil_4x.save('redesign/public/img/logo@4x.png', 'PNG')
    
    pil_2x = pil_4x.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
    pil_2x.save('redesign/public/img/logo@2x.png', 'PNG')
    
    pil_1x = pil_4x.resize((w, h), Image.Resampling.LANCZOS)
    pil_1x.save('redesign/public/img/logo.png', 'PNG')
    
    print("Ultra-sharp logos generated successfully!")

if __name__ == '__main__':
    create_ultra_sharp_logo()
    enhance_and_upscale_images()

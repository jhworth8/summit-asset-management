"""Rebuild the Summit Asset Management logo as clean, curve-fitted vector art.

No vector original of the logo exists in the firm's PDFs (every letterhead embeds
a JPEG), so the artwork is reconstructed from the best raster available:

  * Shapes:   the 599x151 logo embedded in the March 2026 ADV brochure
              (redesign/public/letters/20260316_..._Brochure_March-2026.pdf).
              Same layout as the live-site logo, ~2.2x its resolution.
  * Weights,  the live-site PNG (site/sites/400/images/logo.png, 268x67).  The
    framing,  brochure copy is set noticeably bolder than the web/letterhead
    colours:  logo, so stroke weights are fitted back to the web PNG.

Pipeline
  1. ink-coverage maps from the anti-aliased brochure raster
  2. sub-pixel iso-contours (marching squares on a smoothly up-sampled map)
  3. per contour: corner detection -> straight edges (least-squares lines,
     near-axis edges snapped) or smooth cubic Beziers (Schneider fit);
     corners rebuilt as intersections of the fitted edges, so tips are sharp
  4. repeated letters (M, S, A, E, T, N) averaged into one shared shape
  5. stroke weight per text row fitted to the web PNG (edges moved inward,
     cap-height / baseline / stroke ends / pointed tips held), plus a
     scale+offset registration into the 268x67 web frame
  6. writes logo.svg, logo-footer.svg and logo.png / @2x / @3x / @4x

Run from anywhere:  python tools/build_svg_logo.py [--report DIR]
Requires: numpy opencv-python-headless scipy scikit-image pillow pymupdf resvg-py
"""
import argparse
import copy
import io
import math
import sys
from pathlib import Path

import cv2
import numpy as np
import pymupdf
import resvg_py
from PIL import Image
from scipy.signal import savgol_filter
from scipy.optimize import minimize, minimize_scalar
from skimage import measure

ROOT = Path(__file__).resolve().parents[1]
if '--root' in sys.argv:
    ROOT = Path(sys.argv[sys.argv.index('--root') + 1])
PDF = ROOT / 'redesign/public/letters/20260316_Summit-Asset-Management-LLC_Brochure_March-2026.pdf'
REF = ROOT / 'site/sites/400/images/logo.png'
OUT = ROOT / 'redesign/public/img'
W_OUT, H_OUT = 268, 67

# Footer variant sits on the dark navy footer (colours from the previous logo-footer.svg)
FOOTER_TEXT, FOOTER_TEXT_OPACITY, FOOTER_RED = '#ffffff', 0.95, '#d63f58'

TOP_LABELS = list('SUMMIT')
TAG_LABELS = list('ASSETMANAGEMENT')


# ===================================================================== source
def load_brochure_logo():
    doc = pymupdf.open(PDF)
    page = doc[0]
    best = max(page.get_images(full=True), key=lambda im: im[2] * im[3])
    pix = pymupdf.Pixmap(doc, best[0])
    if pix.n - pix.alpha != 3:
        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
    rgb = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[..., :3]
    return rgb.astype(np.float64)


def coverage_maps(rgb):
    R, G = rgb[..., 0], rgb[..., 1]
    Y = rgb @ [0.299, 0.587, 0.114]
    grey_ink = np.median(rgb[(Y < 140) & (np.abs(R - rgb[..., 2]) < 12)], 0)
    red_ink = np.median(rgb[(R - G) > 150], 0)
    Yg, Yr = grey_ink @ [0.299, 0.587, 0.114], red_ink @ [0.299, 0.587, 0.114]
    redness = np.clip((R - G) / (red_ink[0] - red_ink[1]), 0, 1)
    red_zone = cv2.dilate((redness > 0.25).astype(np.uint8), np.ones((7, 7), np.uint8)) > 0
    a_red = np.where(red_zone, np.clip((255 - Y) / (255 - Yr), 0, 1), 0)
    a_grey = np.where(red_zone, 0, np.clip((255 - Y) / (255 - Yg), 0, 1))
    return a_grey, a_red


def iso_contours(cov, up=4, sigma=0.5, level=0.5, pad=8):
    c = cv2.GaussianBlur(np.pad(cov, pad), (0, 0), sigma)
    cu = cv2.resize(c, None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
    out = []
    for cc in measure.find_contours(cu, level):
        pts = np.stack([(cc[:, 1] + 0.5) / up - pad, (cc[:, 0] + 0.5) / up - pad], 1)
        if np.allclose(pts[0], pts[-1]):
            pts = pts[:-1]
        if abs(signed_area(pts)) >= 4:          # drop JPEG specks
            out.append(pts)
    return out


# =================================================================== geometry
def signed_area(P):
    x, y = P[:, 0], P[:, 1]
    return 0.5 * np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y)


def resample_closed(P, ds):
    Q = np.vstack([P, P[:1]])
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T))])
    n = max(int(round(s[-1] / ds)), 8)
    t = np.linspace(0, s[-1], n, endpoint=False)
    return np.stack([np.interp(t, s, Q[:, 0]), np.interp(t, s, Q[:, 1])], 1), s[-1] / n


def resample_open(P, n):
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    t = np.linspace(0, s[-1], n)
    return np.stack([np.interp(t, s, P[:, 0]), np.interp(t, s, P[:, 1])], 1)


def fit_line(P):
    c = P.mean(0)
    _, _, vt = np.linalg.svd(P - c, full_matrices=False)
    res = (P - c) @ vt[1]
    return c, vt[0], np.abs(res).max()


def intersect(c1, d1, c2, d2):
    A = np.array([d1, -d2]).T
    if abs(np.linalg.det(A)) < 1e-9:
        return None
    return c1 + np.linalg.solve(A, c2 - c1)[0] * d1


def snap_dir(d, tol_deg=1.0):
    ang = math.degrees(math.atan2(d[1], d[0]))
    for target in (-180, -90, 0, 90, 180):
        if abs(ang - target) < tol_deg:
            a = math.radians(target)
            return np.array([math.cos(a), math.sin(a)])
    return d


def ink_normal(t):
    """Contours are oriented with positive signed area: interior is on the (-ty, tx) side."""
    return np.stack([-t[..., 1], t[..., 0]], -1)


# ============================================================ bezier fitting
def bez(ctrl, t):
    t = np.asarray(t)[:, None]
    p0, p1, p2, p3 = ctrl
    mt = 1 - t
    return mt ** 3 * p0 + 3 * mt ** 2 * t * p1 + 3 * mt * t ** 2 * p2 + t ** 3 * p3


def _gen_bezier(P, u, t1, t2):
    p0, p3 = P[0], P[-1]
    b0, b1, b2, b3 = (1 - u) ** 3, 3 * u * (1 - u) ** 2, 3 * u ** 2 * (1 - u), u ** 3
    A1, A2 = t1[None, :] * b1[:, None], t2[None, :] * b2[:, None]
    C = np.array([[np.sum(A1 * A1), np.sum(A1 * A2)], [np.sum(A1 * A2), np.sum(A2 * A2)]])
    tmp = P - ((b0 + b1)[:, None] * p0 + (b2 + b3)[:, None] * p3)
    X = np.array([np.sum(A1 * tmp), np.sum(A2 * tmp)])
    det = C[0, 0] * C[1, 1] - C[0, 1] ** 2
    seg = np.linalg.norm(p3 - p0)
    a1 = a2 = seg / 3
    if abs(det) > 1e-12:
        a1 = (X[0] * C[1, 1] - X[1] * C[0, 1]) / det
        a2 = (C[0, 0] * X[1] - C[0, 1] * X[0]) / det
    if min(a1, a2) < 1e-6 * seg or max(a1, a2) > 2 * seg:
        a1 = a2 = seg / 3
    return np.array([p0, p0 + t1 * a1, p3 + t2 * a2, p3])


def _reparam(ctrl, P, u):
    p0, p1, p2, p3 = ctrl
    uu = u[:, None]
    d = bez(ctrl, u) - P
    d1 = 3 * (1 - uu) ** 2 * (p1 - p0) + 6 * (1 - uu) * uu * (p2 - p1) + 3 * uu ** 2 * (p3 - p2)
    d2 = 6 * (1 - uu) * (p2 - 2 * p1 + p0) + 6 * uu * (p3 - 2 * p2 + p1)
    num, den = np.sum(d * d1, 1), np.sum(d1 * d1, 1) + np.sum(d * d2, 1)
    with np.errstate(divide='ignore', invalid='ignore'):
        return np.clip(np.where(np.abs(den) > 1e-12, u - num / den, u), 0, 1)


def fit_cubic(P, t1, t2, err, depth=0):
    """Schneider's algorithm; t1 points into the curve at P[0], t2 back into it at P[-1]."""
    if len(P) < 4:
        dist = np.linalg.norm(P[-1] - P[0]) / 3
        return [np.array([P[0], P[0] + t1 * dist, P[-1] + t2 * dist, P[-1]])]
    u = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))])
    u /= u[-1]
    ctrl = _gen_bezier(P, u, t1, t2)
    for it in range(31):
        dist = np.hypot(*(bez(ctrl, u) - P).T)
        split = int(np.argmax(dist))
        if dist[split] < err:
            return [ctrl]
        if dist[split] > err * 6 or it == 30:
            break
        u = _reparam(ctrl, P, u)
        ctrl = _gen_bezier(P, u, t1, t2)
    if depth > 12:
        return [ctrl]
    split = min(max(split, 2), len(P) - 3)
    k = max(1, min(10, split, len(P) - 1 - split))       # ~0.5 px either side
    tc = P[split - k] - P[split + k]
    tc /= np.linalg.norm(tc)
    return fit_cubic(P[:split + 1], t1, tc, err, depth + 1) + fit_cubic(P[split:], -tc, t2, err, depth + 1)


def end_tangent(P, length, at_start):
    """Unit tangent at an end of a point run (pointing into the run), from a
    quadratic fit over the last `length` of arc, so curving ends are not biased."""
    Q = P if at_start else P[::-1]
    s = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T))])
    m = min(max(int(np.searchsorted(s, length)), 4), len(Q) - 1)
    ss = s[:m + 1]
    if len(ss) >= 5 and ss[-1] > 0:
        dx = np.polyfit(ss, Q[:m + 1, 0], 2)[1]
        dy = np.polyfit(ss, Q[:m + 1, 1], 2)[1]
        d = np.array([dx, dy])
    else:
        d = Q[m] - Q[0]
    return d / np.linalg.norm(d)


# ======================================================== contour modelling
class Params:
    def __init__(self, **kw):
        self.ds = 0.05           # contour resampling step (source px)
        self.corner_k = 1.5      # arc length over which turning is measured
        self.corner_deg = 35     # turning that always makes a corner
        self.corner_low = 35     # weaker turns count only between straight sides...
        self.side_near = 1.0     # ...(straightness is measured 1-3 px either side)
        self.side_far = 3.0
        self.bend_min = 6.5      # ...one side bending less than this (deg)
        self.bend_max = 12.0     # ...and neither side more than this
        self.trim = 1.1          # arc ignored next to each corner when fitting
        self.line_tol = 0.3      # max residual for an edge to be straight
        self.smooth = 1.5        # curved edges: Savitzky-Golay window = 3x this (arc length)
        self.bez_err = 0.1       # Bezier fit tolerance
        self.run_eps = 0.08      # straight runs inside curves (e.g. the U stems)
        self.run_min = 25.0
        self.short = 2.6         # blur-truncated tips shorter than this are re-pointed
        self.term_max = 18.0     # stroke-end edges are shorter than this
        self.tan_len = 2.0       # arc length used for curve end tangents
        self.__dict__.update(kw)


BIG = Params()
SMALL = Params(corner_k=1.6, corner_deg=55, corner_low=40, trim=0.8, line_tol=0.22, smooth=1.4,
               bez_err=0.1, run_min=1e9, short=1.8, term_max=7.5, tan_len=1.0)
RED = Params()


def detect_corners(P, step, prm):
    n = len(P)
    k = max(int(round(prm.corner_k / step)), 2)
    a = P - np.roll(P, k, 0)
    b = np.roll(P, -k, 0) - P
    ang = np.degrees(np.abs(np.arctan2(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0], np.sum(a * b, 1))))
    near = max(int(round(prm.side_near / step)), 1)
    far = max(int(round(prm.side_far / step)), near + 4)
    mid = (near + far) // 2

    def bend(ia, ib, ic):
        _, d1, _ = fit_line(P[np.arange(ia, ib + 1) % n])
        _, d2, _ = fit_line(P[np.arange(ib, ic + 1) % n])
        return math.degrees(math.acos(min(1.0, abs(float(d1 @ d2)))))

    cand = []
    for i in np.nonzero(ang >= prm.corner_low)[0]:
        if ang[i] < ang[np.arange(i - k, i + k + 1) % n].max():
            continue
        ok = ang[i] >= prm.corner_deg
        if not ok:
            bl, br = bend(i - far, i - mid, i - near), bend(i + near, i + mid, i + far)
            ok = min(bl, br) < prm.bend_min and max(bl, br) < prm.bend_max
        if ok:
            cand.append(int(i))
    idx = []
    for i in sorted(cand, key=lambda j: -ang[j]):
        if all(min((i - j) % n, (j - i) % n) > k for j in idx):
            idx.append(i)
    return sorted(idx)


def arc_slice(P, i, j):
    return P[i:j + 1] if j > i else np.vstack([P[i:], P[:j + 1]])


def build_segments(P_raw, prm):
    """Split a closed contour into straight / curved edges between corners."""
    P, step = resample_closed(P_raw, prm.ds)
    if signed_area(P) < 0:
        P = P[::-1].copy()
    cidx = detect_corners(P, step, prm)
    trim = int(round(prm.trim / step))
    segs = []
    for a, b in zip(cidx, cidx[1:] + cidx[:1]):
        raw = arc_slice(P, a, b)
        t = min(trim, max(len(raw) // 4, 1))
        core = raw[t:len(raw) - t] if len(raw) - 2 * t >= 4 else raw
        c, d, mx = fit_line(core)
        if mx < prm.line_tol:
            d = snap_dir(d)
            if d @ (raw[-1] - raw[0]) < 0:
                d = -d
            segs.append({'kind': 'line', 'c': c, 'd': d, 'len': len(raw) * step, 'p0': raw[0], 'p1': raw[-1]})
        else:
            # Savitzky-Golay (local cubic) smoothing per edge: removes JPEG ripple
            # without dragging the ends toward the neighbouring corners
            core = raw[t:len(raw) - t]
            win = int(round(prm.smooth * 3 / step)) | 1
            if win > len(core):
                win = len(core) if len(core) % 2 else len(core) - 1
            if win >= 5:
                core = np.stack([savgol_filter(core[:, i], win, 3, mode='interp') for i in (0, 1)], 1)
            segs.append({'kind': 'curve', 'pts': core, 'len': len(raw) * step, 'p0': raw[0], 'p1': raw[-1]})
    # blur cuts the very tip off acute points: drop the stub and let the sides meet
    changed = True
    while changed and len(segs) > 3:
        changed = False
        for i, s in enumerate(segs):
            pa, pb = segs[i - 1], segs[(i + 1) % len(segs)]
            if s['kind'] != 'line' or s['len'] > prm.short or pa['kind'] != 'line' or pb['kind'] != 'line':
                continue
            x = intersect(pa['c'], pa['d'], pb['c'], pb['d'])
            if x is not None and np.linalg.norm(x - (s['p0'] + s['p1']) / 2) < 6 and abs(pa['d'] @ pb['d']) > 0.35:
                del segs[i]
                changed = True
                break
    return segs, P


def seg_dir_at(s, end):
    """Direction of travel at the start (end=False) or end (end=True) of a segment."""
    if s['kind'] == 'line':
        return s['d']
    return -end_tangent(s['pts'], 2.0, False) if end else end_tangent(s['pts'], 2.0, True)


def vertices(segs):
    m = len(segs)
    out = []
    for i in range(m):
        a, b = segs[i], segs[(i + 1) % m]
        ca, da = (a['c'], a['d']) if a['kind'] == 'line' else (a['pts'][-1], seg_dir_at(a, True))
        cb, db = (b['c'], b['d']) if b['kind'] == 'line' else (b['pts'][0], seg_dir_at(b, False))
        x = intersect(ca, da, cb, db)
        if x is None or np.linalg.norm(x - a['p1']) > 6:
            x = a['p1']
        out.append(x)
    return out


def curve_pieces(Q, prm):
    """Split a curved edge into Bezier runs and (long) straight runs, G1-joined."""
    approx = cv2.approxPolyDP(Q.astype(np.float32).reshape(-1, 1, 2), prm.run_eps, False)[:, 0, :]
    idxs = sorted({int(np.argmin(np.hypot(*(Q - v).T))) for v in approx})
    lines = []
    edge = int(round(1.5 / prm.ds))
    for a, b in zip(idxs[:-1], idxs[1:]):
        if np.linalg.norm(Q[b] - Q[a]) < prm.run_min:
            continue
        a = 0 if a <= edge else a
        b = len(Q) - 1 if b >= len(Q) - 1 - edge else b
        sh = max(int(round(0.6 / prm.ds)), 1)
        c, d, _ = fit_line(Q[a + sh:b - sh + 1] if b - a > 2 * sh + 4 else Q[a:b + 1])
        d = snap_dir(d)
        if d @ (Q[b] - Q[a]) < 0:
            d = -d
        lines.append((a, b, c + d * ((Q[a] - c) @ d), c + d * ((Q[b] - c) @ d), d))
    pieces, pos, prev = [], 0, end_tangent(Q, prm.tan_len, True)
    for a, b, ps, pe, d in lines:
        if a - pos >= 3:
            pts = Q[pos:a + 1].copy()
            if pieces:
                pts[0] = pieces[-1][2]
            pts[-1] = ps
            pieces.append(('curve', pts, prev, -d))
        pieces.append(('line', ps, pe))
        prev, pos = d, b
    if len(Q) - 1 - pos >= 3:
        pts = Q[pos:].copy()
        if pieces and pieces[-1][0] == 'line':
            pts[0] = pieces[-1][2]
        pieces.append(('curve', pts, prev, end_tangent(Q, prm.tan_len, False)))
    return pieces


def contour_cmds(segs, prm, keep=None):
    """Path commands for one closed contour.  keep: {vertex index: fixed position}.
    Corners are intersections of the neighbouring edges as they are actually drawn:
    a line, a straight run that starts a curve, or a curve's end tangent."""
    m = len(segs)
    pieces = {i: curve_pieces(s['pts'], prm) for i, s in enumerate(segs) if s['kind'] == 'curve'}

    def end_ray(i):
        s = segs[i]
        if s['kind'] == 'line':
            return s['c'], s['d']
        p = pieces[i][-1]
        if p[0] == 'line':
            return p[2], p[2] - p[1]
        return p[1][-1], -p[3]

    def start_ray(i):
        s = segs[i]
        if s['kind'] == 'line':
            return s['c'], s['d']
        p = pieces[i][0]
        if p[0] == 'line':
            return p[1], p[2] - p[1]
        return p[1][0], p[2]

    vert = []
    for i in range(m):
        ca, da = end_ray(i)
        cb, db = start_ray((i + 1) % m)
        x = intersect(ca, da / np.linalg.norm(da), cb, db / np.linalg.norm(db))
        if x is None or np.linalg.norm(x - segs[i]['p1']) > 6:
            x = segs[i]['p1']
        vert.append(x)
    for i, v in (keep or {}).items():
        vert[i] = v
    cmds = [('M', [vert[-1]])]
    for i, s in enumerate(segs):
        cur, v1 = vert[i - 1], vert[i]
        if s['kind'] == 'curve':
            pcs = pieces[i]
            for j, pc in enumerate(pcs):
                if pc[0] == 'line':
                    if j < len(pcs) - 1:            # a closing run ends at the vertex itself
                        cmds.append(('L', [pc[2]]))
                        cur = pc[2]
                else:
                    pts = pc[1]
                    if np.linalg.norm(pts[0] - cur) > 1e-3:
                        cmds.append(('L', [pts[0]]))
                    cmds += [('C', [b[1], b[2], b[3]]) for b in fit_cubic(pts, pc[2], pc[3], prm.bez_err)]
                    cur = pts[-1]
        if np.linalg.norm(v1 - cur) > 1e-3 or s['kind'] == 'line':
            cmds.append(('L', [v1]))
    return cmds


# ===================================================================== glyphs
class Glyph:
    def __init__(self, label, row, contours, prm):
        self.label, self.row, self.prm = label, row, prm
        self.parts = []            # [(segs, is_hole, dense_pts)]
        outer = max(contours, key=lambda c: abs(signed_area(c)))
        dense, _ = resample_closed(outer, 0.05)
        self.ref = dense.mean(0)
        for c in contours:
            segs, P = build_segments(c, prm)
            self.parts.append((segs, c is not outer, P))
        self.parts.sort(key=lambda p: p[1])       # outer first
        self.local = [self._localise(segs) for segs, _, _ in self.parts]

    def _localise(self, segs):
        out = copy.deepcopy(segs)
        for s in out:
            for k in ('c', 'p0', 'p1'):
                if k in s:
                    s[k] = s[k] - self.ref
            if s['kind'] == 'curve':
                s['pts'] = s['pts'] - self.ref
        return out

    def signature(self):
        return [''.join(s['kind'][0] for s in segs) for segs in self.local]


def _rotations(sig_a, sig_b):
    n = len(sig_a)
    return [r for r in range(n) if sig_b[r:] + sig_b[:r] == sig_a]


def average_group(glyphs):
    """Replace each glyph's local shape by the mean over all instances of that letter."""
    base = glyphs[0]
    aligned = [base.local]
    for g in glyphs[1:]:
        parts = []
        for pi, (segs_a, segs_b) in enumerate(zip(base.local, g.local)):
            sa = ''.join(s['kind'][0] for s in segs_a)
            sb = ''.join(s['kind'][0] for s in segs_b)
            rots = _rotations(sa, sb) if len(sa) == len(sb) else []
            if not rots:
                return False
            corners_a = np.array([s['p0'] for s in segs_a])
            best = min(rots, key=lambda r: np.sum(np.hypot(*(np.array([s['p0'] for s in segs_b[r:] + segs_b[:r]]) - corners_a).T)))
            parts.append(segs_b[best:] + segs_b[:best])
        aligned.append(parts)
    mean = copy.deepcopy(base.local)
    for pi, segs in enumerate(mean):
        for si, s in enumerate(segs):
            inst = [a[pi][si] for a in aligned]
            for k in ('p0', 'p1'):
                s[k] = np.mean([x[k] for x in inst], 0)
            s['len'] = float(np.mean([x['len'] for x in inst]))
            if s['kind'] == 'line':
                s['c'] = np.mean([x['c'] for x in inst], 0)
                d = np.sum([x['d'] for x in inst], 0)
                s['d'] = snap_dir(d / np.linalg.norm(d))
            else:
                n = max(len(x['pts']) for x in inst)
                s['pts'] = np.mean([resample_open(x['pts'], n) for x in inst], 0)
    for g in glyphs:
        g.local = mean          # shared: identical letters get identical outlines
    return True


def thin(glyph, d, cap, base):
    """Move stroke edges d px into the ink, holding cap-height / baseline edges,
    stroke ends and pointed tips.  Curved letters keep their vertical extent."""
    prm = glyph.prm
    out_parts = []
    for (segs0, is_hole, _), segs in zip(glyph.parts, glyph.local):
        sgn = -1.0 if is_hole else 1.0
        new = copy.deepcopy(segs)
        m = len(segs)
        if d:
            for i, s in enumerate(new):
                if s['kind'] == 'line':
                    y = s['c'][1] + glyph.ref[1]
                    horizontal = abs(s['d'][1]) < 0.02
                    on_metric = horizontal and (abs(y - cap) < 0.7 or abs(y - base) < 0.7)
                    da, db = seg_dir_at(segs[i - 1], True), seg_dir_at(segs[(i + 1) % m], False)
                    stroke_end = s['len'] < prm.term_max and da @ db < -0.9
                    if not (on_metric or stroke_end):
                        s['c'] = s['c'] + sgn * ink_normal(s['d']) * d
                else:
                    Q = s['pts']
                    t = np.gradient(Q, axis=0)
                    t /= np.linalg.norm(t, axis=1)[:, None]
                    s['pts'] = Q + sgn * ink_normal(t) * d
        # pointed (acute, convex) tips stay where they are
        keep = {}
        if d:
            v0 = vertices(segs)
            for i in range(m):
                a, b = segs[i], segs[(i + 1) % m]
                if a['kind'] != 'line' or b['kind'] != 'line':
                    continue
                convex = (b['d'] @ (sgn * ink_normal(a['d']))) > 0
                if convex and a['d'] @ b['d'] < -0.64:
                    keep[i] = v0[i]
        out_parts.append(contour_cmds(new, prm, keep))
    if d and any(s['kind'] == 'curve' for segs in glyph.local for s in segs):
        y0a, y0b = extent(contours_cmds(glyph, 0.0))
        y1a, y1b = extent(out_parts)
        k = (y0b - y0a) / (y1b - y1a)
        out_parts = [[(c, [np.array([p[0], y0a + (p[1] - y1a) * k]) for p in pts]) for c, pts in cmds]
                     for cmds in out_parts]
    return out_parts


_plain_cache = {}


def contours_cmds(glyph, d):
    key = id(glyph.local)
    if key not in _plain_cache:
        _plain_cache[key] = [contour_cmds(segs, glyph.prm) for segs in glyph.local]
    return _plain_cache[key]


def extent(parts):
    ys = []
    for cmds in parts:
        cur = None
        for c, pts in cmds:
            if c == 'C':
                ys += list(bez(np.array([cur] + pts), np.linspace(0, 1, 9))[:, 1])
            else:
                ys += [p[1] for p in pts]
            cur = pts[-1]
    return min(ys), max(ys)


# ================================================================= assembly
def collect(rgb):
    a_grey, a_red = coverage_maps(rgb)
    conts = iso_contours(a_grey)
    # split rows at the widest empty band between SUMMIT and the tagline
    prof = (a_grey > 0.5).sum(1)
    mid = len(prof) // 2
    gap = [y for y in range(int(len(prof) * 0.55), int(len(prof) * 0.9)) if prof[y] == 0]
    split = (min(gap) + max(gap)) / 2 if gap else mid
    outers, holes = [], []
    for c in conts:
        inside = [o for o in conts if o is not c and abs(signed_area(o)) > abs(signed_area(c))
                  and cv2.pointPolygonTest(o.astype(np.float32), tuple(map(float, c[0])), False) > 0]
        (holes if inside else outers).append((c, inside[0] if inside else None))
    glyphs = []
    for row, labels, prm in (('top', TOP_LABELS, BIG), ('tag', TAG_LABELS, SMALL)):
        row_out = sorted([c for c, _ in outers if (c[:, 1].mean() < split) == (row == 'top')],
                         key=lambda c: c[:, 0].min())
        if len(row_out) != len(labels):
            sys.exit(f'expected {len(labels)} glyphs in row {row}, found {len(row_out)}')
        for c, lab in zip(row_out, labels):
            hs = [h for h, parent in holes if parent is c]
            glyphs.append(Glyph(lab, row, [c] + hs, prm))
    red = [Glyph('mark', 'red', [max(iso_contours(a_red), key=lambda c: abs(signed_area(c)))], RED)]
    return glyphs, red


def row_metrics(glyphs, row):
    """Cap-height and baseline of a text row from its horizontal edges."""
    ys = []
    for g in glyphs:
        if g.row != row:
            continue
        for segs in g.local:
            ys += [s['c'][1] + g.ref[1] for s in segs if s['kind'] == 'line' and abs(s['d'][1]) < 0.02]
    ys = np.array(ys)
    cap = np.median(ys[ys < ys.min() + 0.7])
    base = np.median(ys[ys > ys.max() - 0.7])
    return cap, base


def fmt(v):
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    if s.startswith('0.'):
        s = s[1:]
    elif s.startswith('-0.'):
        s = '-' + s[2:]
    return '0' if s in ('', '-0', '-') else s


def path_d(parts, xf):
    """Compact relative path data."""
    out = []
    for cmds in parts:
        cur = None
        for c, pts in cmds:
            tp = [xf(p) for p in pts]
            if c == 'M':
                q = tp[0]
                out.append(f'M{fmt(q[0])} {fmt(q[1])}')
                start = cur = np.round(q, 2)
                continue
            rel = []
            for q in tp:
                rel.append(np.round(q, 2) - cur)
            if c == 'C':
                cur = np.round(tp[-1], 2)
            else:
                cur = np.round(tp[-1], 2)
            nums = [fmt(v) for r in rel for v in r]
            if c == 'L' and abs(rel[0][1]) < 1e-9:
                out.append('h' + fmt(rel[0][0]))
            elif c == 'L' and abs(rel[0][0]) < 1e-9:
                out.append('v' + fmt(rel[0][1]))
            else:
                body = ''
                for n_ in nums:
                    body += n_ if (n_.startswith('-') or not body) else ' ' + n_
                out.append(c.lower() + body)
        out.append('z')
    return ''.join(out)


def svg_doc(grey_d, red_d, grey, red, grey_opacity=None, comment=''):
    op = f' opacity="{grey_opacity}"' if grey_opacity is not None else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W_OUT} {H_OUT}" width="{W_OUT}" '
            f'height="{H_OUT}">\n'
            f'  <!-- {comment} -->\n'
            f'  <path fill="{grey}"{op} fill-rule="evenodd" d="{grey_d}"/>\n'
            f'  <path fill="{red}" d="{red_d}"/>\n'
            f'</svg>\n')


def render(svg, w=W_OUT, background=None):
    kw = {'svg_string': svg, 'width': w}
    if background:
        kw['background'] = background
    return np.asarray(Image.open(io.BytesIO(bytes(resvg_py.svg_to_bytes(**kw)))).convert('RGBA')).astype(float) / 255


# ================================================================== fitting
class Logo:
    def __init__(self, glyphs, red):
        self.glyphs, self.red = glyphs, red
        self.metrics = {r: row_metrics(glyphs, r) for r in ('top', 'tag')}
        self.cache = {}

    def grey_parts(self, d_top, d_tag):
        parts = []
        for g in self.glyphs:
            d = d_top if g.row == 'top' else d_tag
            key = (id(g.local), round(d, 4))
            if key not in self.cache:
                self.cache[key] = thin(g, d, *self.metrics[g.row])
            parts += [[(c, [p + g.ref for p in pts]) for c, pts in cmds] for cmds in self.cache[key]]
        return parts

    def red_parts(self):
        g = self.red[0]
        return [[(c, [p + g.ref for p in pts]) for c, pts in cmds] for cmds in contours_cmds(g, 0)]


def fit_to_reference(logo, ref):
    alpha = ref[..., 3]
    is_red = (ref[..., 0] - ref[..., 1]) > 0.2
    grey_t = alpha * ~is_red

    def grey_alpha(d_top, d_tag, xf_par):
        s, tx, ty = xf_par
        d = path_d(logo.grey_parts(d_top, d_tag), lambda p: (p[0] * s + tx, p[1] * s + ty))
        return render(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W_OUT} {H_OUT}">'
                      f'<path fill-rule="evenodd" d="{d}"/></svg>')[..., 3]

    xf = [W_OUT / 599, 0.0, 0.0]
    d_top = d_tag = 0.0
    top_rows = slice(0, int(H_OUT * 0.75))
    tag_rows = slice(int(H_OUT * 0.75), H_OUT)
    for rnd in range(3):
        r = minimize(lambda q: np.sum((grey_alpha(d_top, d_tag, q) - grey_t) ** 2), xf, method='Nelder-Mead',
                     options={'xatol': 1e-5, 'fatol': 1e-3,
                              'initial_simplex': [xf, [xf[0] * 1.004, xf[1], xf[2]], [xf[0], xf[1] + .2, xf[2]],
                                                  [xf[0], xf[1], xf[2] + .2]]})
        xf = list(r.x)
        d_top = minimize_scalar(lambda v: np.sum((grey_alpha(v, d_tag, xf) - grey_t)[top_rows] ** 2),
                                bounds=(0, 2.5), method='bounded', options={'xatol': 0.01}).x
        d_tag = minimize_scalar(lambda v: np.sum((grey_alpha(d_top, v, xf) - grey_t)[tag_rows] ** 2),
                                bounds=(0, 2.5), method='bounded', options={'xatol': 0.01}).x
        err = np.abs(grey_alpha(d_top, d_tag, xf) - grey_t).mean()
        print(f'  round {rnd}: scale {xf[0]:.5f} offset ({xf[1]:.3f}, {xf[2]:.3f})  '
              f'thin top {d_top:.3f}px tag {d_tag:.3f}px  mean |dA| {err:.4f}')
    return xf, d_top, d_tag


def fit_red(logo, ref, xf):
    """Red mark: polygon from the brochure, clipped to the web frame (top / right
    edges sit on the artboard edge), vertices refined against the web PNG."""
    g = logo.red[0]
    s, tx, ty = xf
    verts = np.array([v + g.ref for v in vertices(g.local[0])]) * s + [tx, ty]
    # identify: peak = lowest-y interior vertex, left edge, right edge
    order = np.argsort(verts[:, 0])
    left = verts[order[:2]]
    right = verts[order[-2:]]
    peak = verts[order[2]]
    bl = left[np.argmax(left[:, 1])]
    br = right[np.argmax(right[:, 1])]
    # params: x_left, y_bl, x_peak, y_peak, y_br  (top=0, right=W_OUT)
    slope_r = (br - peak)
    y_br0 = peak[1] + slope_r[1] / slope_r[0] * (W_OUT - peak[0])
    p0 = np.array([bl[0], bl[1], peak[0], peak[1], y_br0])
    target = ref[..., 3] * ((ref[..., 0] - ref[..., 1]) > 0.2)

    def poly(p):
        xl, ybl, xp, yp, ybr = p
        return np.array([[xl, 0], [W_OUT, 0], [W_OUT, ybr], [xp, yp], [xl, ybl]])

    def cost(p):
        pts = ' '.join(f'{x:.4f},{y:.4f}' for x, y in poly(p))
        a = render(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W_OUT} {H_OUT}">'
                   f'<polygon points="{pts}"/></svg>')[..., 3]
        return np.sum((a - target) ** 2)

    c0 = cost(p0)
    r = minimize(cost, p0, method='Nelder-Mead', options={'xatol': 1e-4, 'fatol': 1e-4, 'maxiter': 4000})
    print(f'  red mark: brochure polygon err {c0:.2f} -> refined {r.fun:.2f}; '
          f'moved {np.round(r.x - p0, 3).tolist()}')
    return poly(r.x)


# ===================================================================== main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--report', help='directory for comparison renders')
    ap.add_argument('--out', help='output directory (default redesign/public/img)')
    ap.add_argument('--root', help='repository root (default: parent of tools/)')
    args = ap.parse_args()
    out_dir = Path(args.out) if args.out else OUT
    out_dir.mkdir(parents=True, exist_ok=True)

    ref_img = Image.open(REF).convert('RGBA')
    ref = np.asarray(ref_img).astype(float) / 255
    assert ref_img.size == (W_OUT, H_OUT)
    opaque = np.asarray(ref_img)[np.asarray(ref_img)[..., 3] == 255][:, :3]
    cols, counts = np.unique(opaque, axis=0, return_counts=True)
    top2 = cols[np.argsort(-counts)[:2]]
    red_rgb = max(top2, key=lambda c: int(c[0]) - int(c[1]))
    grey_rgb = min(top2, key=lambda c: int(c[0]) - int(c[1]))
    GREY = '#%02x%02x%02x' % tuple(grey_rgb)
    RED_C = '#%02x%02x%02x' % tuple(red_rgb)
    print('colours from web PNG:', GREY, RED_C)

    rgb = load_brochure_logo()
    print('brochure logo raster', rgb.shape[1], 'x', rgb.shape[0])
    glyphs, red = collect(rgb)
    for lab in sorted(set(g.label for g in glyphs)):
        for row in ('top', 'tag'):
            grp = [g for g in glyphs if g.label == lab and g.row == row]
            if len(grp) > 1:
                ok = average_group(grp)
                print(f'  averaged {len(grp)}x {lab} ({row})' if ok else f'  could not average {lab} ({row})')
    logo = Logo(glyphs, red)
    print('fitting to web PNG ...')
    xf, d_top, d_tag = fit_to_reference(logo, ref)
    red_poly = fit_red(logo, ref, xf)

    s, tx, ty = xf
    grey_d = path_d(logo.grey_parts(d_top, d_tag), lambda p: (p[0] * s + tx, p[1] * s + ty))
    red_d = 'M' + 'L'.join(f'{fmt(x)} {fmt(y)}' for x, y in red_poly) + 'z'
    note = 'Summit Asset Management - vector logo, rebuilt by tools/build_svg_logo.py'
    header = svg_doc(grey_d, red_d, GREY, RED_C, comment=note)
    footer = svg_doc(grey_d, red_d, FOOTER_TEXT, FOOTER_RED, FOOTER_TEXT_OPACITY, comment=note + ' (footer)')
    (out_dir / 'logo.svg').write_text(header, encoding='utf-8')
    (out_dir / 'logo-footer.svg').write_text(footer, encoding='utf-8')
    print('wrote logo.svg', len(header), 'bytes; logo-footer.svg', len(footer), 'bytes')
    for k, name in ((1, 'logo.png'), (2, 'logo@2x.png'), (3, 'logo@3x.png'), (4, 'logo@4x.png')):
        png = bytes(resvg_py.svg_to_bytes(svg_string=header, width=W_OUT * k))
        im = Image.open(io.BytesIO(png))
        assert im.size == (W_OUT * k, H_OUT * k), im.size
        im.save(out_dir / name, optimize=True)
        print('wrote', name, im.size, (out_dir / name).stat().st_size, 'bytes')

    if args.report:
        rep = Path(args.report)
        rep.mkdir(parents=True, exist_ok=True)
        (rep / 'logo_src_frame.svg').write_text(header)
        big = Image.open(io.BytesIO(bytes(resvg_py.svg_to_bytes(svg_string=header, width=2000, background='#ffffff'))))
        big.save(rep / 'logo_2000.png')
        orig = Image.open(REF).convert('RGBA')
        bg = Image.new('RGBA', orig.size, 'white')
        bg.alpha_composite(orig)
        up = bg.resize((2000, 500), Image.LANCZOS).convert('RGB')
        sbs = Image.new('RGB', (2000, 1040), 'white')
        sbs.paste(up, (0, 0))
        sbs.paste(big.convert('RGB'), (0, 540))
        sbs.save(rep / 'compare_original_vs_new.png')
        print('report written to', rep)


if __name__ == '__main__':
    main()

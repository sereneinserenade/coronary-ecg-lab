#!/usr/bin/env python3
"""Turn BodyParts3D scan-derived anatomy into meshes this site can render.

Source: BodyParts3D, Copyright (c) The Database Center for Life Science,
licensed under CC Attribution-Share Alike 2.1 Japan.
https://dbarchive.biosciencedbc.jp/en/bodyparts3d/

Reads only the element meshes it needs, straight out of the remote zip via HTTP
range requests, then registers them into the local cardiac frame used by
heart-data.js (+x patient's left, +y towards the base, +z anterior, origin on the
left ventricular long axis) so the existing AHA segment maths applies unchanged.

    python3 tools/build_heart_meshes.py
"""
import json, math, os, re, struct, sys, urllib.request, zlib
from collections import defaultdict

BASE = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST"
ZIP = f"{BASE}/partof_BP3D_4.0_obj_99.zip"
UA = {"User-Agent": "coronary-ecg-lab mesh build script"}
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, "tools", ".cache")
OUT = os.path.join(ROOT, "models")

# Matches the procedural model so both can be compared in the same frame.
LV_TOP, LV_BOT = 2.7, -6.0
LV_LEN = LV_TOP - LV_BOT

# BodyParts3D decomposes each chamber into a blood-pool cavity, a wall region, the
# valve leaflets hinged on it and (for the ventricles) the papillary muscles. The
# "part of" relation shares the leaflets between the chamber above and the chamber
# below, so collecting every element of FMA7097 silently welds the mitral valve and
# a sprawling wall region onto the left atrium. Name the elements instead.
#
#   FJ2422/FJ2423/FJ2425/FJ2424  cavity of LV / RV / LA / RA
#   FJ2438/FJ2439                wall region of LA / RA
#   FJ2420 FJ2432                mitral leaflets, anterior and posterior
#   FJ2421 FJ2433 FJ2436         tricuspid leaflets, anterior, posterior, septal
#   FJ2426 FJ2431 FJ2435         aortic cusps
#   FJ2417 FJ2427 FJ2434         pulmonary cusps
#   FJ2418 FJ2429                LV papillary muscles (lateral, and the other group)
#   FJ2419 FJ2430 FJ2437         RV papillary muscles
#
# `trim` clips the tubular venous extensions off an atrium: the cavae and the
# pulmonary veins are modelled as part of the atrial wall, and left in place they
# make each atrium 9 cm across and drive it straight through the ventricles below.
STRUCTURES = {
    "lv": {"label": "left ventricle", "elements": ["FJ2422"], "subdivide": 2},
    "rv": {"label": "right ventricle", "elements": ["FJ2423"], "subdivide": 1},
    "la": {"label": "left atrium", "elements": ["FJ2438"], "trim": 2.9, "anchor": "mv", "lift": 2.2},
    "ra": {"label": "right atrium", "elements": ["FJ2439"], "trim": 3.2, "anchor": "tv", "lift": 2.4},
    "mv": {"label": "mitral valve", "elements": ["FJ2420", "FJ2432"]},
    "tv": {"label": "tricuspid valve", "elements": ["FJ2421", "FJ2433", "FJ2436"]},
    "av": {"label": "aortic valve", "elements": ["FJ2426", "FJ2431", "FJ2435"]},
    "pv": {"label": "pulmonary valve", "elements": ["FJ2417", "FJ2427", "FJ2434"]},
    "pap": {"label": "papillary muscles", "elements": ["FJ2418", "FJ2429", "FJ2419", "FJ2430", "FJ2437"]},
}

# Which parts the page renders as chamber walls, and which as internal apparatus.
CHAMBERS = ["lv", "rv", "la", "ra"]

# The frame is fitted to the WHOLE left ventricle — cavity, leaflets and papillary
# muscles together — not to the cavity element alone. The cavity on its own is a
# coarse mesh whose two ends are nearly the same width, and the base-versus-apex
# test then picks the wrong end and rotates the entire model.
REGISTRATION = ("FMA7101", "left ventricle (all parts)")
# The septal direction comes from the right ventricle, and for the same reason it
# must be the whole chamber: the cavity element alone sits off-centre and rotates
# the frame about the long axis, which walks both interventricular grooves.
REGISTRATION_RV = ("FMA7098", "right ventricle (all parts)")

# Landmarks, not rendered. The two interventricular arteries mark the two grooves,
# which is what fixes the anterior direction — the chamber centroids cannot, because
# all four are nearly coplanar (that plane is the four-chamber view).
LANDMARKS = {
    "lad": ("FMA3862", "anterior interventricular branch"),
    "pda": ("FMA3840", "posterior interventricular branch"),
}

# ---------------------------------------------------------------- fetching

def cached(name, fetch):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(fetch())
    return open(path, "rb").read()

def http(url, rng=None):
    req = urllib.request.Request(url, headers=dict(UA))
    if rng:
        req.add_header("Range", f"bytes={rng[0]}-{rng[1]}")
    return urllib.request.urlopen(req).read()

def zip_index():
    raw = cached("zip_index.json", lambda: json.dumps(_scan_zip()).encode())
    return json.loads(raw)

def _scan_zip():
    head = urllib.request.urlopen(urllib.request.Request(ZIP, method="HEAD", headers=dict(UA)))
    size = int(head.headers["Content-Length"])
    tail = http(ZIP, (size - 65536, size - 1))
    i = tail.rfind(b"PK\x05\x06")
    cd_size = struct.unpack("<I", tail[i + 12:i + 16])[0]
    cd_off = struct.unpack("<I", tail[i + 16:i + 20])[0]
    cd = http(ZIP, (cd_off, cd_off + cd_size - 1))
    out, p = {}, 0
    while p < len(cd) - 4 and cd[p:p + 4] == b"PK\x01\x02":
        method = struct.unpack("<H", cd[p + 10:p + 12])[0]
        comp = struct.unpack("<I", cd[p + 20:p + 24])[0]
        nl, el, cl = struct.unpack("<HHH", cd[p + 28:p + 34])
        off = struct.unpack("<I", cd[p + 42:p + 46])[0]
        name = cd[p + 46:p + 46 + nl].decode()
        out[re.sub(r".*/", "", name).split(".")[0]] = [off, comp, method]
        p += 46 + nl + el + cl
    return out

def element_obj(fj, index):
    def fetch():
        off, comp, method = index[fj]
        hdr = http(ZIP, (off, off + 29))
        nl, el = struct.unpack("<HH", hdr[26:30])
        start = off + 30 + nl + el
        data = http(ZIP, (start, start + comp - 1))
        return zlib.decompress(data, -15) if method == 8 else data
    return cached(f"{fj}.obj", fetch).decode("utf8", "replace")

# ---------------------------------------------------------------- geometry

def parse_obj(text, verts, faces):
    base = len(verts)
    local = 0
    for line in text.splitlines():
        if line.startswith("v "):
            x, y, z = line.split()[1:4]
            verts.append((float(x), float(y), float(z)))
            local += 1
        elif line.startswith("f "):
            idx = [int(tok.split("/")[0]) for tok in line.split()[1:]]
            idx = [(i - 1 + base) if i > 0 else (len(verts) + i) for i in idx]
            for k in range(1, len(idx) - 1):          # fan-triangulate
                faces.append((idx[0], idx[k], idx[k + 1]))

def centroid(pts):
    n = len(pts)
    return [sum(p[i] for p in pts) / n for i in range(3)]

def sub(a, b): return [a[i] - b[i] for i in range(3)]
def dot(a, b): return sum(a[i] * b[i] for i in range(3))
def cross(a, b): return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
def norm(a):
    n = math.sqrt(dot(a, a)) or 1.0
    return [c / n for c in a]

def principal_axis(pts, c):
    """Power iteration on the covariance matrix — no numpy needed."""
    cov = [[0.0] * 3 for _ in range(3)]
    for p in pts:
        d = sub(p, c)
        for i in range(3):
            for j in range(3):
                cov[i][j] += d[i] * d[j]
    v = [1.0, 1.0, 1.0]
    for _ in range(200):
        v = norm([sum(cov[i][j] * v[j] for j in range(3)) for i in range(3)])
    return v

def perpendicular(v, axis):
    return norm(sub(v, [axis[i] * dot(v, axis) for i in range(3)]))

def decimate(verts, faces, cell):
    """Vertex clustering. Crude, but it keeps the silhouette and needs no dependencies."""
    grid = {}
    remap = [0] * len(verts)
    acc = []
    for i, p in enumerate(verts):
        key = (round(p[0] / cell), round(p[1] / cell), round(p[2] / cell))
        j = grid.get(key)
        if j is None:
            j = len(acc)
            grid[key] = j
            acc.append([list(p), 1])
        else:
            a = acc[j]
            for k in range(3):
                a[0][k] += p[k]
            a[1] += 1
        remap[i] = j
    out_v = [[c / n for c in s] for s, n in acc]
    seen = set()
    out_f = []
    for a, b, c in faces:
        t = (remap[a], remap[b], remap[c])
        if t[0] == t[1] or t[1] == t[2] or t[0] == t[2]:
            continue
        key = tuple(sorted(t))
        if key in seen:
            continue
        seen.add(key)
        out_f.append(t)
    return out_v, out_f

def subdivide(verts, faces, levels=1):
    """Midpoint subdivision. The ventricular cavity meshes are coarse in the source,
    and the left ventricle carries the AHA segment colours per vertex — at 1700
    triangles the territory borders come out visibly faceted."""
    for _ in range(levels):
        out_v = list(verts)
        mid = {}
        def midpoint(a, b):
            key = (a, b) if a < b else (b, a)
            if key not in mid:
                mid[key] = len(out_v)
                out_v.append([(verts[a][i] + verts[b][i]) / 2 for i in range(3)])
            return mid[key]
        out_f = []
        for a, b, c in faces:
            ab, bc, ca = midpoint(a, b), midpoint(b, c), midpoint(c, a)
            out_f += [(a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)]
        verts, faces = out_v, out_f
    return verts, faces


def trim_to(verts, faces, centre, radius):
    """Clip the venous trunks off an atrium, keeping the chamber body.

    Each atrium's wall region in BodyParts3D runs on into the cavae or the
    pulmonary veins, which makes the raw mesh 9 cm across and drives it through the
    ventricles below. The chamber is a blob and the veins are tubes leaving it, so
    a radius cut separates them — but the centre has to be anchored, not found from
    the mesh, because a trimmed mean happily settles on the appendage or a venous
    confluence instead. Each atrium sits directly above its own AV valve, so that
    valve is the anchor. Works in local (cardiac-frame) centimetres.
    """
    keep = [i for i, p in enumerate(verts) if math.dist(p, centre) <= radius]
    keepset = set(keep)
    remap = {v: i for i, v in enumerate(keep)}
    out_v = [verts[i] for i in keep]
    out_f = [tuple(remap[i] for i in f) for f in faces if all(i in keepset for i in f)]
    return out_v, out_f


def height_map(verts, n_theta=48, n_t=32):
    """R(theta, t) for the epicardial surface, so procedural vessels can hug the real shape."""
    grid = [[0.0] * n_theta for _ in range(n_t)]
    for x, y, z in verts:
        t = (LV_TOP - y) / LV_LEN
        if not (0.0 <= t <= 1.0):
            continue
        it = min(n_t - 1, int(t * n_t))
        th = math.degrees(math.atan2(z, x)) % 360
        ia = int(th / 360 * n_theta) % n_theta
        r = math.hypot(x, z)
        if r > grid[it][ia]:
            grid[it][ia] = r
    # Fill empty cells from their neighbours, then smooth once around theta.
    for it in range(n_t):
        row = grid[it]
        if not any(row):
            src = next((grid[k] for k in range(it - 1, -1, -1) if any(grid[k])), None)
            if src:
                grid[it] = [v * 0.72 for v in src]
            continue
        for ia in range(n_theta):
            if row[ia] == 0:
                left = next((row[(ia - k) % n_theta] for k in range(1, n_theta) if row[(ia - k) % n_theta]), 0)
                right = next((row[(ia + k) % n_theta] for k in range(1, n_theta) if row[(ia + k) % n_theta]), 0)
                row[ia] = (left + right) / 2
        grid[it] = [(row[(ia - 1) % n_theta] + 2 * row[ia] + row[(ia + 1) % n_theta]) / 4 for ia in range(n_theta)]
    return grid

# ---------------------------------------------------------------- main

def main():
    index = zip_index()
    print(f"archive index: {len(index)} element meshes")

    mapping = cached("partof_element_parts.txt", lambda: http(f"{BASE}/partof_element_parts.txt"))
    elements = defaultdict(list)
    for line in mapping.decode("utf8", "replace").splitlines()[1:]:
        cols = line.split("\t")
        if len(cols) >= 3:
            elements[cols[0]].append(cols[2])

    # Fit the cardiac frame to the full left ventricle before emitting anything.
    reg_v, reg_f = [], []
    for fj in elements[REGISTRATION[0]]:
        if fj in index:
            parse_obj(element_obj(fj, index), reg_v, reg_f)
    reg_rv = []
    for fj in elements[REGISTRATION_RV[0]]:
        if fj in index:
            parse_obj(element_obj(fj, index), reg_rv, [])
    print(f"  frame fitted to {REGISTRATION[1]}: {len(reg_v)} verts, "
          f"septal direction from {REGISTRATION_RV[1]}: {len(reg_rv)} verts")

    raw = {}
    for key, spec in STRUCTURES.items():
        verts, faces = [], []
        missing = []
        for fj in spec["elements"]:
            if fj in index:
                parse_obj(element_obj(fj, index), verts, faces)
            else:
                missing.append(fj)
        if missing:
            sys.exit(f"{key}: element(s) {missing} are not in the archive")
        if not verts:
            sys.exit(f"{key}: no geometry")
        raw[key] = (verts, faces)
        print(f"  {spec['label']:18s} {len(spec['elements']):2d} elements -> {len(verts):6d} verts {len(faces):6d} faces")

    # --- register into the cardiac frame -------------------------------
    lv_v = reg_v
    lv_c = centroid(lv_v)
    axis = principal_axis(lv_v, lv_c)
    proj = sorted(dot(sub(p, lv_c), axis) for p in lv_v)
    lo, hi = proj[0], proj[-1]
    # The apex is the narrow end. Mean off-axis radius discriminates far better than
    # the maximum, which the outflow tract skews at the basal end.
    def mean_radius(sel):
        rs = []
        for p in lv_v:
            q = sub(p, lv_c)
            d = dot(q, axis)
            if sel(d):
                rs.append(math.sqrt(max(0.0, dot(q, q) - d * d)))
        return sum(rs) / len(rs) if rs else 0.0
    span = hi - lo
    at_hi = mean_radius(lambda d: d > hi - span * 0.15)
    at_lo = mean_radius(lambda d: d < lo + span * 0.15)
    up = axis if at_hi > at_lo else [-c for c in axis]      # points towards the base
    base_d = hi if at_hi > at_lo else -lo
    print(f"  long axis span {span:.1f} mm; mean radius {max(at_hi, at_lo):.1f} mm at the base "
          f"end vs {min(at_hi, at_lo):.1f} mm at the apex")

    scale = LV_LEN / span                                    # uniform: keeps real proportions
    rv_c = centroid(reg_rv)
    septal = perpendicular(sub(rv_c, lv_c), up)              # RV sits septal to the LV
    X = [-c for c in septal]                                 # +x is the LV free wall, patient's left
    Y = up
    Z = cross(X, Y)                                          # +z anterior, right-handed

    origin = [lv_c[i] + up[i] * base_d for i in range(3)]    # world point of the LV base

    def to_local(p):
        d = sub(p, origin)
        return [dot(d, X) * scale, dot(d, Y) * scale + LV_TOP, dot(d, Z) * scale]

    # Fix the anterior direction from the grooves: the LAD runs in the anterior
    # interventricular groove, the PDA in the posterior one.
    marks = {}
    for key, (fma, label) in LANDMARKS.items():
        vs, fs = [], []
        for fj in elements[fma]:
            if fj in index:
                parse_obj(element_obj(fj, index), vs, fs)
        marks[key] = centroid(vs)
        print(f"  landmark {label}: {len(vs)} verts")

    if dot(sub(marks["lad"], marks["pda"]), Z) < 0:
        print("  frame was mirrored — flipping Z so the LAD lies anterior to the PDA")
        Z = [-c for c in Z]

    lad_l, pda_l = to_local(marks["lad"]), to_local(marks["pda"])
    ang = lambda p: math.degrees(math.atan2(p[2], p[0])) % 360
    print(f"  check  LAD centroid z={lad_l[2]:+.2f} cm, theta={ang(lad_l):.0f} deg "
          f"(model uses {122} for the anterior groove)")
    print(f"  check  PDA centroid z={pda_l[2]:+.2f} cm, theta={ang(pda_l):.0f} deg "
          f"(model uses {232} for the posterior groove)")
    # Everything is measured and written in the cardiac frame from here on.
    local = {k: ([to_local(p) for p in v], f) for k, (v, f) in raw.items()}

    # Trim the venous trunks off the atria, anchoring on the valve each sits above.
    for key, spec in STRUCTURES.items():
        if "trim" not in spec:
            continue
        anchor = centroid(local[spec["anchor"]][0])
        centre = [anchor[0], anchor[1] + spec["lift"], anchor[2]]
        before = len(local[key][0])
        local[key] = trim_to(local[key][0], local[key][1], centre, spec["trim"])
        print(f"  trimmed {spec['label']}: {before} -> {len(local[key][0])} verts, "
              f"within {spec['trim']} cm of a point {spec['lift']} cm above the {spec['anchor'].upper()}")
        if len(local[key][0]) < 200:
            sys.exit(f"{key}: the trim left only {len(local[key][0])} vertices")

    for k in STRUCTURES:
        c = centroid(local[k][0])
        print(f"  part {k:4s} centroid x={c[0]:+.2f} y={c[1]:+.2f} z={c[2]:+.2f} cm")
    for label, got, want in (("anterior", ang(lad_l), 122), ("posterior", ang(pda_l), 232)):
        if abs(got - want) > 10:
            sys.exit(f"registration failed: {label} groove at {got:.0f} deg, model uses {want}")

    # Relationships that must hold whatever the dataset, checked in the cardiac frame.
    c = {k: centroid(local[k][0]) for k in STRUCTURES}
    for want, ok in (
        ("the right atrium lies to the patient's right of the left", c["ra"][0] < c["la"][0]),
        ("each atrium sits above its own AV valve", c["la"][1] > c["mv"][1] and c["ra"][1] > c["tv"][1]),
        ("the papillary muscles hang below the mitral valve", c["pap"][1] < c["mv"][1]),
        ("the pulmonary valve is the most anterior of the four",
         c["pv"][2] > max(c["mv"][2], c["tv"][2], c["av"][2])),
        # The keystone relationship: the aortic valve is wedged between the two AV valves.
        ("the aortic valve sits between the mitral and the tricuspid",
         c["tv"][0] < c["av"][0] < c["mv"][0]),
        ("both arterial valves sit anterior to both AV valves",
         min(c["av"][2], c["pv"][2]) > max(c["mv"][2], c["tv"][2])),
        ("the right ventricle lies to the patient's right of the left", c["rv"][0] < c["lv"][0]),
        ("each atrium is chamber-sized after the trim",
         all(max(p[i] for p in local[k][0]) - min(p[i] for p in local[k][0]) < 6.5
             for k in ("la", "ra") for i in range(3))),
    ):
        print(f"  check  {want}: {'ok' if ok else 'WRONG'}")
        if not ok:
            sys.exit(f"registration failed: not true that {want}")

    os.makedirs(OUT, exist_ok=True)
    manifest = {
        "source": "BodyParts3D, Copyright (c) The Database Center for Life Science "
                  "licensed under CC Attribution-Share Alike 2.1 Japan",
        "url": "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
        "units": "cm", "frame": "+x patient's left, +y towards base, +z anterior",
        "lvTop": LV_TOP, "lvLen": LV_LEN,
        "grooves": {"anterior": round(ang(lad_l), 1), "posterior": round(ang(pda_l), 1)},
        "parts": {},
    }
    for key, (verts, faces) in local.items():
        if STRUCTURES[key].get("subdivide"):
            verts, faces = subdivide(verts, faces, STRUCTURES[key]["subdivide"])
        # The left ventricle carries per-vertex segment colours, so it is kept finest.
        cell = {"lv": 0.06, "rv": 0.10}.get(key, 0.09 if key not in CHAMBERS else 0.15)
        dv, df = decimate(verts, faces, cell)
        with open(os.path.join(OUT, f"{key}.bin"), "wb") as f:
            f.write(struct.pack("<II", len(dv), len(df)))
            for p in dv:
                f.write(struct.pack("<fff", *p))
            for t in df:
                f.write(struct.pack("<III", *t))
        xs = [p[0] for p in dv]; ys = [p[1] for p in dv]; zs = [p[2] for p in dv]
        manifest["parts"][key] = {
            "label": STRUCTURES[key]["label"], "file": f"{key}.bin",
            "role": "chamber" if key in CHAMBERS else "apparatus",
            "vertices": len(dv), "triangles": len(df),
            "bbox": [round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2), round(max(zs) - min(zs), 2)],
            "centroid": [round(v, 2) for v in centroid(dv)],
            "bytes": 8 + len(dv) * 12 + len(df) * 12,
        }
        print(f"  {key}: {len(verts)}v/{len(faces)}f -> {len(dv)}v/{len(df)}f  "
              f"{manifest['parts'][key]['bytes'] / 1024:.0f} KB  bbox {manifest['parts'][key]['bbox']} cm")

    # Radial height maps let the procedural coronaries hug the scanned surface.
    for key in ("lv", "rv"):
        manifest[key + "HeightMap"] = {
            "nTheta": 48, "nT": 32,
            "grid": [[round(v, 4) for v in row]
                     for row in height_map(local[key][0])],
        }
    with open(os.path.join(OUT, "heart-meshes.json"), "w") as f:
        json.dump(manifest, f)
    print(f"\nwrote {OUT}/heart-meshes.json "
          f"({os.path.getsize(os.path.join(OUT, 'heart-meshes.json')) / 1024:.0f} KB)")

if __name__ == "__main__":
    main()

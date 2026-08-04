#!/usr/bin/env python3
"""小爱心 · 精灵表处理工具

把动画序列图切成统一网格的 Sprite Sheet，并生成帧坐标 JSON。

输入可以是两种形态：
  1. 一个文件夹，里面是编号的单帧 PNG（swim_000.png / 01.png / frame-3.png 都认）
  2. 一张已经排好的条状精灵表（横条或竖条），按 --frames 或格子宽度切开

输出：
  <名字>.png    统一格子的精灵表
  <名字>.json   帧坐标配置

用法示例
--------
    # 把现有的 swim.png 重新切成 64x64 网格（会警告装不下，见下）
    python tools/process_sprites.py public/assets/pet/pixel/swim.png --cell 64

    # 用项目真实规格 192x64，输出到 build/
    python tools/process_sprites.py public/assets/pet/pixel/swim.png \\
        --cell 192x64 --fps 8 -o build/sprites

    # 从 pet.json 读规格和帧数，不用手写
    python tools/process_sprites.py public/assets/pet/pixel/swim.png \\
        --pet-json public/assets/pet/pet.json --name swim -o build/sprites

    # 一堆单帧 PNG 打包成一条
    python tools/process_sprites.py art/swim_frames/ --cell 192x64 --name swim

设计约束（来自 CLAUDE.md，改之前先读）
------------------------------------
* 只用最近邻，**永不做插值缩放**。像素画被平滑一次就毁了（十二、十三）
* 输出一律 RGBA 透明背景，无抗锯齿（十三）
* 单精灵调色板上限 32 色（二十一·5 把 16 放宽到 32）。超了只**报告**，不自动量化
  —— 减色是美术决定，不该由脚本替人做
* 默认排成单行。现行 `Sprite.tsx` 用 CSS `steps()` 切 `background-position-x`，
  **只认横条**；多行网格要等 REFACTOR_PLAN 阶段 2 的 canvas 渲染器落地才能用
* 默认不裁剪透明边（--trim 要显式开）。`pet.json` 的锚点是相对整帧的 0–1 坐标，
  裁掉边缘会让泡泡不从鼻孔冒出来
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("需要 Pillow：pip install Pillow")


# 宪法二十一·5：单精灵调色板上限从 16 放宽到 32，仍要克制
MAX_COLORS = 32

# 用户要的默认值。项目真实规格是 192x64，见 pet.json 的 _尺寸依据
DEFAULT_CELL = (64, 64)

IMAGE_SUFFIXES = {".png", ".gif", ".webp", ".bmp"}


# ---------------------------------------------------------------- 数据结构


@dataclass
class Frame:
    """一帧：图像本身 + 它从哪来（出错时能指回源文件）"""

    image: Image.Image
    origin: str


@dataclass
class Placed:
    """排进精灵表之后的一帧"""

    index: int
    x: int
    y: int
    w: int
    h: int
    origin: str


# ---------------------------------------------------------------- 参数解析


def parse_cell(text: str) -> tuple[int, int]:
    """'64' → (64, 64)；'192x64' → (192, 64)"""
    match = re.fullmatch(r"(\d+)\s*[x×*]\s*(\d+)", text.strip())
    if match:
        return int(match.group(1)), int(match.group(2))
    if text.strip().isdigit():
        size = int(text)
        return size, size
    raise argparse.ArgumentTypeError(f"格子尺寸写法不认识：{text!r}（要么 64，要么 192x64）")


def natural_key(path: Path):
    """按文件名里的数字排序，让 frame_2 排在 frame_10 前面"""
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", path.name)]


# ---------------------------------------------------------------- 读入序列


def load_from_dir(src: Path) -> list[Frame]:
    """文件夹 = 一堆单帧，按文件名里的数字排序"""
    files = sorted(
        (p for p in src.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES),
        key=natural_key,
    )
    if not files:
        raise SystemExit(f"{src} 里没有图片")
    return [Frame(Image.open(p).convert("RGBA"), p.name) for p in files]


def cuts_through_content(sheet: Image.Image, frames: int, horizontal: bool) -> int:
    """按这个帧数切下去，有几帧是从身体中间切开的？

    切对了的话，每帧边缘通常留一点透明余量。要是一帧的最左列和最右列**同时**有
    不透明像素，多半是刀落在身体上了。用来兜住「帧数猜错」——那是这个脚本最容易
    悄悄出错的地方：切出来的图不会报错，只是每一帧都是半条儒艮
    """
    span = sheet.size[0] if horizontal else sheet.size[1]
    other = sheet.size[1] if horizontal else sheet.size[0]
    size = span // frames
    alpha = sheet.getchannel("A")

    def edge_opaque(pos: int) -> bool:
        box = (pos, 0, pos + 1, other) if horizontal else (0, pos, other, pos + 1)
        return alpha.crop(box).getbbox() is not None

    bad = 0
    for i in range(frames):
        if edge_opaque(i * size) and edge_opaque((i + 1) * size - 1):
            bad += 1
    return bad


def load_from_strip(
    src: Path, cell: tuple[int, int], frames: int | None, guessed: bool = False
) -> list[Frame]:
    """一张条状精灵表 = 已经排好的多帧，按帧数切开

    **帧数必须来自 --frames 或 pet.json，不能拿 --cell 去猜。**
    --cell 是输出格子尺寸，和源图的帧宽是两回事。早先版本混用了这两个，
    结果 1152x64 的 swim.png 被按 64 切成 18 帧，正好把儒艮切成三段
    """
    sheet = Image.open(src).convert("RGBA")
    sw, sh = sheet.size
    horizontal = sw >= sh
    span = sw if horizontal else sh

    if frames is None:
        raise SystemExit(
            f"{src.name} 是 {sw}x{sh} 的条状精灵表，但不知道它有几帧。\n"
            f"  · 用 --frames N 直接说，或\n"
            f"  · 用 --pet-json public/assets/pet/pet.json 让它去查\n"
            f"（不拿 --cell 去猜：格子尺寸是输出格式，和源帧宽是两回事）"
        )

    if frames < 1:
        raise SystemExit("--frames 至少是 1")
    if span % frames:
        raise SystemExit(f"{src.name} 的 {span}px 分不成 {frames} 等份（余 {span % frames}px）")

    size = span // frames
    bad = cuts_through_content(sheet, frames, horizontal)
    if bad:
        note = f"！按 {frames} 帧切（每帧 {size}px），有 {bad}/{frames} 帧是从身体中间切开的"
        if guessed:
            raise SystemExit(f"{note}\n帧数是猜的，八成猜错了。用 --frames N 说清楚有几帧。")
        print(f"  {note} —— 帧数可能不对")

    out: list[Frame] = []
    for i in range(frames):
        box = (i * size, 0, (i + 1) * size, sh) if horizontal else (0, i * size, sw, (i + 1) * size)
        out.append(Frame(sheet.crop(box), f"{src.name}#{i}"))
    return out


def load_frames(src: Path, cell: tuple[int, int], frames: int | None, guessed: bool = False) -> list[Frame]:
    if src.is_dir():
        return load_from_dir(src)
    if src.is_file():
        return load_from_strip(src, cell, frames, guessed)
    raise SystemExit(f"找不到：{src}")


def find_pet_json(src: Path) -> Path | None:
    """素材通常躺在 assets/pet/<皮肤>/xxx.png，pet.json 就在上一两级。
    自动找到就不用每次手写 --pet-json —— 帧数是这个脚本最不该猜的东西
    """
    for base in list(src.parents)[:3]:
        candidate = base / "pet.json"
        if candidate.is_file():
            return candidate
    return None


# ---------------------------------------------------------------- 装进格子


def trim_frame(img: Image.Image) -> Image.Image:
    """裁掉四周全透明的行列。默认不开——见模块开头的锚点说明"""
    box = img.getbbox()
    return img.crop(box) if box else img


def fit_frame(img: Image.Image, cell: tuple[int, int], mode: str) -> tuple[Image.Image, str | None]:
    """把一帧放进固定格子，返回 (结果, 警告)

    pad   居中放，不缩放。装不下就报错——默认行为，像素一个不动
    scale 等比缩到装得下，只用最近邻。缩放比不是整数分之一时给警告
    crop  居中裁掉超出的部分
    """
    cw, ch = cell
    iw, ih = img.size
    canvas = Image.new("RGBA", cell, (0, 0, 0, 0))
    warn = None

    if mode == "scale" and (iw > cw or ih > ch):
        ratio = min(cw / iw, ch / ih)
        nw, nh = max(1, round(iw * ratio)), max(1, round(ih * ratio))
        # 1/2、1/3、1/4 这种整数分之一才不会把像素切碎
        inv = iw / nw
        if abs(inv - round(inv)) > 1e-6:
            warn = f"缩放比 1/{inv:.3f} 不是整数分之一，像素网格会碎"
        img = img.resize((nw, nh), Image.NEAREST)
        iw, ih = nw, nh

    if mode == "crop" and (iw > cw or ih > ch):
        left, top = max(0, (iw - cw) // 2), max(0, (ih - ch) // 2)
        img = img.crop((left, top, left + min(cw, iw), top + min(ch, ih)))
        iw, ih = img.size

    if iw > cw or ih > ch:
        raise SystemExit(
            f"{iw}x{ih} 的帧塞不进 {cw}x{ch} 的格子。\n"
            f"要么把 --cell 改大（项目真实规格是 192x64），"
            f"要么 --fit scale 缩一下（会掉细节），要么 --fit crop 裁掉。"
        )

    canvas.alpha_composite(img, ((cw - iw) // 2, (ch - ih) // 2))
    return canvas, warn


def pack(frames: list[Image.Image], cell: tuple[int, int], columns: int) -> tuple[Image.Image, list[tuple[int, int]]]:
    """按网格排进一张图。columns<=0 表示排成单行（现行 Sprite.tsx 只认横条）"""
    cw, ch = cell
    cols = len(frames) if columns <= 0 else min(columns, len(frames))
    rows = -(-len(frames) // cols)  # 向上取整

    sheet = Image.new("RGBA", (cols * cw, rows * ch), (0, 0, 0, 0))
    spots: list[tuple[int, int]] = []
    for i, img in enumerate(frames):
        x, y = (i % cols) * cw, (i // cols) * ch
        sheet.alpha_composite(img, (x, y))
        spots.append((x, y))
    return sheet, spots


# ---------------------------------------------------------------- 体检


def count_colors(img: Image.Image) -> int:
    """不算全透明像素——透明区的 RGB 是垃圾值，算进去会虚高"""
    colors = img.getcolors(maxcolors=1 << 24) or []
    return len({px[:3] for count, px in colors if px[3] > 0})


def audit(sheet: Image.Image, placed: list[Placed], frames: list[Image.Image]) -> list[str]:
    """出图之前自查。只报告不修改——改素材是美术的事"""
    notes: list[str] = []

    colors = count_colors(sheet)
    if colors > MAX_COLORS:
        notes.append(f"调色板 {colors} 色，超过上限 {MAX_COLORS}（CLAUDE.md 二十一·5）")
    else:
        notes.append(f"调色板 {colors} 色，在 {MAX_COLORS} 以内")

    blanks = [p.index for p, img in zip(placed, frames) if img.getbbox() is None]
    if blanks:
        notes.append(f"第 {blanks} 帧是全透明的 —— 多半是帧数给多了")

    if sheet.mode != "RGBA":
        notes.append(f"输出不是 RGBA（是 {sheet.mode}）")

    return notes


# ---------------------------------------------------------------- 输出


def build_config(
    name: str, sheet: Image.Image, cell: tuple[int, int], placed: list[Placed],
    columns: int, fps: int, loop: bool, anchors: dict | None,
) -> dict:
    cw, ch = cell
    cols = len(placed) if columns <= 0 else min(columns, len(placed))
    config = {
        "_生成": "tools/process_sprites.py 自动生成，别手改——改了下次跑就没了",
        "_坐标系": "像素，原点左上角。x 向右，y 向下",
        "图片": f"{name}.png",
        "尺寸": list(sheet.size),
        "帧": {
            "宽": cw,
            "高": ch,
            "数量": len(placed),
            "列数": cols,
            "行数": -(-len(placed) // cols),
        },
        "fps": fps,
        "循环": loop,
        "帧坐标": [
            {"i": p.index, "x": p.x, "y": p.y, "w": p.w, "h": p.h, "源": p.origin}
            for p in placed
        ],
    }
    if anchors:
        # 锚点是相对整帧的 0–1，换格子尺寸不用改数值，原样带过来
        config["锚点"] = anchors
        config["_锚点说明"] = "相对坐标 0–1，相对单帧。换 cell 尺寸不影响这组数"
    return config


def pet_json_entry(name: str, count: int, fps: int, loop: bool) -> str:
    """顺手给一段能直接粘进 pet.json「动画」里的 JSON"""
    entry = {"文件": f"{name}.png", "帧数": count, "fps": fps, "循环": loop}
    return f'"{name}": ' + json.dumps(entry, ensure_ascii=False)


# ---------------------------------------------------------------- 主流程


def read_pet_json(path: Path, name: str) -> tuple[tuple[int, int] | None, int | None, int | None, dict | None]:
    """从 pet.json 捞规格：精灵尺寸、这套动画的帧数与 fps、锚点"""
    spec = json.loads(path.read_text(encoding="utf-8"))

    cell = None
    raw = (spec.get("规格") or {}).get("精灵尺寸", "")
    match = re.search(r"(\d+)\s*[x×]\s*(\d+)", raw)
    if match:
        cell = (int(match.group(1)), int(match.group(2)))

    anim = (spec.get("动画") or {}).get(name) or {}
    return cell, anim.get("帧数"), anim.get("fps"), spec.get("锚点")


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="把动画序列图切成统一网格的 Sprite Sheet，并生成帧坐标 JSON",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="项目真实规格是 192x64（见 public/assets/pet/pet.json 的 _尺寸依据）",
    )
    ap.add_argument("src", type=Path, help="源：单帧文件夹，或一张条状精灵表")
    ap.add_argument("-o", "--out", type=Path, default=Path("build/sprites"), help="输出目录（默认 build/sprites）")
    ap.add_argument("--name", help="输出文件名，不给就用源文件/文件夹名")
    ap.add_argument("--cell", type=parse_cell, default=None, help="格子尺寸，64 或 192x64（默认 64x64）")
    ap.add_argument("--frames", type=int, help="源是条状表时，它有几帧")
    ap.add_argument("--columns", type=int, default=0, help="每行几格。默认 0 = 全排一行（现行渲染只认横条）")
    ap.add_argument("--fit", choices=("pad", "scale", "crop"), default="pad", help="装不进格子时怎么办（默认 pad：不缩放，装不下就报错）")
    ap.add_argument("--fps", type=int, default=8, help="写进 JSON 的帧率（默认 8，宪法十三规定的角色帧率）")
    ap.add_argument("--no-loop", action="store_true", help="标记为不循环")
    ap.add_argument("--trim", action="store_true", help="裁掉每帧四周的透明边（会让 pet.json 的锚点失准，慎用）")
    ap.add_argument("--pet-json", type=Path, help="从 pet.json 读格子尺寸/帧数/fps/锚点。不给就顺着素材路径自动找")
    ap.add_argument("--no-pet-json", action="store_true", help="别去自动找 pet.json，全听命令行的")
    ap.add_argument("--force", action="store_true", help="允许覆盖已存在的输出文件")
    ap.add_argument("--dry-run", action="store_true", help="只算不写，看看会得到什么")
    args = ap.parse_args(argv)

    name = args.name or (args.src.name if args.src.is_dir() else args.src.stem)
    cell, frames, fps, anchors = args.cell, args.frames, args.fps, None

    # pet.json 是帧数和规格的唯一权威。没显式给就顺着素材路径往上找一下，
    # 找不到再退回默认值 —— 帧数猜错的代价是切出一堆半条儒艮，不值得省这一步
    spec_path = args.pet_json
    if spec_path is None and not args.no_pet_json and args.src.is_file():
        spec_path = find_pet_json(args.src)
        if spec_path:
            print(f"自动找到规格：{spec_path}")

    if spec_path:
        j_cell, j_frames, j_fps, j_anchors = read_pet_json(spec_path, name)
        cell = cell or j_cell
        frames = frames or j_frames
        anchors = j_anchors
        if j_fps and args.fps == 8:  # 命令行没显式改过 fps 才让 pet.json 说了算
            fps = j_fps

    if cell is None:
        cell = DEFAULT_CELL
        print(f"没给 --cell，用默认 {cell[0]}x{cell[1]}（项目真实规格是 192x64）")

    loaded = load_frames(args.src, cell, frames)
    src_w, src_h = loaded[0].image.size
    print(f"读到 {len(loaded)} 帧，源尺寸 {src_w}x{src_h}")

    images, warns = [], []
    for f in loaded:
        img = trim_frame(f.image) if args.trim else f.image
        fitted, warn = fit_frame(img, cell, args.fit)
        images.append(fitted)
        if warn:
            warns.append(f"{f.origin}: {warn}")

    sheet, spots = pack(images, cell, args.columns)
    placed = [
        Placed(i, x, y, cell[0], cell[1], f.origin)
        for i, ((x, y), f) in enumerate(zip(spots, loaded))
    ]

    print(f"精灵表 {sheet.size[0]}x{sheet.size[1]}，格子 {cell[0]}x{cell[1]}，"
          f"{len(placed)} 帧排成 {-(-len(placed) // (len(placed) if args.columns <= 0 else args.columns))} 行")

    for note in audit(sheet, placed, images):
        print(f"  · {note}")
    for w in dict.fromkeys(warns):  # 去重，六帧同样的警告没必要刷六遍
        print(f"  ! {w}")

    config = build_config(name, sheet, cell, placed, args.columns, fps, not args.no_loop, anchors)

    png_path = args.out / f"{name}.png"
    json_path = args.out / f"{name}.json"

    if args.dry_run:
        print(f"\n[dry-run] 会写：{png_path}\n[dry-run] 会写：{json_path}")
        print(f"\n粘进 pet.json 的「动画」：\n  {pet_json_entry(name, len(placed), fps, not args.no_loop)}")
        return 0

    for path in (png_path, json_path):
        if path.exists() and not args.force:
            raise SystemExit(f"{path} 已存在。加 --force 才会覆盖。")

    args.out.mkdir(parents=True, exist_ok=True)
    # optimize 只压体积不改像素；compress_level 9 对这种小图没什么代价
    sheet.save(png_path, "PNG", optimize=True)
    json_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n写好了：\n  {png_path}\n  {json_path}")
    print(f"\n粘进 pet.json 的「动画」：\n  {pet_json_entry(name, len(placed), fps, not args.no_loop)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

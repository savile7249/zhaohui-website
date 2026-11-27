"""后台图片上传校验、Markdown 文档导入解析与 CSV/JSON 参数表导入解析。
纯 Python 标准库实现，不依赖额外第三方包（如 Pillow）。
"""

import csv
import hashlib
import io
import json
import os
import re
import struct
from pathlib import Path
from django.conf import settings


class UploadValidationError(ValueError):
    pass


ALLOWED_IMAGE_EXTENSIONS = {".webp", ".png", ".jpg", ".jpeg"}
MAX_MARKDOWN_BYTES = 1 * 1024 * 1024
MAX_SPECS_BYTES = 1 * 1024 * 1024


def _parse_png_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 24 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise UploadValidationError("PNG 文件头校验失败，请上传有效的 PNG 图片。")
    width, height = struct.unpack(">II", data[16:24])
    return width, height


def _parse_webp_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise UploadValidationError("WebP 文件头校验失败，请上传有效的 WebP 图片。")
    chunk = data[12:16]
    if chunk == b"VP8X" and len(data) >= 30:
        w = 1 + int.from_bytes(data[24:27], "little")
        h = 1 + int.from_bytes(data[27:30], "little")
        return w, h
    if chunk == b"VP8L" and len(data) >= 25:
        bits = struct.unpack("<I", data[21:25])[0]
        w = (bits & 0x3FFF) + 1
        h = ((bits >> 14) & 0x3FFF) + 1
        return w, h
    if chunk == b"VP8 " and len(data) >= 30:
        # VP8 keyframe starts with 0x9d 0x01 0x2a at offset 23
        if data[23:26] == b"\x9d\x01\x2a":
            w_raw, h_raw = struct.unpack("<HH", data[26:30])
            return w_raw & 0x3FFF, h_raw & 0x3FFF
    return 0, 0


def _parse_jpeg_dimensions(data: bytes) -> tuple[int, int]:
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        raise UploadValidationError("JPEG 文件头校验失败，请上传有效的 JPG/JPEG 图片。")
    i = 2
    n = len(data)
    sof_markers = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}
    while i < n - 1:
        if data[i] != 0xFF:
            i += 1
            continue
        while i < n and data[i] == 0xFF:
            i += 1
        if i >= n:
            break
        marker = data[i]
        i += 1
        if marker in (0xD8, 0xD9, 0x01) or (0xD0 <= marker <= 0xD7):
            continue
        if i + 2 > n:
            break
        seg_len = struct.unpack(">H", data[i : i + 2])[0]
        if seg_len < 2 or i + seg_len > n:
            break
        if marker in sof_markers and i + 7 <= n:
            height, width = struct.unpack(">HH", data[i + 3 : i + 7])
            return width, height
        i += seg_len
    return 0, 0


def inspect_image_bytes(data: bytes, filename: str) -> tuple[str, int, int, int]:
    """Validate extension, size, magic bytes; returns (ext, size, width, height)."""
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise UploadValidationError("仅支持上传 .webp、.png、.jpg、.jpeg 格式图片。")

    size = len(data)
    if size <= 0:
        raise UploadValidationError("上传的图片文件为空。")

    max_bytes = getattr(settings, "MAX_UPLOAD_IMAGE_BYTES", 5 * 1024 * 1024)
    if size > max_bytes:
        raise UploadValidationError(f"图片体积超出限制（上限 {max_bytes // (1024 * 1024)} MB）。")

    if ext == ".png":
        w, h = _parse_png_dimensions(data)
    elif ext == ".webp":
        w, h = _parse_webp_dimensions(data)
    else:
        w, h = _parse_jpeg_dimensions(data)

    return ext, size, w, h


def save_uploaded_managed_image(uploaded_file, *, site_slug: str, name_hint: str = "") -> dict:
    """Validate and atomically store uploaded image into MANAGED_UPLOAD_DIR."""
    data = uploaded_file.read()
    ext, size, width, height = inspect_image_bytes(data, uploaded_file.name)

    stem_src = name_hint or Path(uploaded_file.name).stem
    safe_stem = re.sub(r"[^a-z0-9_-]+", "-", stem_src.lower()).strip("-_")[:40] or "asset"
    digest = hashlib.sha256(data).hexdigest()[:10]
    safe_site = re.sub(r"[^a-z0-9_-]+", "-", site_slug.lower()).strip("-_") or "site"
    filename = f"{safe_site}-{safe_stem}-{digest}{ext}"

    target_dir = Path(settings.MANAGED_UPLOAD_DIR)
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / filename
    tmp_path = target_dir / f".{filename}.tmp.{os.getpid()}"
    tmp_path.write_bytes(data)
    os.replace(tmp_path, target_path)

    url_prefix = getattr(settings, "MANAGED_IMAGE_URL_PREFIX", "/images/site/managed/").rstrip("/")
    return {
        "image_path": f"{url_prefix}/{filename}",
        "code": f"upload-{safe_stem[:28]}-{digest[:6]}",
        "file_size": size,
        "width": width,
        "height": height,
        "disk_path": str(target_path),
    }


def parse_markdown_upload(uploaded_file) -> dict:
    """Parse uploaded .md file into extracted title, summary, and cleaned markdown body."""
    name = (uploaded_file.name or "").lower()
    if not (name.endswith(".md") or name.endswith(".markdown") or name.endswith(".txt")):
        raise UploadValidationError("仅支持上传 .md / .markdown / .txt 格式文档。")
    raw = uploaded_file.read()
    if not raw:
        raise UploadValidationError("上传的 Markdown 文档为空。")
    if len(raw) > MAX_MARKDOWN_BYTES:
        raise UploadValidationError("Markdown 文档体积超过 1 MB 上限。")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise UploadValidationError("Markdown 文件必须为 UTF-8 编码。") from exc

    lines = text.replace("\r\n", "\n").split("\n")
    extracted_title = ""
    body_lines = list(lines)

    # Extract first H1 heading as title and remove it from body so page doesn't render duplicate H1
    for idx, line in enumerate(lines):
        stripped = line.strip()
        if not stripped:
            continue
        m = re.match(r"^#\s+(.+)$", stripped)
        if m:
            extracted_title = m.group(1).strip()
            body_lines = lines[:idx] + lines[idx + 1 :]
        break

    cleaned_body = "\n".join(body_lines).strip()

    # Extract first plain paragraph as suggested summary
    extracted_summary = ""
    for para in re.split(r"\n\s*\n", cleaned_body):
        p = para.strip()
        if not p or p.startswith("#") or p.startswith("|") or p.startswith("![") or p.startswith(">") or p.startswith("-") or p.startswith("*"):
            continue
        plain = re.sub(r"[*`_\[\]]+", "", p)
        plain = re.sub(r"\([^)]*\)", "", plain).replace("\n", " ").strip()
        if plain:
            extracted_summary = plain[:180]
            break

    return {
        "title": extracted_title,
        "summary": extracted_summary,
        "body_markdown": cleaned_body,
    }


def normalize_spec_rows(rows: list) -> list[dict]:
    normalized: list[dict] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or item.get("规格种类") or item.get("参数名称") or "").strip()
        if not label:
            continue
        group = str(item.get("group") or item.get("分组") or item.get("规格分类") or "基本规格").strip() or "基本规格"
        value = str(item.get("value") or item.get("规格参数") or item.get("标准值") or "").strip()
        unit = str(item.get("unit") or item.get("单位") or "").strip()
        note = str(item.get("note") or item.get("说明") or item.get("口径与说明") or item.get("备注") or "").strip()
        normalized.append(
            {
                "group": group,
                "label": label,
                "value": value,
                "unit": unit,
                "note": note,
            }
        )
    return normalized


def parse_specs_upload(uploaded_file) -> list[dict]:
    """Parse uploaded .json or .csv specification sheet into normalized spec rows."""
    name = (uploaded_file.name or "").lower()
    raw = uploaded_file.read()
    if not raw:
        raise UploadValidationError("上传的参数文件为空。")
    if len(raw) > MAX_SPECS_BYTES:
        raise UploadValidationError("参数文件体积超过 1 MB 上限。")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise UploadValidationError("参数文件必须为 UTF-8 编码。") from exc

    if name.endswith(".json"):
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError as exc:
            raise UploadValidationError(f"JSON 格式解析失败：{exc}") from exc
        if isinstance(parsed, dict):
            rows = parsed.get("standardSpecs") or parsed.get("specs") or []
        elif isinstance(parsed, list):
            rows = parsed
        else:
            raise UploadValidationError("JSON 参数表须为数组或包含 standardSpecs 字段的对象。")
        result = normalize_spec_rows(rows)
        if not result:
            raise UploadValidationError("未在 JSON 中解析到有效规格行（每行须包含 label / 规格种类）。")
        return result

    if name.endswith(".csv"):
        reader = csv.DictReader(io.StringIO(text))
        rows = list(reader)
        result = normalize_spec_rows(rows)
        if not result:
            raise UploadValidationError(
                "未在 CSV 中解析到有效规格行，请确保表头包含「规格种类」或「label」（可选列：规格分类/group、规格参数/value、单位/unit、口径与说明/note）。"
            )
        return result

    raise UploadValidationError("仅支持上传 .json 或 .csv 格式的参数表文件。")

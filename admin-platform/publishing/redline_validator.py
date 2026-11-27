"""内容红线自动门禁校验器（依据《防腐设备员工参阅手册》与 AGENTS.md 第 4 节）。

分为两级：
- errors（硬性拦截）：绝对化违禁词、未清理内部占位符；命中时禁止保存/同步/发布。
- warnings（需技术审核确认）：待确认牌号（F30/F40/F46/Q235B/Q345R/304/316L 等）、
  具体温压/壁厚/寿命/价格数值承诺、提及高危介质但未注明「专项审核」；
  命中时须由发布者显式勾选「已经技术负责人审核确认」方可生成正式发布快照。
"""

import re

FORBIDDEN_SUPERLATIVES = [
    "耐所有酸碱",
    "耐一切酸碱",
    "永不腐蚀",
    "永久不腐蚀",
    "零维护",
    "免维护终身",
    "行业第一",
    "全国第一",
    "绝对耐腐蚀",
    "万能防腐",
    "100%耐腐",
]

FORBIDDEN_PLACEHOLDERS = [
    "MEDIA SLOT",
    "待填占位",
    "预留占位",
    "Logo 预留",
    "姓名待填",
]

UNCONFIRMED_GRADE_PATTERNS = [
    (re.compile(r"\b(F30|F40|F46)\b", re.IGNORECASE), "待确认喷涂涂层材料"),
    (re.compile(r"\b(Q235B|Q345R|S30408|S31603|316L)\b", re.IGNORECASE), "待确认壳体钢材牌号"),
    (re.compile(r"(?:不锈钢|壳体|牌号|材质|钢板)[^\n。；，,]{0,6}\b304\b|\b304\s*不锈钢", re.IGNORECASE), "待确认壳体钢材牌号（304）"),
]

NUMERIC_COMMITMENT_PATTERNS = [
    (re.compile(r"-?\d+(?:\.\d+)?\s*(?:°C|℃)"), "具体耐温数值"),
    (re.compile(r"-?\d+(?:\.\d+)?\s*(?:MPa|kPa|bar)\b", re.IGNORECASE), "具体压力数值"),
    (re.compile(r"(?:厚度|壁厚|衬厚|膜厚)[^\n。；，,]{0,6}\d+(?:\.\d+)?\s*(?:mm|μm|um)", re.IGNORECASE), "具体厚度数值"),
    (re.compile(r"(?:寿命|质保|耐用)[^\n。；，,]{0,4}\d+\s*年"), "使用寿命年限承诺"),
    (re.compile(r"\d+(?:\.\d+)?\s*(?:元/台|万元/台|元起|万元起)"), "具体价格承诺"),
]

HIGH_RISK_MEDIA = [
    "氢氟酸",
    "高氯酸",
    "氯磺酸",
    "液溴",
    "过氧化氢",
    "混酸",
]


def scan_fields_redlines(field_items: list[tuple[str, str]], combined_text: str | None = None) -> dict:
    errors: list[dict] = []
    warnings: list[dict] = []
    seen_errors: set[tuple[str, str]] = set()
    seen_warnings: set[tuple[str, str]] = set()

    for field_label, raw_text in field_items:
        text = (raw_text or "").strip()
        if not text:
            continue

        for word in FORBIDDEN_SUPERLATIVES:
            if word in text:
                key = (field_label, word)
                if key not in seen_errors:
                    seen_errors.add(key)
                    errors.append(
                        {
                            "field": field_label,
                            "term": word,
                            "message": f"「{field_label}」命中禁止绝对化表述「{word}」，必须删除或改写为客观工况口径。",
                        }
                    )

        for placeholder in FORBIDDEN_PLACEHOLDERS:
            if placeholder.lower() in text.lower():
                key = (field_label, placeholder)
                if key not in seen_errors:
                    seen_errors.add(key)
                    errors.append(
                        {
                            "field": field_label,
                            "term": placeholder,
                            "message": f"「{field_label}」包含内部占位词「{placeholder}」，禁止上线。",
                        }
                    )

        for pattern, reason in UNCONFIRMED_GRADE_PATTERNS:
            for match in pattern.finditer(text):
                term = match.group(0).strip()
                key = (field_label, term.upper())
                if key not in seen_warnings:
                    seen_warnings.add(key)
                    warnings.append(
                        {
                            "field": field_label,
                            "term": term,
                            "reason": reason,
                            "message": f"「{field_label}」提及{reason}「{term}」，须确认已经技术负责人审核。",
                        }
                    )

        for pattern, reason in NUMERIC_COMMITMENT_PATTERNS:
            for match in pattern.finditer(text):
                term = match.group(0).strip()
                key = (field_label, term)
                if key not in seen_warnings:
                    seen_warnings.add(key)
                    warnings.append(
                        {
                            "field": field_label,
                            "term": term,
                            "reason": reason,
                            "message": f"「{field_label}」包含{reason}「{term}」，须确认已有技术审核依据。",
                        }
                    )

    full_text = combined_text if combined_text is not None else "\n".join(t for _, t in field_items if t)
    if full_text:
        hit_media = [m for m in HIGH_RISK_MEDIA if m in full_text]
        if hit_media and "专项审核" not in full_text:
            media_str = "、".join(hit_media)
            warnings.append(
                {
                    "field": "高危介质口径",
                    "term": media_str,
                    "reason": "高危介质缺少专项审核声明",
                    "message": f"正文提及高危介质（{media_str}）但未注明「专项审核」，请补充专项审核边界说明。",
                }
            )

    return {
        "passed": len(errors) == 0,
        "requires_confirmation": len(warnings) > 0,
        "errors": errors,
        "warnings": warnings,
    }


def validate_variant_redlines(
    *,
    title: str,
    craft_tag: str,
    summary: str,
    seo_title: str = "",
    seo_description: str = "",
    specs_json: list | None = None,
    confirm_inputs_json: list | None = None,
) -> dict:
    fields: list[tuple[str, str]] = [
        ("子产品名称", title),
        ("工艺标签", craft_tag),
        ("产品概述", summary),
        ("SEO 标题", seo_title),
        ("SEO 摘要", seo_description),
    ]
    for idx, row in enumerate(specs_json or [], start=1):
        if not isinstance(row, dict):
            continue
        label = str(row.get("label") or f"规格项{idx}")
        val = str(row.get("value") or "").strip()
        unit = str(row.get("unit") or "").strip()
        note = str(row.get("note") or "").strip()
        if val:
            fields.append((f"规格参数·{label}", f"{val} {unit}".strip()))
        if note:
            fields.append((f"规格说明·{label}", note))
    if confirm_inputs_json:
        fields.append(("前期确认清单", "\n".join(str(x) for x in confirm_inputs_json if x)))

    return scan_fields_redlines(fields)


def validate_article_redlines(
    *,
    title: str,
    summary: str,
    seo_title: str = "",
    seo_description: str = "",
    body_markdown: str = "",
) -> dict:
    fields: list[tuple[str, str]] = [
        ("文章标题", title),
        ("文章摘要", summary),
        ("SEO 标题", seo_title),
        ("SEO 摘要", seo_description),
        ("文章正文", body_markdown),
    ]
    return scan_fields_redlines(fields)


def validate_payload_catalog_redlines(payload: dict) -> dict:
    all_errors: list[dict] = []
    all_warnings: list[dict] = []

    for prod in payload.get("products") or []:
        rep = scan_fields_redlines(
            [
                (f"大类产品({prod.get('slug')})·名称", str(prod.get("title") or "")),
                (f"大类产品({prod.get('slug')})·简介", str(prod.get("summary") or "")),
            ]
        )
        all_errors.extend(rep["errors"])
        all_warnings.extend(rep["warnings"])

    for var in payload.get("variants") or []:
        if not var.get("isPublished", True):
            continue
        rep = validate_variant_redlines(
            title=str(var.get("title") or ""),
            craft_tag=str(var.get("craftTag") or ""),
            summary=str(var.get("summary") or ""),
            seo_title=str(var.get("seoTitle") or ""),
            seo_description=str(var.get("seoDescription") or ""),
            specs_json=var.get("standardSpecs") or [],
            confirm_inputs_json=var.get("confirmChecklist") or [],
        )
        prefix = f"子产品[{var.get('categorySlug')}/{var.get('variantSlug')}] "
        for e in rep["errors"]:
            all_errors.append({**e, "field": prefix + e["field"]})
        for w in rep["warnings"]:
            all_warnings.append({**w, "field": prefix + w["field"]})

    for art in payload.get("articles") or []:
        if art.get("status") != "published":
            continue
        rep = validate_article_redlines(
            title=str(art.get("title") or ""),
            summary=str(art.get("summary") or ""),
            seo_title=str(art.get("seoTitle") or ""),
            seo_description=str(art.get("seoDescription") or ""),
            body_markdown=str(art.get("bodyMarkdown") or ""),
        )
        prefix = f"文章[{art.get('categorySlug')}/{art.get('variantSlug')}/{art.get('articleSlug')}] "
        for e in rep["errors"]:
            all_errors.append({**e, "field": prefix + e["field"]})
        for w in rep["warnings"]:
            all_warnings.append({**w, "field": prefix + w["field"]})

    return {
        "passed": len(all_errors) == 0,
        "requires_confirmation": len(all_warnings) > 0,
        "errors": all_errors,
        "warnings": all_warnings,
    }

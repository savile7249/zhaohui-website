"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { isProductSlug, productFamilies, type ProductSlug } from "@/app/products/product-data";
import { contactInfo } from "@/components/contact-data";
import { trackBriefCopySuccess } from "@/components/site-tracker";
import { liningProcessOptions, mediumRiskOptions, shellMaterialOptions, volumePresets } from "./home-data";

function BriefQuerySync({
  onContextFromUrl,
}: {
  onContextFromUrl: (slug: ProductSlug | null, variant: string | null) => void;
}) {
  const searchParams = useSearchParams();
  const productParam = searchParams.get("product");
  const variantParam = searchParams.get("variant");

  useEffect(() => {
    const validSlug = isProductSlug(productParam) ? productParam : null;
    const cleanedVariant = variantParam ? variantParam.trim().toLowerCase() : null;
    onContextFromUrl(validSlug, validSlug ? cleanedVariant : null);
  }, [productParam, variantParam, onContextFromUrl]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#brief") return;
    const target = document.getElementById("brief");
    if (!target) return;

    const rafId = window.requestAnimationFrame(() => {
      const rect = target.getBoundingClientRect();
      if (rect.top < 0 || rect.top > window.innerHeight * 0.6) {
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [productParam, variantParam]);

  return null;
}

export function BriefWorkbench({ variantNames }: { variantNames?: Record<string, string> }) {
  const [slug, setSlug] = useState<ProductSlug | "">("");
  const [variantSlug, setVariantSlug] = useState<string>("");
  const [volume, setVolume] = useState("");
  const [size, setSize] = useState("");
  const [shell, setShell] = useState("");
  const [lining, setLining] = useState("");
  const [riskId, setRiskId] = useState("");
  const [medium, setMedium] = useState("");
  const [temperature, setTemperature] = useState("");
  const [pressure, setPressure] = useState("");
  const [copied, setCopied] = useState(false);

  const handleContextFromUrl = useCallback((nextSlug: ProductSlug | null, nextVariant: string | null) => {
    setSlug(nextSlug ?? "");
    setVariantSlug(nextVariant ?? "");
  }, []);

  const product = productFamilies.find((item) => item.slug === slug) ?? null;
  const variantLabel =
    slug && variantSlug && variantNames ? variantNames[`${slug}/${variantSlug}`] ?? "" : "";
  const risk = mediumRiskOptions.find((item) => item.id === riskId) ?? null;
  const isTank = slug === "tanks";

  const briefText = useMemo(() => {
    const pending = "待补充";
    const lines = [
      "兆辉化工设备 · 询价工况简报",
      "",
      `设备类型　${product ? product.title : pending}`,
    ];
    if (variantLabel) {
      lines.push(`细分机型　${variantLabel}`);
    }
    lines.push(
      isTank ? `容积　　　${volume || pending}` : `主要尺寸　${size.trim() || pending}`,
      `壳体材料　${shell || pending}`,
      `防腐工艺　${lining || pending}`,
      `介质　　　${medium.trim() || `${pending}（名称、浓度、杂质）`}`,
      `温度　　　${temperature.trim() || pending}`,
      `压力　　　${pressure.trim() || `${pending}（注明是否负压）`}`,
      `审核类别　${risk ? `${risk.tier} · ${risk.label}` : pending}`,
      "",
      product
        ? `还需确认：${product.inputs.join("、")}`
        : `还需确认：${pending}（选择设备类型后列出对应核对项）`,
      risk
        ? `随附资料：${risk.extraInputs.join("、")}`
        : `随附资料：${pending}（如有完整组分、浓度、温度及 SDS 可一并附送）`,
      "",
      "本简报仅用于前期沟通，不构成选材或报价结论，最终方案以技术审核为准。",
    );
    return lines.join("\n");
  }, [isTank, lining, medium, pressure, product, risk, shell, size, temperature, variantLabel, volume]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(briefText);
      setCopied(true);
      trackBriefCopySuccess(slug || "");
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pt-brief">
      <Suspense fallback={null}>
        <BriefQuerySync onContextFromUrl={handleContextFromUrl} />
      </Suspense>

      <form className="pt-brief-form" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="pt-field">
          <legend>设备类型</legend>
          <div className="pt-chips">
            {productFamilies.map((item) => (
              <button
                key={item.slug}
                type="button"
                aria-pressed={slug === item.slug}
                className="pt-chip"
                onClick={() => {
                  if (slug !== item.slug) {
                    setVariantSlug("");
                  }
                  setSlug(item.slug);
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
          {variantLabel ? (
            <p className="pt-field-context">
              已带入细分机型：<strong>{variantLabel}</strong>
              <button
                type="button"
                className="pt-field-context-clear"
                onClick={() => setVariantSlug("")}
              >
                清除机型
              </button>
            </p>
          ) : null}
        </fieldset>

        {isTank ? (
          <fieldset className="pt-field">
            <legend>容积</legend>
            <div className="pt-chips">
              {volumePresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  aria-pressed={volume === preset}
                  className="pt-chip"
                  onClick={() => setVolume((prev) => (prev === preset ? "" : preset))}
                >
                  {preset}
                </button>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="pt-field">
            <label htmlFor="pt-size">主要尺寸</label>
            <input
              id="pt-size"
              className="pt-input"
              placeholder={
                slug === "piping"
                  ? "例如：DN100，总长 60 m"
                  : slug
                    ? "例如：直径 2000 mm，高度 8 m"
                    : "例如：20 m³，或直径 2000 mm、高度 8 m / DN100"
              }
              value={size}
              onChange={(event) => setSize(event.target.value)}
            />
          </div>
        )}

        <div className="pt-field-row">
          <div className="pt-field">
            <label htmlFor="pt-shell">壳体材料</label>
            <select id="pt-shell" className="pt-input" value={shell} onChange={(event) => setShell(event.target.value)}>
              <option value="">待补充</option>
              {shellMaterialOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="pt-field">
            <label htmlFor="pt-lining">防腐工艺</label>
            <select id="pt-lining" className="pt-input" value={lining} onChange={(event) => setLining(event.target.value)}>
              <option value="">待补充</option>
              {liningProcessOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="pt-field">
          <label htmlFor="pt-medium">介质名称与浓度</label>
          <input
            id="pt-medium"
            className="pt-input"
            placeholder="例如：31% 盐酸"
            value={medium}
            onChange={(event) => setMedium(event.target.value)}
          />
        </div>

        <div className="pt-field-row">
          <div className="pt-field">
            <label htmlFor="pt-temp">工作温度（°C）</label>
            <input
              id="pt-temp"
              className="pt-input"
              placeholder="例如：常温至 85"
              value={temperature}
              onChange={(event) => setTemperature(event.target.value)}
            />
          </div>
          <div className="pt-field">
            <label htmlFor="pt-pressure">工作压力（MPa）</label>
            <input
              id="pt-pressure"
              className="pt-input"
              placeholder="例如：常压，或含负压"
              value={pressure}
              onChange={(event) => setPressure(event.target.value)}
            />
          </div>
        </div>

        <fieldset className="pt-field">
          <legend>介质类别</legend>
          <div className="pt-risk-options">
            {mediumRiskOptions.map((option) => (
              <label key={option.id} className="pt-risk-option">
                <input
                  type="radio"
                  name="pt-risk"
                  value={option.id}
                  checked={riskId === option.id}
                  onChange={() => setRiskId(option.id)}
                />
                <span>
                  <strong>{option.label}</strong>
                  <small>{option.examples}</small>
                </span>
              </label>
            ))}
          </div>
          <p className={`pt-risk-note ${risk?.id === "special" ? "is-special" : ""}`} role="status">
            <strong>{risk ? risk.tier : "待补充"}</strong>
            {risk
              ? risk.note
              : "未确定介质类别时可留空，技术人员将根据实际组分与浓度核对；氢氟酸、混酸等高危或强氧化介质需进入专项审核。"}
          </p>
        </fieldset>
      </form>

      <aside className="pt-brief-output" aria-label="简报预览">
        <div className="pt-brief-output-head">
          <h3>简报预览</h3>
          <span>随填写实时更新</span>
        </div>
        <pre className="pt-brief-pre">{briefText}</pre>
        <button type="button" className="pt-button" onClick={handleCopy}>
          {copied ? "已复制" : "复制简报"}
        </button>
        <p className="pt-brief-footnote">
          复制后可发送至{" "}
          <a href={contactInfo.email.href}>{contactInfo.email.display}</a>
          ，或致电{" "}
          <a href={contactInfo.phones[0].href}>{contactInfo.phones[0].display}</a> /{" "}
          <a href={contactInfo.phones[1].href}>{contactInfo.phones[1].display}</a>
          ，也可在下方
          <a href="#contact">扫码添加微信</a>
          联系。
        </p>
      </aside>
    </div>
  );
}

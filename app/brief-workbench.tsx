"use client";

import { useMemo, useState } from "react";
import { productFamilies } from "@/app/products/product-data";
import { contactInfo } from "@/components/contact-data";
import { liningProcessOptions, mediumRiskOptions, shellMaterialOptions, volumePresets } from "./home-data";

type Slug = (typeof productFamilies)[number]["slug"];

export function BriefWorkbench() {
  const [slug, setSlug] = useState<Slug>("tanks");
  const [volume, setVolume] = useState<string>(volumePresets[1]);
  const [size, setSize] = useState("");
  const [shell, setShell] = useState<string>(shellMaterialOptions[0]);
  const [lining, setLining] = useState<string>(liningProcessOptions[3]);
  const [riskId, setRiskId] = useState<string>(mediumRiskOptions[1].id);
  const [medium, setMedium] = useState("");
  const [temperature, setTemperature] = useState("");
  const [pressure, setPressure] = useState("");
  const [copied, setCopied] = useState(false);

  const product = productFamilies.find((item) => item.slug === slug) ?? productFamilies[0];
  const risk = mediumRiskOptions.find((item) => item.id === riskId) ?? mediumRiskOptions[0];
  const isTank = slug === "tanks";

  const briefText = useMemo(() => {
    const pending = "待补充";
    return [
      "兆辉化工设备 · 询价工况简报",
      "",
      `设备类型　${product.title}`,
      isTank ? `容积　　　${volume}` : `主要尺寸　${size.trim() || pending}`,
      `壳体材料　${shell}`,
      `防腐工艺　${lining}`,
      `介质　　　${medium.trim() || `${pending}（名称、浓度、杂质）`}`,
      `温度　　　${temperature.trim() || pending}`,
      `压力　　　${pressure.trim() || `${pending}（注明是否负压）`}`,
      `审核类别　${risk.tier} · ${risk.label}`,
      "",
      `还需确认：${product.inputs.join("、")}`,
      `随附资料：${risk.extraInputs.join("、")}`,
      "",
      "本简报仅用于前期沟通，不构成选材或报价结论，最终方案以技术审核为准。",
    ].join("\n");
  }, [isTank, lining, medium, pressure, product, risk, shell, size, temperature, volume]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(briefText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pt-brief">
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
                onClick={() => setSlug(item.slug)}
              >
                {item.title}
              </button>
            ))}
          </div>
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
                  onClick={() => setVolume(preset)}
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
              placeholder={slug === "piping" ? "例如：DN100，总长 60 m" : "例如：直径 2000 mm，高度 8 m"}
              value={size}
              onChange={(event) => setSize(event.target.value)}
            />
          </div>
        )}

        <div className="pt-field-row">
          <div className="pt-field">
            <label htmlFor="pt-shell">壳体材料</label>
            <select id="pt-shell" className="pt-input" value={shell} onChange={(event) => setShell(event.target.value)}>
              {shellMaterialOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="pt-field">
            <label htmlFor="pt-lining">防腐工艺</label>
            <select id="pt-lining" className="pt-input" value={lining} onChange={(event) => setLining(event.target.value)}>
              {liningProcessOptions.map((option) => (
                <option key={option}>{option}</option>
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
          <p className={`pt-risk-note ${risk.id === "special" ? "is-special" : ""}`} role="status">
            <strong>{risk.tier}</strong>
            {risk.note}
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

import type { CSSProperties } from "react";
import Image from "next/image";
import { ZhaohuiMark } from "@/components/zhaohui-mark";
import { aboutCompanyProfile, partnerLogos, type PartnerLogoItem } from "./home-data";

interface RingConfig {
  ring: 1 | 2 | 3;
  radiusCqw: number;
  startDeg: number;
  direction: "cw" | "ccw";
  durationSec: number;
  items: PartnerLogoItem[];
}

// 收紧后的同心半圆轨道半径（17.5 / 26.7 / 35.9 cqw），40 枚透明底 Logo 按 10 + 13 + 17 排布
const ringSpecs: readonly Omit<RingConfig, "items">[] = [
  { ring: 1, radiusCqw: 17.5, startDeg: 18, direction: "cw", durationSec: 64 },
  { ring: 2, radiusCqw: 26.7, startDeg: 6, direction: "ccw", durationSec: 84 },
  { ring: 3, radiusCqw: 35.9, startDeg: 12, direction: "cw", durationSec: 104 },
];

const orbitRings: readonly RingConfig[] = ringSpecs.map((spec) => ({
  ...spec,
  items: partnerLogos.filter((item) => item.ring === spec.ring),
}));

export function PartnerOrbitWall() {
  return (
    <div className="pt-about-stage" data-rise>
      {/* 桌面端（≥ 1024px）：无外框线、无轨道框线，圆心居中，左半圆紧密旋转，右半承载文案 */}
      <div className="pt-orbit-stage" role="region" aria-label="关于兆辉与合作客户半圆轨道展示">
        <div className="pt-orbit-rings">
          {orbitRings.map((orbit) => {
            const stepDeg = 360 / orbit.items.length;
            const ringStyle = {
              "--orbit-duration": `${orbit.durationSec}s`,
              "--orbit-radius": `${orbit.radiusCqw}cqw`,
            } as CSSProperties;

            return (
              <ul
                key={orbit.ring}
                className={`pt-orbit-ring is-${orbit.direction}`}
                style={ringStyle}
                aria-label={`合作企业第 ${orbit.ring} 半圆轨道`}
              >
                {orbit.items.map((partner, index) => {
                  const angle = orbit.startDeg + index * stepDeg;
                  const nodeStyle = {
                    "--orbit-angle": `${angle}deg`,
                  } as CSSProperties;

                  return (
                    <li key={partner.id} className="pt-orbit-node" style={nodeStyle}>
                      <div className="pt-orbit-plaque" title={partner.name}>
                        <span className="pt-orbit-logo-box">
                          <Image
                            src={partner.logo}
                            alt={partner.name}
                            fill
                            loading="eager"
                            sizes="112px"
                          />
                        </span>
                        <span className="pt-orbit-tech-line" aria-hidden="true" />
                      </div>
                    </li>
                  );
                })}
              </ul>
            );
          })}
        </div>

        {/* 处于视觉正中心的兆辉标志与标语 */}
        <div className="pt-orbit-center">
          <div className="pt-orbit-medallion">
            <ZhaohuiMark tone="dark" width={188} height={68} className="pt-orbit-mark" />
            <p className="pt-orbit-brand-title">{aboutCompanyProfile.wallCenterTitle}</p>
            <span className="pt-orbit-rule" aria-hidden="true" />
            <p className="pt-orbit-slogan">{aboutCompanyProfile.wallCenterSlogan}</p>
          </div>
        </div>
      </div>

      {/* 企业文案区：桌面端位于视觉中心圆盘右侧，窄屏自动排布至顶部 */}
      <div className="pt-about-editorial">
        <p className="pt-label">
          <span>01</span>
          关于兆辉
        </p>
        <h2 className="pt-h2 pt-about-heading">
          始于 2009 年，
          <br />
          专注防腐与非标设备制造。
        </h2>
        <div className="pt-about-copy-body">
          <p>{aboutCompanyProfile.lead}</p>
          <p>{aboutCompanyProfile.summary}</p>
        </div>
      </div>

      {/* 窄屏（< 1024px）：居中标志 + 三条无框水平循环轨道 */}
      <div className="pt-orbit-mobile" role="region" aria-label="合作客户与科研院所展示">
        <div className="pt-orbit-mobile-core">
          <div className="pt-orbit-mobile-medallion">
            <ZhaohuiMark tone="dark" width={156} height={56} className="pt-orbit-mark" />
            <p className="pt-orbit-brand-title">{aboutCompanyProfile.wallCenterTitle}</p>
            <span className="pt-orbit-rule" aria-hidden="true" />
            <p className="pt-orbit-slogan">{aboutCompanyProfile.wallCenterSlogan}</p>
          </div>
        </div>

        <div className="pt-orbit-mobile-rails">
          {orbitRings.map((orbit) => (
            <div key={orbit.ring} className="pt-partner-marquee">
              <div className={`pt-partner-marquee-track is-ring-${orbit.ring}`}>
                {[0, 1].map((dup) => (
                  <ul key={dup} className="pt-partner-marquee-group" aria-hidden={dup === 1 || undefined}>
                    {orbit.items.map((partner) => (
                      <li key={`${dup}-${partner.id}`} className="pt-partner-tile">
                        <span className="pt-partner-tile-box">
                          <Image
                            src={partner.logo}
                            alt={dup === 0 ? partner.name : ""}
                            fill
                            loading="eager"
                            sizes="116px"
                          />
                        </span>
                        <span className="pt-orbit-tech-line" aria-hidden="true" />
                      </li>
                    ))}
                  </ul>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

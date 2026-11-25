import Image from "next/image";
import { certificateItems, patentItems } from "./home-data";

export function CredentialsExplorer() {
  return (
    <div className="pt-archives">
      {/* 轨道 1：资质与荣誉证书自动轮播 */}
      <div className="pt-archive-block" data-rise>
        <div className="pt-archive-head">
          <div>
            <h3 className="pt-h3">资质与荣誉证书</h3>
            <p className="pt-archive-meta">
              危化品罐体生产许可、管理体系认证、出口合规与企业信用存档，共 <strong>{certificateItems.length}</strong>{" "}
              项。
            </p>
          </div>
        </div>

        <div className="pt-marquee" role="region" aria-label="资质与荣誉证书自动轮播展示">
          <div className="pt-marquee-track is-certs">
            {[0, 1].map((dup) => (
              <ul key={dup} className="pt-marquee-group" aria-hidden={dup === 1 || undefined}>
                {certificateItems.map((cert, index) => (
                  <li key={`${dup}-${cert.id}`} className="pt-rail-item is-cert">
                    <figure className="pt-doc-card">
                      <div className="pt-doc-frame is-cert">
                        <Image
                          src={cert.image}
                          alt={dup === 0 ? cert.title : ""}
                          fill
                          sizes="(min-width: 900px) 300px, 72vw"
                        />
                      </div>
                      <figcaption className="pt-doc-meta">
                        <span className="pt-doc-index">
                          {String(index + 1).padStart(2, "0")} · {cert.groupLabel}
                        </span>
                        <h4>{cert.title}</h4>
                        <p>{cert.code}</p>
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>

      {/* 轨道 2：专利证书自动轮播 */}
      <div className="pt-archive-block" data-rise>
        <div className="pt-archive-head">
          <div>
            <h3 className="pt-h3">专利证书</h3>
            <p className="pt-archive-meta">
              现行有效独立专利共 <strong>{patentItems.length}</strong> 项，含国家发明专利 <strong>03</strong>{" "}
              项、有效实用新型专利 <strong>19</strong> 项。
            </p>
          </div>
        </div>

        <div className="pt-marquee" role="region" aria-label="专利证书自动轮播展示">
          <div className="pt-marquee-track is-patents">
            {[0, 1].map((dup) => (
              <ul key={dup} className="pt-marquee-group" aria-hidden={dup === 1 || undefined}>
                {patentItems.map((patent, index) => (
                  <li key={`${dup}-${patent.id}`} className="pt-rail-item is-patent">
                    <figure className="pt-doc-card">
                      <div className="pt-doc-frame is-patent">
                        <Image
                          src={patent.image}
                          alt={dup === 0 ? `${patent.type}：${patent.title}` : ""}
                          fill
                          sizes="(min-width: 900px) 250px, 64vw"
                        />
                      </div>
                      <figcaption className="pt-doc-meta">
                        <span className={`pt-doc-index ${patent.type === "发明专利" ? "is-accent" : ""}`}>
                          {String(index + 1).padStart(2, "0")} · {patent.type}
                        </span>
                        <h4>{patent.title}</h4>
                        <p>{patent.number}</p>
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { contactInfo } from "@/components/contact-data";
import { ZhaohuiMark } from "@/components/zhaohui-mark";
import { getManagedIcpNumber } from "@/lib/managed-content";

interface SiteFooterProps {
  /** 是否在首页内渲染（首页使用页内锚点；子页面使用 /#... 链接） */
  isHome?: boolean;
  /** 是否在页脚展示社交平台二维码（首页上方已有独立联系区块，子页面在页脚展示二维码） */
  showQr?: boolean;
}

export function SiteFooter({ isHome = false, showQr = false }: SiteFooterProps) {
  const anchor = (hash: string) => (isHome ? `#${hash}` : `/#${hash}`);

  return (
    <footer className="pt-footer">
      <div className="pt-wrap pt-footer-grid">
        <div className="pt-footer-brand">
          <ZhaohuiMark tone="inverse" width={104} height={38} />
          <p>兆辉化工设备</p>
        </div>

        <div className="pt-footer-col pt-footer-contact">
          <h2>联系</h2>
          <dl className="pt-footer-contact-list">
            <div>
              <dt>电话</dt>
              <dd className="pt-footer-phones">
                {contactInfo.phones.map((phone, index) => (
                  <span key={phone.href}>
                    {index > 0 && <span className="pt-footer-sep" aria-hidden="true">/</span>}
                    <a href={phone.href}>{phone.display}</a>
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt>邮箱</dt>
              <dd>
                <a href={contactInfo.email.href}>{contactInfo.email.display}</a>
              </dd>
            </div>
            <div>
              <dt>地址</dt>
              <dd className="pt-footer-addresses">
                {contactInfo.addresses.map((item) => (
                  <span key={item.address}>{item.address}</span>
                ))}
              </dd>
            </div>
          </dl>
        </div>

        <nav className="pt-footer-col pt-footer-nav" aria-label="页脚导航">
          <h2>导航</h2>
          <Link href={anchor("about")}>关于</Link>
          <Link href={anchor("equipment")}>设备</Link>
          <Link href={anchor("credentials")}>应用与资质</Link>
          <Link href={anchor("manufacturing")}>制造</Link>
          <Link href={anchor("contact")}>联系</Link>
        </nav>

        <div className="pt-footer-legal">
          <p>© {new Date().getFullYear()} 兆辉化工设备</p>
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
            {getManagedIcpNumber()}
          </a>
        </div>
      </div>

      {showQr && (
        <div className="pt-wrap">
          <div className="pt-footer-qr-bar" aria-label="社交平台二维码">
            <p className="pt-footer-qr-heading">社交平台</p>
            <ul className="pt-footer-qr-list">
              {contactInfo.socialQrs.map((item) => (
                <li key={item.id}>
                  <figure className="pt-footer-qr-item">
                    <span className="pt-qr-frame is-compact">
                      <Image src={item.image} alt={item.alt} width={200} height={200} />
                    </span>
                    <figcaption>
                      <strong>{item.name}</strong>
                      <span>{item.hint}</span>
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </footer>
  );
}

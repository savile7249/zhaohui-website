export interface ContactPhone {
  display: string;
  href: string;
}

export interface ContactAddress {
  region: string;
  address: string;
}

export interface SocialQrItem {
  id: "wechat" | "wechat-official" | "douyin";
  name: string;
  hint: string;
  image: string;
  alt: string;
}

export const contactInfo = {
  phones: [
    { display: "133-0617-0776", href: "tel:13306170776" },
    { display: "139-6173-8292", href: "tel:13961738292" },
  ] as readonly ContactPhone[],
  email: {
    display: "zhaohuifangfu@163.com",
    href: "mailto:zhaohuifangfu@163.com",
  },
  addresses: [
    {
      region: "江苏无锡",
      address: "无锡市惠山区前洲街道新印桥社区唐洛路\u00A01\u00A0号",
    },
    {
      region: "安徽宣城",
      address: "安徽省宣城市郎溪县经济开发区复兴东路\u00A042\u00A0号",
    },
  ] as readonly ContactAddress[],
  socialQrs: [
    {
      id: "wechat",
      name: "微信",
      hint: "扫码沟通工况",
      image: "/images/contact/wechat.webp",
      alt: "兆辉化工设备微信联系二维码",
    },
    {
      id: "wechat-official",
      name: "公众号",
      hint: "扫码关注动态",
      image: "/images/contact/wechat-official.webp",
      alt: "兆辉化工设备微信公众号二维码",
    },
    {
      id: "douyin",
      name: "抖音",
      hint: "扫码查看现场",
      image: "/images/contact/douyin.webp",
      alt: "兆辉化工设备官方抖音二维码",
    },
  ] as readonly SocialQrItem[],
} as const;

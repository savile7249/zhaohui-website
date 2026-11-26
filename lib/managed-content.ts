export interface SnapshotProductOverride {
  slug: string;
  title: string;
  summary: string;
  image: string;
  imageAlt: string;
}

export interface SnapshotContactOverride {
  phones: Array<{ display: string; href: string }>;
  email: { display: string; href: string };
  addresses: Array<{ region: string; address: string }>;
}

export interface SnapshotDomainConfig {
  officialDomain: string;
  testHost: string;
  previewHost: string;
  isPrimary: boolean;
  icpNumber: string;
  domainStatus: string;
  publicEnabled: boolean;
  canonicalPolicy: string;
  canonicalBase: string;
}

export interface ManagedSnapshotData {
  version: string;
  domain: SnapshotDomainConfig;
  products: SnapshotProductOverride[];
  contact: SnapshotContactOverride;
}

function loadSnapshot(): ManagedSnapshotData | null {
  const raw = process.env.NEXT_PUBLIC_ZHAOHUI_SNAPSHOT;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ManagedSnapshotData;
    if (parsed && typeof parsed === "object" && parsed.domain && Array.isArray(parsed.products)) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export const managedSnapshot: ManagedSnapshotData | null = loadSnapshot();

export function getCanonicalBase(): string {
  const base = managedSnapshot?.domain?.canonicalBase?.trim();
  return base ? base.replace(/\/+$/, "") : "https://jszhff.cn";
}

export function getManagedIcpNumber(): string {
  const icp = managedSnapshot?.domain?.icpNumber?.trim();
  return icp || "苏ICP备20000966号-6";
}

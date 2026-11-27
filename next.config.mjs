import fs from "node:fs";

/** @type {import("next").NextConfig} */
let serializedSnapshot = "";
const snapshotPath = process.env.ZHAOHUI_SNAPSHOT_PATH;
if (snapshotPath && fs.existsSync(snapshotPath)) {
  const raw = fs.readFileSync(snapshotPath, "utf8");
  const parsed = JSON.parse(raw);
  serializedSnapshot = JSON.stringify({
    version: parsed.version,
    domain: parsed.domain,
    products: parsed.products,
    contact: parsed.contact,
  });
}

const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_ZHAOHUI_SNAPSHOT: serializedSnapshot,
    ZHAOHUI_SNAPSHOT_PATH: snapshotPath || "",
  },
};

export default nextConfig;

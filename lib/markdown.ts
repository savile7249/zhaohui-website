// 零依赖受控 Markdown 渲染器（仅在服务端构建期运行）
// 支持：h2/h3/h4、段落、粗体/斜体/行内代码、安全链接、本地受管图片、无序/有序列表、引用块、管道表格。
// 所有原始文本先做 HTML 转义，严禁原样输出不受控 HTML 标签。

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeHref(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (
    url.startsWith("/") ||
    url.startsWith("#") ||
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:")
  ) {
    return url;
  }
  return null;
}

function sanitizeImageSrc(raw: string): string | null {
  const src = raw.trim();
  if (src.startsWith("/images/") && !src.includes("..")) {
    return src;
  }
  return null;
}

function renderInline(raw: string): string {
  // 先对整段做转义，再按固定顺序替换受控行内语法
  let out = escapeHtml(raw);

  // 行内代码 `code`（先提取占位，避免内部星号被误解析）
  const codeTokens: string[] = [];
  out = out.replace(/`([^`\n]+)`/g, (_m, code: string) => {
    const idx = codeTokens.length;
    codeTokens.push(`<code class="pt-md-inline-code">${code}</code>`);
    return `@@CODE_${idx}@@`;
  });

  // 链接 [text](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) => {
    const safe = sanitizeHref(href);
    if (!safe) return label;
    const isExternal = safe.startsWith("http://") || safe.startsWith("https://");
    const extra = isExternal ? ' target="_blank" rel="noopener noreferrer"' : "";
    return `<a href="${escapeHtml(safe)}"${extra}>${label}</a>`;
  });

  // 粗体 **text**
  out = out.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  // 斜体 *text*
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<em>$1</em>");

  // 还原行内代码
  out = out.replace(/@@CODE_(\d+)@@/g, (_m, idxStr: string) => codeTokens[Number(idxStr)] ?? "");
  return out;
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  const cells = splitTableRow(trimmed);
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export interface MarkdownHeading {
  id: string;
  level: 2 | 3;
  text: string;
}

export interface RenderedMarkdown {
  html: string;
  headings: MarkdownHeading[];
}

export function renderControlledMarkdown(source: string): RenderedMarkdown {
  const lines = (source || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: string[] = [];
  const headings: MarkdownHeading[] = [];
  let headingCounter = 0;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    // 1. 独立图片行 ![alt](/images/...)
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (imgMatch) {
      const alt = imgMatch[1].trim();
      const safeSrc = sanitizeImageSrc(imgMatch[2]);
      if (safeSrc) {
        const caption = alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : "";
        blocks.push(
          `<figure class="pt-article-figure"><img src="${escapeHtml(safeSrc)}" alt="${escapeHtml(alt)}" loading="lazy" />${caption}</figure>`,
        );
      }
      i += 1;
      continue;
    }

    // 2. 标题 ## / ### / ####
    const headingMatch = trimmed.match(/^(#{2,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length as 2 | 3 | 4;
      const text = headingMatch[2].trim();
      headingCounter += 1;
      const id = `sec-${headingCounter}`;
      if (level === 2 || level === 3) {
        headings.push({ id, level, text });
      }
      blocks.push(`<h${level} id="${id}">${renderInline(text)}</h${level}>`);
      i += 1;
      continue;
    }

    // 3. 分隔线 ---
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      blocks.push("<hr />");
      i += 1;
      continue;
    }

    // 4. 引用块 > ...
    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i += 1;
      }
      const quoteHtml = quoteLines
        .filter((l) => l.length > 0)
        .map((l) => `<p>${renderInline(l)}</p>`)
        .join("");
      blocks.push(`<blockquote>${quoteHtml}</blockquote>`);
      continue;
    }

    // 5. 管道表格
    if (trimmed.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const headers = splitTableRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length) {
        const rowLine = lines[i].trim();
        if (!rowLine || !rowLine.includes("|")) break;
        rows.push(splitTableRow(rowLine));
        i += 1;
      }
      const thead = `<thead><tr>${headers.map((h) => `<th scope="col">${renderInline(h)}</th>`).join("")}</tr></thead>`;
      const tbody = rows.length
        ? `<tbody>${rows
            .map(
              (r) =>
                `<tr>${headers
                  .map((_h, idx) => `<td>${renderInline(r[idx] ?? "")}</td>`)
                  .join("")}</tr>`,
            )
            .join("")}</tbody>`
        : "";
      blocks.push(`<div class="pt-article-table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    // 6. 无序列表 - / *
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      continue;
    }

    // 7. 有序列表 1.
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(`<ol>${items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ol>`);
      continue;
    }

    // 8. 普通段落（合并连续非块起始行）
    const paraLines: string[] = [];
    while (i < lines.length) {
      const cur = lines[i].trim();
      if (
        !cur ||
        /^#{2,4}\s+/.test(cur) ||
        /^[-*]\s+/.test(cur) ||
        /^\d+\.\s+/.test(cur) ||
        cur.startsWith(">") ||
        /^!\[([^\]]*)\]\(([^)\s]+)\)$/.test(cur) ||
        /^-{3,}$/.test(cur) ||
        (cur.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
      ) {
        break;
      }
      paraLines.push(cur);
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push(`<p>${renderInline(paraLines.join(" "))}</p>`);
    }
  }

  return {
    html: blocks.join("\n"),
    headings,
  };
}

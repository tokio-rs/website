import fs from "fs";
import path from "path";

const siteUrl = "https://tokio.rs";
const outDir = path.join(process.cwd(), "public");
const contentDir = path.join(process.cwd(), "content");

const staticPages = [
  { url: "/", changefreq: "weekly", priority: "1.0" },
  { url: "/blog", changefreq: "weekly", priority: "0.8" },
];

const blogPosts = fs
  .readdirSync(path.join(contentDir, "blog"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => ({
    url: `/blog/${f.replace(/\.md$/, "")}`,
    changefreq: "monthly",
    priority: "0.6",
  }));

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let results = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(full));
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

const docPages = walkDir(path.join(contentDir, "tokio"))
  .map((f) => {
    const rel = path.relative(contentDir, f).replace(/\.md$/, "").replace(/\/index$/, "");
    return {
      url: `/${rel}`,
      changefreq: "monthly",
      priority: "0.7",
    };
  })
  .filter((p) => !p.url.includes("/api"));

const allPages = [...staticPages, ...blogPosts, ...docPages];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
  .map(
    (p) => `  <url>
    <loc>${siteUrl}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "sitemap.xml"), sitemap);
console.log(`sitemap.xml generated with ${allPages.length} URLs`);

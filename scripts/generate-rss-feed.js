import RSS from "rss";
import { getDateOrderedPaths } from "../dist/lib/api.js";
import fs from "fs";
import path from 'path';

const siteUrl = "https://tokio.rs";
const staticOutputPath = path.join(process.cwd(), 'out');

function generateRSSFeed() {
  const feed = new RSS({
    title: "Tokio",
    site_url: siteUrl,
  });

  getDateOrderedPaths("blog").map((post) => {
    feed.item({
      title: post.title,
      guid: post.key,
      url: `${siteUrl}${post.href}`,
      date: new Date(post.date),
    });
  });
  const rss = feed.xml({ indent: true });
  fs.writeFileSync(`${staticOutputPath}/blog/index.xml`, rss);
}

generateRSSFeed();

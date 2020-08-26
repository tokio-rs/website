import RSS from "rss";
import { getDateOrderedPaths } from "../lib/api.js";
import fs from "fs";

const siteUrl = "https://tokio.rs";

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
  fs.writeFileSync("./.next/static/feed.xml", rss);
}

generateRSSFeed();

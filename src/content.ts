import fs from "fs";
import glob from "glob";
import path from "path";
import matter from 'gray-matter'
import remark from 'remark'
import html from 'remark-html'

const contentDir = path.join(process.cwd(), 'content/');

// Get all markdown content paths
export function getPaths() {
  // Find all markdown files in the content directory
  const fileNames = glob.sync(`${contentDir}**/*.md`);

  return fileNames.map((file) => {
    // Strip trailing ".md"
    file = file.replace(/\.md$/, '');

    // Strip prefix
    file = file.replace(contentDir, "");

    // Split on `/` to create an array of components
    return file.split(path.sep);
  });
}

export async function getData(parts) {
    const fileContents = fs.readFileSync(fullPath(parts), 'utf8');
    const matterResult = matter(fileContents)

    const processed = await remark()
        .use(html)
        .process(matterResult.content);

    return {
        html: processed.toString(),
        ...matterResult.data
    };
}

function fullPath(pathParts) {
    return `${path.join(contentDir, ...pathParts)}.md`;
}

export default {
    getPaths,
    getData,
};
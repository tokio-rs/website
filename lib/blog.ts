import * as api from "./api";

let paths = null;

function cachedPaths() {
  if (paths === null) {
    paths = api.getDateOrderedPaths("blog");
  }
  return paths;
}

export function getBlogPostsByYear(limit?: number) {
  let count = 0;
  return cachedPaths().reduce((years, post) => {
    if (limit !== undefined && count >= limit) {
      return years;
    }
    const date = new Date(post.date);
    const year = date.getFullYear().toString();
    if (!years[year]) {
      years[year] = {
        key: year,
        title: year,
        nested: [],
      };
    }
    delete post.body;
    years[year].nested.push(post);
    count++;
    return years;
  }, {});
}

export function getNextPost(afterSlug) {
  let slugIndex = cachedPaths().findIndex((post) => post.key === afterSlug);
  if (slugIndex > 0) {
    return paths[slugIndex - 1];
  }
}

export function getPreviousPost(beforeSlug) {
  let slugIndex = cachedPaths().findIndex((post) => post.key === beforeSlug);
  if (slugIndex !== -1 && slugIndex + 1 < paths.length) {
    return paths[slugIndex + 1];
  }
}

use glob::glob;
use std::collections::HashMap;
use std::env;
use std::fmt::{self, Write};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug)]
struct Level {
    nested: HashMap<String, Level>,
    files: Vec<PathBuf>,
}

fn main() {
    let home = env::var("CARGO_MANIFEST_DIR").unwrap();
    let pattern = format!("{}/../content/tokio/**/*.md", home);
    let base = format!("{}/../content", home);
    let base = Path::new(&base).canonicalize().unwrap();

    let mut level = Level::new();

    for entry in glob(&pattern).unwrap() {
        let path = entry.unwrap();
        let path = Path::new(&path).canonicalize().unwrap();
        let rel = path.strip_prefix(&base).unwrap();

        let mut parts = vec![];

        for part in rel {
            parts.push(part.to_str().unwrap());
        }

        level.insert(path.clone(), &parts[..]);
    }

    let out = format!("{}/doctests.rs", env::var("OUT_DIR").unwrap());

    fs::write(&out, level.to_string()).unwrap();
}

impl Level {
    fn new() -> Level {
        Level {
            nested: HashMap::new(),
            files: vec![],
        }
    }

    fn insert(&mut self, path: PathBuf, rel: &[&str]) {
        if rel.len() == 1 {
            self.files.push(path);
        } else {
            let nested = self
                .nested
                .entry(rel[0].to_string())
                .or_insert(Level::new());
            nested.insert(path, &rel[1..]);
        }
    }

    fn to_string(&self) -> String {
        let mut dst = String::new();

        self.write_inner(&mut dst, 0).unwrap();
        dst
    }

    fn write_into(&self, dst: &mut String, name: &str, level: usize) -> fmt::Result {
        self.write_space(dst, level);
        write!(dst, "pub mod {} {{\n", name)?;

        self.write_inner(dst, level + 1)?;

        self.write_space(dst, level);
        write!(dst, "}}\n")?;

        Ok(())
    }

    fn write_inner(&self, dst: &mut String, level: usize) -> fmt::Result {
        for (name, nested) in &self.nested {
            nested.write_into(dst, name, level)?;
        }

        self.write_space(dst, level);

        for file in &self.files {
            let stem = Path::new(file)
                .file_stem()
                .unwrap()
                .to_str()
                .unwrap()
                .replace("-", "_");

            self.write_space(dst, level);
            write!(dst, "#[doc = include_str!(\"{}\")]\n", file.display())?;
            self.write_space(dst, level);
            write!(dst, "pub fn {}_md() {{}}\n", stem)?;
            // write!(dst, "doc_comment!(include_str!(\"{}\"));\n", file.display())?;
        }

        Ok(())
    }

    fn write_space(&self, dst: &mut String, level: usize) {
        for _ in 0..level {
            dst.push_str("    ");
        }
    }
}

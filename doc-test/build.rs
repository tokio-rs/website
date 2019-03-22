fn main() {
    let mut doc_files = skeptic::markdown_files_of_directory("../content/docs/");
    skeptic::generate_doc_tests(&doc_files);
}

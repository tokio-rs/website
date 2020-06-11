fn main() {
    let doc_files = skeptic::markdown_files_of_directory("../content/tokio");
    skeptic::generate_doc_tests(&doc_files);
}

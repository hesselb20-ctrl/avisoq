pub fn protein_translation(strand: &str) -> Vec<String> {
    let cs: Vec<char> = strand.chars().collect();
    let mut out = Vec::new();
    for ch in cs.chunks(3) {
        let s: String = ch.iter().collect();
        let name = match s.as_str() {
            "AUG" => "Methionine",
            "UUU" | "UUC" => "Phenylalanine",
            "UUA" | "UUG" => "Leucine",
            "UCU" | "UCC" | "UCA" | "UCG" => "Serine",
            "UAU" | "UAC" => "Tyrosine",
            "UGU" | "UGC" => "Cysteine",
            "UGG" => "Tryptophan",
            _ => break,
        };
        out.push(name.to_string());
    }
    out
}

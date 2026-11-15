pub fn protein_translation(strand: &str) -> Vec<String> {
    let chars: Vec<char> = strand.chars().collect();
    let mut res = Vec::new();
    for ch in chars.chunks(3) {
        let codon: String = ch.iter().collect();
        let name = match codon.as_str() {
            "AUG" => "Methionine",
            "UUU" | "UUC" => "Phenylalanine",
            "UUA" | "UUG" => "Leucine",
            "UCU" | "UCC" | "UCA" | "UCG" => "Serine",
            "UAU" | "UAC" => "Tyrosine",
            "UGU" | "UGC" => "Cysteine",
            "UGG" => "Tryptophan",
            "UAA" | "UAG" | "UGA" => break,
            _ => return Vec::new(),
        };
        res.push(name.to_string());
    }
    res
}

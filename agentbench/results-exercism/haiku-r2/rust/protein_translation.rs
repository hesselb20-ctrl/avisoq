pub fn protein_translation(strand: &str) -> Vec<String> {
    let chars: Vec<char> = strand.chars().collect();
    let mut proteins = Vec::new();
    let mut i = 0;
    while i + 3 <= chars.len() {
        let codon: String = chars[i..i + 3]
            .iter()
            .map(|c| c.to_ascii_uppercase())
            .collect();
        let amino = match codon.as_str() {
            "AUG" => "Methionine",
            "UUU" | "UUC" => "Phenylalanine",
            "UUA" | "UUG" => "Leucine",
            "UCU" | "UCC" | "UCA" | "UCG" => "Serine",
            "UAU" | "UAC" => "Tyrosine",
            "UGU" | "UGC" => "Cysteine",
            "UGG" => "Tryptophan",
            "UAA" | "UAG" | "UGA" => break,
            _ => panic!("invalid codon"),
        };
        proteins.push(amino.to_string());
        i += 3;
    }
    proteins
}

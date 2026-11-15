pub fn protein_translation(strand: &str) -> Vec<String> {
    let mut proteins = Vec::new();

    for codon in strand.as_bytes().chunks(3) {
        let codon = match std::str::from_utf8(codon) {
            Ok(codon) => codon,
            Err(_) => return Vec::new(),
        };

        match codon {
            "AUG" => proteins.push("Methionine".to_string()),
            "UUU" | "UUC" => proteins.push("Phenylalanine".to_string()),
            "UUA" | "UUG" => proteins.push("Leucine".to_string()),
            "UCU" | "UCC" | "UCA" | "UCG" => proteins.push("Serine".to_string()),
            "UAU" | "UAC" => proteins.push("Tyrosine".to_string()),
            "UGU" | "UGC" => proteins.push("Cysteine".to_string()),
            "UGG" => proteins.push("Tryptophan".to_string()),
            "UAA" | "UAG" | "UGA" => break,
            _ => return Vec::new(),
        }
    }

    proteins
}

pub fn protein_translation(strand: &str) -> Vec<String> {
    let bytes = strand.as_bytes();
    let mut out: Vec<String> = Vec::new();
    let mut i = 0;
    while i + 3 <= bytes.len() {
        let codon = match std::str::from_utf8(&bytes[i..i + 3]) {
            Ok(c) => c,
            Err(_) => return out,
        };
        let aa = match codon {
            "AUG" => "Methionine",
            "UUU" | "UUC" => "Phenylalanine",
            "UUA" | "UUG" => "Leucine",
            "UCU" | "UCC" | "UCA" | "UCG" => "Serine",
            "UAU" | "UAC" => "Tyrosine",
            "UGU" | "UGC" => "Cysteine",
            "UGG" => "Tryptophan",
            // STOP codons end the protein; unknown codons also end translation
            _ => return out,
        };
        out.push(aa.to_string());
        i += 3;
    }
    out
}

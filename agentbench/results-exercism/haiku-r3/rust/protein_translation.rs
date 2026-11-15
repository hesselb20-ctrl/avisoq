pub fn protein_translation(strand: &str) -> Vec<String> {
    let bytes = strand.as_bytes();
    let mut proteins = Vec::new();
    for chunk in bytes.chunks(3) {
        if chunk.len() < 3 {
            break;
        }
        let name = match (chunk[0], chunk[1], chunk[2]) {
            (b'A', b'U', b'G') => "Methionine",
            (b'U', b'U', b'U') | (b'U', b'U', b'C') => "Phenylalanine",
            (b'U', b'U', b'A') | (b'U', b'U', b'G') => "Leucine",
            (b'U', b'C', _) => "Serine",
            (b'U', b'A', b'U') | (b'U', b'A', b'C') => "Tyrosine",
            (b'U', b'G', b'U') | (b'U', b'G', b'C') => "Cysteine",
            (b'U', b'G', b'G') => "Tryptophan",
            (b'U', b'A', b'A') | (b'U', b'A', b'G') | (b'U', b'G', b'A') => break,
            _ => break,
        };
        proteins.push(name.to_string());
    }
    proteins
}

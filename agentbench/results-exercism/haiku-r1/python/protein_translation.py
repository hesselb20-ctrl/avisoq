_CODON_TABLE = {
    "AUG": "Methionine",
    "UUU": "Phenylalanine", "UUC": "Phenylalanine",
    "UUA": "Leucine", "UUG": "Leucine",
    "UCU": "Serine", "UCC": "Serine", "UCA": "Serine", "UCG": "Serine",
    "UAU": "Tyrosine", "UAC": "Tyrosine",
    "UGU": "Cysteine", "UGC": "Cysteine",
    "UGG": "Tryptophan",
    "UAA": "STOP", "UAG": "STOP", "UGA": "STOP",
}


def protein_translation(strand: str) -> list[str]:
    proteins = []
    for start in range(0, len(strand) - len(strand) % 3, 3):
        codon = strand[start:start + 3]
        if codon not in _CODON_TABLE:
            raise ValueError("Invalid codon")
        amino = _CODON_TABLE[codon]
        if amino == "STOP":
            break
        proteins.append(amino)
    return proteins

_CODONS = {
    "AUG": "Methionine",
    "UUU": "Phenylalanine",
    "UUC": "Phenylalanine",
    "UUA": "Leucine",
    "UUG": "Leucine",
    "UCU": "Serine",
    "UCC": "Serine",
    "UCA": "Serine",
    "UCG": "Serine",
    "UAU": "Tyrosine",
    "UAC": "Tyrosine",
    "UGU": "Cysteine",
    "UGC": "Cysteine",
    "UGG": "Tryptophan",
    "UAA": "STOP",
    "UAG": "STOP",
    "UGA": "STOP",
}


def protein_translation(strand: str) -> list[str]:
    proteins = []
    for start in range(0, len(strand), 3):
        codon = strand[start:start + 3]
        if len(codon) < 3 or codon not in _CODONS:
            raise ValueError("invalid codon")
        amino_acid = _CODONS[codon]
        if amino_acid == "STOP":
            break
        proteins.append(amino_acid)
    return proteins

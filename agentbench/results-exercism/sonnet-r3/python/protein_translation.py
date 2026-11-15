_CODONS = {
    "AUG": "Methionine", "UUU": "Phenylalanine", "UUC": "Phenylalanine",
    "UUA": "Leucine", "UUG": "Leucine", "UCU": "Serine", "UCC": "Serine",
    "UCA": "Serine", "UCG": "Serine", "UAU": "Tyrosine", "UAC": "Tyrosine",
    "UGU": "Cysteine", "UGC": "Cysteine", "UGG": "Tryptophan",
    "UAA": "STOP", "UAG": "STOP", "UGA": "STOP",
}


def protein_translation(strand: str) -> list[str]:
    result = []
    for i in range(0, len(strand), 3):
        aa = _CODONS.get(strand[i:i + 3])
        if aa is None:
            raise ValueError("Invalid codon")
        if aa == "STOP":
            break
        result.append(aa)
    return result

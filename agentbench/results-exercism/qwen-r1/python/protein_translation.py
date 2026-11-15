def protein_translation(strand: str) -> list[str]:
    codon_to_amino_acid = {
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
    }
    stop_codons = {"UAA", "UAG", "UGA"}

    protein = []

    for i in range(0, len(strand), 3):
        codon = strand[i:i + 3]

        if codon in stop_codons:
            break

        if codon not in codon_to_amino_acid:
            raise ValueError(f"Invalid codon: {codon}")

        protein.append(codon_to_amino_acid[codon])

    return protein

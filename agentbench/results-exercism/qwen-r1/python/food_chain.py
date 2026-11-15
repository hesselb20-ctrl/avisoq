def food_chain(start_verse: int, end_verse: int) -> list[str]:
    animals = [
        "fly",
        "spider",
        "bird",
        "cat",
        "dog",
        "goat",
        "cow",
        "horse",
    ]

    comments = {
        1: "",
        2: "It wriggled and jiggled and tickled inside her.",
        3: "How absurd to swallow a bird!",
        4: "Imagine that, to swallow a cat!",
        5: "What a hog, to swallow a dog!",
        6: "Just opened her throat and swallowed a goat!",
        7: "I don't know how she swallowed a cow!",
        8: "She's dead, of course!",
    }

    def verse(verse_number: int) -> list[str]:
        animal = animals[verse_number - 1]
        lines = [f"I know an old lady who swallowed a {animal}."]

        if verse_number == 8:
            lines.append(comments[8])
            return lines

        if comments[verse_number]:
            lines.append(comments[verse_number])

        for current in range(verse_number, 1, -1):
            current_animal = animals[current - 1]
            previous_animal = animals[current - 2]

            if previous_animal == "spider":
                lines.append(
                    f"She swallowed the {current_animal} to catch the "
                    "spider that wriggled and jiggled and tickled inside her."
                )
            else:
                lines.append(
                    f"She swallowed the {current_animal} to catch the {previous_animal}."
                )

        lines.append("I don't know why she swallowed the fly. Perhaps she'll die.")
        return lines

    result: list[str] = []
    for verse_number in range(start_verse, end_verse + 1):
        if result:
            result.append("")
        result.extend(verse(verse_number))

    return result

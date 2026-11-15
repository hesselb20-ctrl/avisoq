def pig_latin(phrase: str) -> str:
    vowels = set("aeiou")

    def translate_word(word: str) -> str:
        if not word:
            return word

        if word[0] in vowels or word.startswith(("xr", "yt")):
            return word + "ay"

        if "qu" in word:
            qu_index = word.index("qu")
            return word[qu_index + 2:] + word[:qu_index + 2] + "ay"

        for i, ch in enumerate(word):
            if ch in vowels or (ch == "y" and i > 0):
                return word[i:] + word[:i] + "ay"

        return word + "ay"

    return " ".join(translate_word(word) for word in phrase.split(" "))

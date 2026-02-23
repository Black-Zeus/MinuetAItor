# Artículos y conectores que van en minúscula (salvo primera palabra)
_LOWERCASE_WORDS = {
    "a", "al", "ante", "bajo", "con", "contra", "de", "del", "desde",
    "en", "entre", "hacia", "hasta", "la", "las", "lo", "los", "para",
    "por", "sin", "sobre", "tras", "un", "una", "unas", "unos", "y", "o",
}

def title_case_es(text: str) -> str:
    """
    Convierte texto a title case español:
    - Primera letra de cada palabra en mayúscula
    - Artículos y conectores en minúscula (excepto la primera palabra)
    """
    if not text:
        return text
    words = text.strip().split()
    result = []
    for i, word in enumerate(words):
        lower = word.lower()
        if i == 0 or lower not in _LOWERCASE_WORDS:
            result.append(lower.capitalize())
        else:
            result.append(lower)
    return " ".join(result)
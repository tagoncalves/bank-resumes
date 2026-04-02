import re


def parse_ars_amount(raw: str) -> float:
    """
    Convert Argentine number strings to float.
    Examples:
      "1.234,56"  -> 1234.56
      "-1.234,56" -> -1234.56
      "(1.234,56)" -> -1234.56
      "1234,56"   -> 1234.56
      "$ 1.234,56" -> 1234.56
    """
    if not raw:
        return 0.0

    cleaned = raw.strip()
    is_negative = cleaned.startswith("-") or (cleaned.startswith("(") and cleaned.endswith(")"))
    # Remove currency symbols, parentheses, spaces, minus
    cleaned = re.sub(r"[$\-\(\)\s]", "", cleaned)

    if not cleaned:
        return 0.0

    # Argentine format: dots as thousands separator, comma as decimal
    if "," in cleaned:
        # Remove all dots (thousands), replace comma with dot (decimal)
        cleaned = cleaned.replace(".", "").replace(",", ".")
    # If no comma, assume plain number (possibly with dots as thousands)
    elif re.match(r"^\d{1,3}(\.\d{3})+$", cleaned):
        cleaned = cleaned.replace(".", "")

    try:
        result = float(cleaned)
        return -result if is_negative else result
    except ValueError:
        return 0.0


def parse_percentage(raw: str) -> float:
    """Parse percentage string like '80,83%' or '80.83%' -> 80.83"""
    if not raw:
        return 0.0
    cleaned = raw.replace("%", "").replace(",", ".").strip()
    try:
        return float(cleaned)
    except ValueError:
        return 0.0

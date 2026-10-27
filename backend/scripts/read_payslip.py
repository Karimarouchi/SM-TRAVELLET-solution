# Lit un bulletin de paie scanné (une page = un mois) et écrit un JSON sur la sortie standard.
import asyncio
import json
import re
import shutil
import statistics
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

try:
    import winocr
except ImportError:
    winocr = None

from pypdf import PdfReader, PdfWriter

MONTHS = {
    "janvier": 1,
    "fevrier": 2,
    "mars": 3,
    "avril": 4,
    "mai": 5,
    "juin": 6,
    "juillet": 7,
    "aout": 8,
    "septembre": 9,
    "octobre": 10,
    "novembre": 11,
    "decembre": 12,
}

LABELS = [
    ("netToPay", ("net a payer", "netapayer")),
    ("css", ("solidarite", "c.soc", "csoc")),
    ("taxable", ("imposable",)),
    ("grossIrpp", ("brut irpp", "brut (irpp)", "brut(irpp)")),
    ("irpp", ("impot", "irpp")),
    ("gross", ("brut cnss", "brut (cnss)", "brut(cnss)")),
    ("cnss", ("cnss",)),
    ("responsibilityBonus", ("responsabilite",)),
    ("functionAllowance", ("ind. de fonction", "ind de fonction", "de fonction")),
    ("presenceBonus", ("prime de presence",)),
    ("transport", ("transport", "transp")),
    ("leave", ("j.conges", "j conges", "conges")),
    ("presence", ("j.presence", "j presence")),
    ("total", ("total",)),
    ("net", ("net",)),
]


def fold(value):
    text = unicodedata.normalize("NFD", str(value or ""))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower().replace("œ", "oe")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def parse_number(raw):
    token = str(raw or "").replace("O", "0").replace("o", "0").replace(" ", "")
    token = re.sub(r"[-–—_|]+$", "", token)
    token = token.replace(".", "").replace(",", ".")
    if token.startswith("."):
        token = f"0{token}"
    if not re.fullmatch(r"\d+(\.\d+)?", token):
        return None
    return float(token)


def words_of(line):
    return [
        {"text": word.text, "x": float(word.bounding_rect.x), "y": float(word.bounding_rect.y)}
        for word in line.words
    ]


def cluster_rows(words):
    rows = []
    for word in sorted(words, key=lambda item: (item["y"], item["x"])):
        if rows and abs(word["y"] - rows[-1]["y"]) <= 16:
            rows[-1]["words"].append(word)
            rows[-1]["y"] = (rows[-1]["y"] * (len(rows[-1]["words"]) - 1) + word["y"]) / len(rows[-1]["words"])
        else:
            rows.append({"y": word["y"], "words": [word]})
    for row in rows:
        row["words"].sort(key=lambda item: item["x"])
        row["text"] = fold(" ".join(word["text"] for word in row["words"]))
    return rows


def merge_amounts(words):
    amounts = []
    index = 0
    while index < len(words):
        current = parse_number(words[index]["text"])
        nxt = parse_number(words[index + 1]["text"]) if index + 1 < len(words) else None
        nxt_raw = str(words[index + 1]["text"]).replace(" ", "") if index + 1 < len(words) else ""
        gap = words[index + 1]["x"] - words[index]["x"] if index + 1 < len(words) else 999
        if current is not None and current < 1000 and gap < 70 and re.fullmatch(r"\d{3},\d{3}", nxt_raw.replace("O", "0").replace("o", "0")):
            joined = parse_number(f"{int(current)}{nxt_raw}")
            if joined is not None:
                amounts.append(joined)
                index += 2
                continue
        if current is not None and nxt is not None and 0 < nxt < 1 and gap < 70 and (nxt_raw.startswith(",") or nxt_raw.startswith(".")):
            amounts.append(round(current + nxt, 3))
            index += 2
            continue
        if current is not None:
            amounts.append(current)
        index += 1
    return amounts


def label_for(text):
    if "affiliation" in text or "matricule fiscal" in text or "salaire de base" in text:
        return None
    if text in {"cnss", "n cnss"} or text.startswith("n cnss") or text.startswith("no cnss"):
        return None
    for key, needles in LABELS:
        if any(needle in text for needle in needles):
            if key == "cnss" and ("affiliation" in text or len(text) > 24):
                continue
            if key == "irpp" and "brut" in text:
                continue
            if key == "presence" and "prime" in text:
                continue
            if key == "net" and "payer" in text:
                continue
            return key
    return None


def header_value(rows, needle):
    for row in rows:
        if needle in row["text"]:
            return row
    return None


def year_in(text):
    match = re.search(r"20\d{2}", str(text or "").replace("O", "0").replace("o", "0"))
    return int(match.group(0)) if match else None


def month_of(rows, words):
    month = None
    year = None
    for row in rows:
        for name, number in MONTHS.items():
            if name in row["text"]:
                month = number
                for word in row["words"]:
                    year = year_in(word["text"]) or year
                break
        if month:
            break
    if year is None:
        top = [year_in(word["text"]) for word in words if word["y"] < 250]
        top = [value for value in top if value]
        if len(set(top)) == 1:
            year = top[0]
    if year is None:
        found = {year_in(word["text"]) for word in words}
        found.discard(None)
        if len(found) == 1:
            year = found.pop()
    return month, year


def digits(value):
    return re.sub(r"\D", "", str(value or ""))


def read_page(result):
    words = []
    for line in result.lines:
        words.extend(words_of(line))
    rows = cluster_rows(words)
    month, year = month_of(rows, words)
    name = ""
    nom = header_value(rows, "nom")
    if nom:
        kept = []
        started = False
        for word in nom["words"]:
            token = fold(word["text"])
            if token in {"nom", "fonction", "matricule"} or token.startswith("fonction"):
                if started:
                    break
                started = token == "nom"
                continue
            if token in {":", ""}:
                continue
            started = True
            kept.append(word["text"])
        name = " ".join(kept).strip(" :-")
    matricule = ""
    for row in rows:
        if "matricule" in row["text"] and "fiscal" not in row["text"]:
            for word in row["words"]:
                if re.fullmatch(r"\d{3,6}", word["text"].replace("O", "0").replace("o", "0")):
                    matricule = word["text"].replace("O", "0").replace("o", "0")
    cnss = ""
    for row in rows:
        if "cnss" in row["text"] and "affiliation" not in row["text"] and "brut" not in row["text"]:
            for word in row["words"]:
                found = digits(word["text"].replace("O", "0").replace("o", "0"))
                if 8 <= len(found) <= 12:
                    cnss = found
                    break
            if cnss:
                break
    base_salary = None
    base = header_value(rows, "salaire de base")
    if base:
        numbers = merge_amounts(base["words"])
        base_salary = numbers[-1] if numbers else None
    anchors = []
    for row in rows:
        key = label_for(row["text"])
        if key and not any(item["key"] == key for item in anchors):
            anchors.append({"key": key, "y": row["y"]})
    number_words = []
    for row in rows:
        for word in row["words"]:
            if word["x"] < 180:
                continue
            if parse_number(word["text"]) is not None:
                number_words.append(word)
    buckets = {item["key"]: [] for item in anchors}
    for word in number_words:
        nearest = None
        for anchor in anchors:
            distance = abs(word["y"] - anchor["y"])
            if distance <= 34 and (nearest is None or distance < nearest[0]):
                nearest = (distance, anchor["key"])
        if nearest:
            buckets[nearest[1]].append(word)
    fields = {key: merge_amounts(sorted(value, key=lambda item: item["x"])) for key, value in buckets.items()}

    def one(key, index=-1):
        values = fields.get(key) or []
        if not values:
            return None
        return values[index]

    def deduction(key):
        values = fields.get(key) or []
        gross_values = fields.get("gross") or []
        gross = gross_values[-1] if gross_values else None
        if gross is not None:
            smaller = [value for value in values if value < gross - 0.5]
            if smaller:
                return smaller[-1]
        return values[-1] if values else None

    def triple(key):
        values = fields.get(key) or []
        if len(values) >= 3:
            return values[0], values[1], values[-1]
        if len(values) == 2:
            return values[0], None, values[1]
        if len(values) == 1:
            return None, None, values[0]
        return None, None, None

    presence_days, presence_rate, presence_amount = triple("presence")
    leave_days, leave_rate, leave_amount = triple("leave")
    return {
        "month": month,
        "year": year,
        "employeeName": name,
        "matricule": matricule,
        "cnss": cnss,
        "baseSalary": base_salary,
        "presenceDays": presence_days,
        "presenceRate": presence_rate,
        "presenceAmount": presence_amount,
        "leaveDays": leave_days,
        "leaveRate": leave_rate,
        "leaveAmount": leave_amount,
        "transport": one("transport"),
        "presenceBonus": one("presenceBonus"),
        "functionAllowance": one("functionAllowance"),
        "responsibilityBonus": one("responsibilityBonus"),
        "total": one("total"),
        "gross": one("gross"),
        "cnssDeduction": deduction("cnss"),
        "taxable": one("taxable"),
        "irpp": deduction("irpp"),
        "css": deduction("css"),
        "net": one("net"),
        "netToPay": one("netToPay"),
    }


class _Rect:
    def __init__(self, x, y):
        self.x = x
        self.y = y


class _Word:
    def __init__(self, text, x, y):
        self.text = text
        self.bounding_rect = _Rect(x, y)


class _Line:
    def __init__(self, words):
        self.words = words


class _Result:
    def __init__(self, lines):
        self.lines = lines


def recognize_tesseract(image_path):
    import pytesseract
    from pytesseract import Output

    data = pytesseract.image_to_data(image_path, lang="fra", output_type=Output.DICT)
    grouped = {}
    order = []
    for index, raw in enumerate(data["text"]):
        text = str(raw or "").strip()
        if not text or int(data["conf"][index]) < 0:
            continue
        key = (data["block_num"][index], data["par_num"][index], data["line_num"][index])
        if key not in grouped:
            grouped[key] = []
            order.append(key)
        grouped[key].append(_Word(text, float(data["left"][index]), float(data["top"][index])))
    lines = [_Line(grouped[key]) for key in order]
    # Un scan penché décale les montants (à droite) vers la ligne suivante.
    # Tesseract donne des cadres droits : on redresse les y avec la pente médiane.
    slopes = []
    for line in lines:
        ordered = sorted(line.words, key=lambda word: word.bounding_rect.x)
        for left, right in zip(ordered, ordered[1:]):
            dx = right.bounding_rect.x - left.bounding_rect.x
            if dx > 40:
                slopes.append((right.bounding_rect.y - left.bounding_rect.y) / dx)
    slope = statistics.median(slopes) if len(slopes) >= 5 else 0.0
    for line in lines:
        for word in line.words:
            word.bounding_rect.y -= slope * word.bounding_rect.x
    return _Result(lines)


def header_month_tesseract(path, page_index):
    # L'en-tête (mois en haut à droite) est petit : relu seul, en 300 dpi.
    import pytesseract
    from PIL import Image

    folder = tempfile.mkdtemp(prefix="payslip-head-")
    try:
        page = str(page_index + 1)
        subprocess.run(["pdftoppm", "-png", "-r", "300", "-f", page, "-l", page, path, str(Path(folder) / "head")], check=True)
        images = list(Path(folder).glob("head*.png"))
        if not images:
            return None, None
        image = Image.open(images[0]).convert("L")
        top = image.crop((0, 0, image.width, int(image.height * 0.12)))
        text = fold(pytesseract.image_to_string(top, lang="fra", config="--psm 11"))
    finally:
        shutil.rmtree(folder, ignore_errors=True)
    month = next((number for name, number in MONTHS.items() if name in text), None)
    return month, year_in(text)


def render_with_poppler(path):
    if not shutil.which("pdftoppm"):
        raise SystemExit("Lecteur PDF indisponible.")
    folder = tempfile.mkdtemp(prefix="payslip-")
    prefix = str(Path(folder) / "page")
    subprocess.run(["pdftoppm", "-png", "-r", "170", path, prefix], check=True)
    images = sorted(Path(folder).glob("page-*.png"), key=lambda item: int(item.stem.split("-")[-1]))
    if not images:
        shutil.rmtree(folder, ignore_errors=True)
        raise SystemExit("Aucune page dans ce PDF.")
    return images, folder


async def extract(path):
    pages = []
    if winocr is not None and pdfplumber is not None:
        with pdfplumber.open(path) as pdf:
            for index, page in enumerate(pdf.pages):
                image = page.to_image(resolution=170).original
                result = await winocr.recognize_pil(image, "fr")
                slip = read_page(result)
                slip["page"] = index
                pages.append(slip)
        return pages
    images, folder = render_with_poppler(path)
    try:
        for index, image in enumerate(images):
            slip = read_page(recognize_tesseract(str(image)))
            month, year = header_month_tesseract(path, index)
            slip["month"] = month or slip["month"]
            slip["year"] = year or slip["year"]
            slip["page"] = index
            pages.append(slip)
    finally:
        shutil.rmtree(folder, ignore_errors=True)
    return pages


def split(path, page_index, dest):
    reader = PdfReader(path)
    if page_index < 0 or page_index >= len(reader.pages):
        raise SystemExit("Page introuvable.")
    writer = PdfWriter()
    writer.add_page(reader.pages[page_index])
    with open(dest, "wb") as handle:
        writer.write(handle)


def main():
    if len(sys.argv) < 3:
        raise SystemExit("usage: read_payslip.py extract|split ...")
    command = sys.argv[1]
    if command == "extract":
        pages = asyncio.run(extract(sys.argv[2]))
        sys.stdout.reconfigure(encoding="utf-8")
        print(json.dumps(pages, ensure_ascii=False))
        return
    if command == "split":
        split(sys.argv[2], int(sys.argv[3]), sys.argv[4])
        return
    raise SystemExit("Commande inconnue.")


if __name__ == "__main__":
    main()

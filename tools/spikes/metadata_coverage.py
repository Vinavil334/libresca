"""Spike F0.2: metadata coverage of Open Library, Google Books and OPAC SBN.

Reads the Goodreads export from data/private/, samples books with an ISBN
(mostly Italian editions), queries each source and prints ONLY aggregate
numbers. No title, author or ISBN from the export is ever printed.

Raw responses are cached in data/private/spike-f02-cache/ (git-ignored), so
reruns do not hit the APIs again: delete the folder to refetch.

Usage (from the repo root, standard library only):

    python tools/spikes/metadata_coverage.py [--csv PATH] [--it 35] [--foreign 15] [--seed 2026]

Google Books needs GOOGLE_BOOKS_API_KEY (anonymous quota is 0). It is read
from the environment or from .env.local / .env at the repo root. Without it
the Google Books column is skipped.

Throwaway code: it does not belong to packages/ and is not tested.
"""

from __future__ import annotations

import argparse
import csv
import difflib
import hashlib
import itertools
import json
import os
import random
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
PRIVATE = REPO / "data" / "private"
CACHE = PRIVATE / "spike-f02-cache"

SOURCES = ("openlibrary", "googlebooks", "sbn")
LABELS = {"openlibrary": "Open Library", "googlebooks": "Google Books", "sbn": "SBN"}
FIELDS = ("found", "title", "author", "translator", "description", "pages", "cover")
FIELD_LABELS = {
    "found": "edizione trovata",
    "title": "titolo corretto",
    "author": "autore corretto",
    "translator": "traduttore",
    "description": "descrizione",
    "pages": "numero pagine",
    "cover": "copertina",
}
# Minimum interval between requests, per host (Open Library allows 3/s when identified).
MIN_INTERVAL = {"openlibrary.org": 0.4, "www.googleapis.com": 0.3, "opac.sbn.it": 1.0}
TIMEOUT = 20


# ---------------------------------------------------------------- utilities


def load_env_file_values() -> None:
    """Load KEY=VALUE pairs from .env.local / .env without overriding the environment."""
    for name in (".env.local", ".env"):
        path = REPO / name
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip().strip('"').strip("'")
            if value and key.strip() not in os.environ:
                os.environ[key.strip()] = value


def user_agent() -> str:
    contact = os.environ.get("OPEN_LIBRARY_CONTACT") or "https://github.com/Vinavil334/libresca"
    return f"Libresca-spike/0.1 ({contact})"


_last_call: dict[str, float] = {}
stats_http: dict[str, dict[str, int]] = {}


def http_json(url: str, source: str) -> dict | list | None:
    """GET a JSON document with per-host throttling, one retry and a disk cache."""
    CACHE.mkdir(parents=True, exist_ok=True)
    # The cache key must not contain the API key.
    cache_key = re.sub(r"([?&])key=[^&]*", r"\1key=", url)
    cache_file = CACHE / (hashlib.sha256(cache_key.encode()).hexdigest() + ".json")
    if cache_file.is_file():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    counters = stats_http.setdefault(source, {"requests": 0, "errors": 0})
    host = urllib.parse.urlparse(url).hostname or ""
    for attempt in range(2):
        wait = MIN_INTERVAL.get(host, 0.5) - (time.monotonic() - _last_call.get(host, 0.0))
        if wait > 0:
            time.sleep(wait)
        _last_call[host] = time.monotonic()
        counters["requests"] += 1
        request = urllib.request.Request(url, headers={"User-Agent": user_agent(), "Accept": "application/json"})
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
                data = json.loads(response.read().decode("utf-8"))
            cache_file.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
            return data
        except urllib.error.HTTPError as error:
            if error.code == 404:
                cache_file.write_text("null", encoding="utf-8")
                return None
            if error.code in (429, 500, 502, 503, 504) and attempt == 0:
                time.sleep(5)
                continue
            counters["errors"] += 1
            return None
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
            if attempt == 0:
                time.sleep(3)
                continue
            counters["errors"] += 1
            return None
    return None


def strip_accents(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFKD", text) if not unicodedata.combining(c))


def norm(text: str | None) -> str:
    text = strip_accents((text or "").lower())
    text = re.sub(r"[^\w\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def main_title(title: str | None) -> str:
    """Title without series in parentheses, subtitle or SBN statement of responsibility."""
    title = re.sub(r"\(.*?\)", " ", title or "")
    title = re.split(r"\s[:/;=]\s|:\s|\s/", title)[0]
    return norm(title)


def title_matches(expected: str, candidate: str | None) -> bool:
    a, b = main_title(expected), main_title(candidate)
    if not a or not b:
        return False
    if a == b or a in b or b in a:
        return True
    return difflib.SequenceMatcher(None, a, b).ratio() >= 0.85


def author_matches(surname: str, candidates: list[str]) -> bool:
    surname = norm(surname)
    if not surname:
        return False
    haystack = " " + " ".join(norm(c) for c in candidates) + " "
    return all(f" {part} " in haystack for part in surname.split())


def clean_isbn(raw: str | None) -> str:
    return re.sub(r"[^0-9Xx]", "", (raw or "").replace('="', "").replace('"', "")).upper()


def isbn13(raw: str | None) -> str | None:
    """Normalise to a valid ISBN-13, or None."""
    code = clean_isbn(raw)
    if len(code) == 10:
        if not re.fullmatch(r"\d{9}[\dX]", code):
            return None
        total = sum((10 - i) * (10 if ch == "X" else int(ch)) for i, ch in enumerate(code))
        if total % 11:
            return None
        code = "978" + code[:9]
        check = (10 - sum((1 if i % 2 == 0 else 3) * int(ch) for i, ch in enumerate(code)) % 10) % 10
        return code + str(check)
    if len(code) == 13 and code.isdigit():
        check = (10 - sum((1 if i % 2 == 0 else 3) * int(ch) for i, ch in enumerate(code[:12])) % 10) % 10
        return code if int(code[12]) == check else None
    return None


def is_italian(code: str) -> bool:
    # 978-88 and 979-12 are the Italian registration groups.
    return code.startswith("97888") or code.startswith("97912")


def to_int(value: str | None) -> int | None:
    try:
        number = int(str(value).strip())
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


# ---------------------------------------------------------------- data model


@dataclass
class Book:
    isbn: str
    italian: bool
    title: str
    surname: str
    pages: int | None
    year: int | None
    publisher: str
    has_additional_authors: bool
    additional_authors: str = ""


@dataclass
class Result:
    found: bool = False
    title: bool = False
    author: bool = False
    translator: bool = False
    description: bool = False
    pages: bool = False
    pages_close: bool = False
    cover: bool = False
    cover_usable: bool = True
    notes: set[str] = field(default_factory=set)


def read_books(csv_path: Path) -> tuple[list[Book], dict[str, int]]:
    books: list[Book] = []
    counts = {"rows": 0, "with_isbn": 0}
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            counts["rows"] += 1
            code = isbn13(row.get("ISBN13")) or isbn13(row.get("ISBN"))
            if not code:
                continue
            counts["with_isbn"] += 1
            surname = (row.get("Author l-f") or "").split(",")[0] or (row.get("Author") or "").split(" ")[-1]
            books.append(
                Book(
                    isbn=code,
                    italian=is_italian(code),
                    title=row.get("Title") or "",
                    surname=surname,
                    pages=to_int(row.get("Number of Pages")),
                    year=to_int(row.get("Year Published")),
                    publisher=norm(row.get("Publisher")),
                    has_additional_authors=bool((row.get("Additional Authors") or "").strip()),
                    additional_authors=norm(row.get("Additional Authors")),
                )
            )
    return books, counts


def sample(books: list[Book], n_it: int, n_foreign: int, seed: int) -> list[Book]:
    """Deterministic sample that spreads Italian picks across publishers and eras."""
    rng = random.Random(seed)
    unique = list({b.isbn: b for b in books}.values())
    italian = [b for b in unique if b.italian]
    foreign = [b for b in unique if not b.italian]
    rng.shuffle(italian)
    rng.shuffle(foreign)

    # Round-robin across publishers so that a few big publishers do not dominate,
    # with old editions (before 2000) first in each publisher's queue.
    by_publisher: dict[str, list[Book]] = {}
    for book in italian:
        by_publisher.setdefault(book.publisher or "?", []).append(book)
    for queue in by_publisher.values():
        queue.sort(key=lambda b: 0 if (b.year and b.year < 2000) else 1)
    queues = list(by_publisher.values())
    rng.shuffle(queues)
    picked_it: list[Book] = []
    while len(picked_it) < n_it and any(queues):
        for queue in queues:
            if queue and len(picked_it) < n_it:
                picked_it.append(queue.pop(0))
    return picked_it + foreign[:n_foreign]


# ---------------------------------------------------------------- sources

TRANSLATOR_RE = re.compile(r"tradu|trad\.|translat|übersetz|tradu[cç]", re.IGNORECASE)


def check_pages(result: Result, book: Book, pages: int | None) -> None:
    if pages:
        result.pages = True
        if book.pages:
            result.pages_close = abs(pages - book.pages) <= max(10, 0.1 * book.pages)


def fetch_openlibrary(books: list[Book]) -> dict[str, Result]:
    results: dict[str, Result] = {}
    data: dict = {}
    details: dict = {}
    for chunk in (books[i : i + 20] for i in range(0, len(books), 20)):
        keys = ",".join(f"ISBN:{b.isbn}" for b in chunk)
        base = "https://openlibrary.org/api/books?format=json&bibkeys=" + keys
        data.update(http_json(base + "&jscmd=data", "openlibrary") or {})
        details.update(http_json(base + "&jscmd=details", "openlibrary") or {})

    for book in books:
        key = f"ISBN:{book.isbn}"
        result = Result()
        results[book.isbn] = result
        record = data.get(key)
        edition = (details.get(key) or {}).get("details") or {}
        if not record and not edition:
            continue
        result.found = True
        title = (record or {}).get("title") or edition.get("title")
        result.title = title_matches(book.title, title)
        authors = [a.get("name", "") for a in (record or {}).get("authors", [])]
        result.author = author_matches(book.surname, authors)
        if not authors:
            result.notes.add("no_authors")
        elif not result.author:
            tokens = norm(" ".join(authors)).split()
            surname = norm(book.surname)
            if any(difflib.SequenceMatcher(None, surname, t).ratio() >= 0.75 for t in tokens):
                result.notes.add("author_spelling_variant")
            if any(ord(c) > 0x24F and c.isalpha() for c in " ".join(authors)):
                result.notes.add("author_non_latin_ol")
            if any(ord(c) > 0x24F and c.isalpha() for c in book.surname):
                result.notes.add("author_non_latin_gr")
            if book.additional_authors and any(
                len(t) > 2 and f" {t} " in f" {book.additional_authors} " for t in tokens
            ):
                result.notes.add("author_is_additional_author")
        check_pages(result, book, (record or {}).get("number_of_pages") or edition.get("number_of_pages"))
        result.cover = bool((record or {}).get("cover") or edition.get("covers"))

        contributors = " ".join(
            [edition.get("by_statement") or ""]
            + list(edition.get("contributions") or [])
            + [f"{c.get('role', '')} {c.get('name', '')}" for c in edition.get("contributors") or []]
        )
        result.translator = bool(TRANSLATOR_RE.search(contributors))

        description = edition.get("description")
        if not description:
            for work in edition.get("works") or []:
                work_data = http_json(f"https://openlibrary.org{work['key']}.json", "openlibrary") or {}
                if work_data.get("description"):
                    description = work_data["description"]
                    result.notes.add("description_from_work")
                    break
        result.description = bool(description)
    return results


def fetch_googlebooks(books: list[Book], api_key: str) -> dict[str, Result]:
    results: dict[str, Result] = {}
    for book in books:
        result = Result()
        results[book.isbn] = result
        url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{book.isbn}&key={urllib.parse.quote(api_key)}"
        payload = http_json(url, "googlebooks") or {}
        items = payload.get("items") or []
        # Keep only volumes that really carry the requested ISBN.
        match = None
        for item in items:
            ids = {i.get("identifier") for i in item.get("volumeInfo", {}).get("industryIdentifiers", [])}
            if book.isbn in ids or any(isbn13(i) == book.isbn for i in ids if i):
                match = item
                break
        if not match:
            if items:
                result.notes.add("results_without_isbn")
            continue
        info = match.get("volumeInfo", {})
        result.found = True
        result.title = title_matches(book.title, info.get("title"))
        result.author = author_matches(book.surname, info.get("authors") or [])
        result.description = bool(info.get("description"))
        check_pages(result, book, info.get("pageCount"))
        result.cover = bool(info.get("imageLinks"))
        # Google Books has no translator field.
        result.translator = False
    return results


def fetch_sbn(books: list[Book]) -> dict[str, Result]:
    results: dict[str, Result] = {}
    for book in books:
        result = Result()
        results[book.isbn] = result
        search = http_json(f"https://opac.sbn.it/opacmobilegw/search.json?isbn={book.isbn}", "sbn") or {}
        records = [r for r in search.get("briefRecords") or [] if r.get("tipo", "").lower().startswith("testo")]
        if not records:
            continue
        brief = records[0]
        result.found = True
        full = (
            http_json(
                "https://opac.sbn.it/opacmobilegw/full.json?bid=" + urllib.parse.quote(brief["codiceIdentificativo"]),
                "sbn",
            )
            or brief
        )
        result.title = title_matches(book.title, full.get("titolo"))
        names = [full.get("autorePrincipale") or ""] + [re.sub(r"^\[.*?\]\s*", "", n) for n in full.get("nomi") or []]
        result.author = author_matches(book.surname, names)
        statement = (full.get("titolo") or "").split(" / ", 1)
        responsibility = statement[1] if len(statement) > 1 else ""
        result.translator = bool(TRANSLATOR_RE.search(responsibility + " " + " ".join(full.get("note") or [])))
        match = re.search(r"(\d+)\s*p\b", full.get("descrizioneFisica") or "")
        check_pages(result, book, int(match.group(1)) if match else None)
        result.description = False  # SBN has no abstract.
        # The cover is a LibraryThing URL with SBN's developer key: not reusable by us.
        result.cover = bool(full.get("copertina"))
        result.cover_usable = False
    return results


# ---------------------------------------------------------------- report


def pct(part: int, whole: int) -> str:
    return f"{100 * part / whole:5.1f}% ({part}/{whole})" if whole else "   n/d"


def report(books: list[Book], results: dict[str, dict[str, Result]], counts: dict[str, int], all_books: list[Book]) -> None:
    active = [s for s in SOURCES if s in results]
    groups = {
        "Italiani": [b for b in books if b.italian],
        "Stranieri": [b for b in books if not b.italian],
        "Tutti": books,
    }

    print("\n=== Export ===")
    print(f"righe: {counts['rows']}, con ISBN valido: {counts['with_isbn']}, ISBN distinti: {len({b.isbn for b in all_books})}")
    print(f"italiani disponibili: {sum(1 for b in all_books if b.italian)}, stranieri: {sum(1 for b in all_books if not b.italian)}")

    italian = groups["Italiani"]
    print("\n=== Campione ===")
    print(f"italiani: {len(italian)}, stranieri: {len(groups['Stranieri'])}")
    print(f"italiani pubblicati prima del 2000: {sum(1 for b in italian if b.year and b.year < 2000)}")
    print(f"editori italiani distinti: {len({b.publisher for b in italian})}")
    print(f"italiani con 'Additional Authors' (probabili traduzioni o curatele): {sum(1 for b in italian if b.has_additional_authors)}")

    for name, group in groups.items():
        if not group:
            continue
        print(f"\n=== {name} ({len(group)}) ===")
        print(f"{'campo':<20}" + "".join(f"{LABELS[s]:>22}" for s in active))
        for fld in FIELDS:
            row = f"{FIELD_LABELS[fld]:<20}"
            for source in active:
                if fld == "translator":
                    base = [b for b in group if b.has_additional_authors]
                    hits = sum(1 for b in base if results[source][b.isbn].translator)
                    row += f"{pct(hits, len(base)):>22}"
                else:
                    hits = sum(1 for b in group if getattr(results[source][b.isbn], fld))
                    row += f"{pct(hits, len(group)):>22}"
            print(row)
        row = f"{'pagine coerenti GR':<20}"
        for source in active:
            base = [b for b in group if b.pages and results[source][b.isbn].pages]
            hits = sum(1 for b in base if results[source][b.isbn].pages_close)
            row += f"{pct(hits, len(base)):>22}"
        print(row)

    print("\nNote: 'traduttore' è calcolato sui soli libri con 'Additional Authors' in Goodreads.")
    print("      'pagine coerenti GR' = scarto entro 10% (min 10 pagine) dal valore Goodreads.")
    print("      Copertina SBN = URL LibraryThing con chiave di SBN: non riutilizzabile da Libresca.")
    print("      Google Books non ha un campo traduttore.")

    print("\n=== Copertura combinata (almeno una fonte), italiani / stranieri ===")
    fields = [f for f in FIELDS if f != "translator"]
    print(f"{'fonti':<40}" + "".join(f"{FIELD_LABELS[f]:>18}" for f in fields))
    for size in range(1, len(active) + 1):
        for combo in itertools.combinations(active, size):
            row = f"{' + '.join(LABELS[s] for s in combo):<40}"
            for fld in fields:
                cells = []
                for group in (groups["Italiani"], groups["Stranieri"]):
                    hits = 0
                    for b in group:
                        values = []
                        for s in combo:
                            r = results[s][b.isbn]
                            values.append(r.cover and r.cover_usable if fld == "cover" else getattr(r, fld))
                        hits += any(values)
                    cells.append(f"{round(100 * hits / len(group)) if group else 0}%")
                row += f"{' / '.join(cells):>18}"
            print(row)
    print("(copertina combinata: conta solo copertine riutilizzabili, quindi esclude SBN)")

    print("\n=== Edizioni trovate solo da una fonte ===")
    for source in active:
        only = sum(
            1
            for b in books
            if results[source][b.isbn].found and not any(results[o][b.isbn].found for o in active if o != source)
        )
        print(f"{LABELS[source]:<14} {only}")
    missing = [b for b in books if not any(results[s][b.isbn].found for s in active)]
    print(f"{'nessuna fonte':<14} {len(missing)}")

    print("\n=== Diagnostica dei libri non trovati da nessuna fonte ===")
    print(f"italiani: {sum(1 for b in missing if b.italian)}, stranieri: {sum(1 for b in missing if not b.italian)}")
    print(f"prefisso 979-12: {sum(1 for b in missing if b.isbn.startswith('97912'))}")
    buckets = {"senza anno": 0, "< 2000": 0, "2000-2014": 0, "2015-2022": 0, ">= 2023": 0}
    for b in missing:
        if not b.year:
            buckets["senza anno"] += 1
        elif b.year < 2000:
            buckets["< 2000"] += 1
        elif b.year < 2015:
            buckets["2000-2014"] += 1
        elif b.year < 2023:
            buckets["2015-2022"] += 1
        else:
            buckets[">= 2023"] += 1
    print("anno di pubblicazione (Goodreads): " + ", ".join(f"{k}: {v}" for k, v in buckets.items()))
    all_years = [b.year for b in books if b.year]
    if all_years:
        recent = sum(1 for y in all_years if y >= 2023)
        print(f"nel campione intero, libri dal 2023 in poi: {recent}/{len(books)}")

    if "openlibrary" in results:
        ol = results["openlibrary"]
        found = [b for b in books if ol[b.isbn].found]
        print("\n=== Diagnostica Open Library ===")
        print(f"edizioni trovate senza autori collegati: {sum(1 for b in found if 'no_authors' in ol[b.isbn].notes)}/{len(found)}")
        print(f"edizioni trovate con autori ma cognome diverso: {sum(1 for b in found if not ol[b.isbn].author and 'no_authors' not in ol[b.isbn].notes)}")
        print(f"  di cui variante di grafia (somiglianza >= 0.75): {sum(1 for b in found if 'author_spelling_variant' in ol[b.isbn].notes)}")
        print(f"  di cui con titolo corretto: {sum(1 for b in found if not ol[b.isbn].author and ol[b.isbn].title and 'no_authors' not in ol[b.isbn].notes)}")
        print(f"  di cui l'autore OL è un 'Additional Author' Goodreads (traduttore, curatore...): {sum(1 for b in found if 'author_is_additional_author' in ol[b.isbn].notes)}")
        print(f"  di cui con autore OL in alfabeto non latino: {sum(1 for b in found if 'author_non_latin_ol' in ol[b.isbn].notes)}")
        print(f"  di cui con autore Goodreads in alfabeto non latino: {sum(1 for b in found if 'author_non_latin_gr' in ol[b.isbn].notes)}")
        print(f"  di cui stranieri: {sum(1 for b in found if not b.italian and not ol[b.isbn].author and 'no_authors' not in ol[b.isbn].notes)}")

    print("\n=== Richieste HTTP (escluse quelle servite dalla cache) ===")
    for source in SOURCES:
        counters = stats_http.get(source, {"requests": 0, "errors": 0})
        print(f"{LABELS[source]:<14} richieste: {counters['requests']}, errori: {counters['errors']}")
    description_from_work = sum(1 for b in books if "description_from_work" in results.get("openlibrary", {}).get(b.isbn, Result()).notes)
    print(f"\nOpen Library: descrizioni prese dall'opera e non dall'edizione: {description_from_work}")


def find_csv(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit)
    candidates = sorted(PRIVATE.glob("*goodreads*.csv")) or sorted(PRIVATE.glob("*.csv"))
    if not candidates:
        sys.exit(f"Nessun CSV trovato in {PRIVATE}")
    return candidates[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--csv", help="percorso dell'export Goodreads")
    parser.add_argument("--it", type=int, default=35, help="libri italiani nel campione")
    parser.add_argument("--foreign", type=int, default=15, help="libri stranieri nel campione")
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--skip", nargs="*", default=[], choices=SOURCES, help="fonti da saltare")
    args = parser.parse_args()

    for stream in (sys.stdout, sys.stderr):
        stream.reconfigure(encoding="utf-8")
    load_env_file_values()
    all_books, counts = read_books(find_csv(args.csv))
    books = sample(all_books, args.it, args.foreign, args.seed)
    if not books:
        sys.exit("Nessun libro con ISBN valido nell'export")

    results: dict[str, dict[str, Result]] = {}
    if "openlibrary" not in args.skip:
        print("Open Library…", file=sys.stderr)
        results["openlibrary"] = fetch_openlibrary(books)
    api_key = os.environ.get("GOOGLE_BOOKS_API_KEY")
    if "googlebooks" not in args.skip:
        if api_key:
            print("Google Books…", file=sys.stderr)
            results["googlebooks"] = fetch_googlebooks(books, api_key)
        else:
            print("Google Books saltato: manca GOOGLE_BOOKS_API_KEY", file=sys.stderr)
    if "sbn" not in args.skip:
        print("SBN…", file=sys.stderr)
        results["sbn"] = fetch_sbn(books)

    report(books, results, counts, all_books)


if __name__ == "__main__":
    main()

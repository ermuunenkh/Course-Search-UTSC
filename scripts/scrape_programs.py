#!/usr/bin/env python3
"""Scrape the UTSC Academic Calendar program list into a program dictionary."""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag


BASE_URL = "https://utsc.calendar.utoronto.ca/search-programs"
DEFAULT_OUTPUT = Path("data/programs.json")

COURSE_CODE_RE = re.compile(r"\b[A-Z]{3,4}[A-Z]?\d{2,3}[HY](?:[135])?\b")

FIELD_SELECTORS = {
    "description": "views-field-body",
    "admission_requirements_text": "views-field-field-admission-requirements",
    "enrolment_requirements_text": "views-field-field-enrolment-requirements",
    "completion_requirements_text": "views-field-field-completion-requirements",
    "note_text": "views-field-field-note",
}


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_course_codes(text: str) -> list[str]:
    return sorted(set(COURSE_CODE_RE.findall(text or "")))


def split_program_code(heading: str) -> tuple[str, str]:
    if " - " not in heading:
        return heading, ""

    name, possible_code = heading.rsplit(" - ", 1)
    if re.fullmatch(r"[A-Z0-9 ]{4,}", possible_code):
        return clean_text(name), clean_text(possible_code)

    return heading, ""


def fetch_page(session: requests.Session, page: int) -> str:
    response = session.get(BASE_URL, params={"page": page}, timeout=30)
    response.raise_for_status()
    return response.text


def get_last_page(soup: BeautifulSoup) -> int:
    last_link = soup.select_one(".pager__item--last a[href*='page=']")
    if not last_link:
        return 0
    href = last_link.get("href", "")
    match = re.search(r"[?&]page=(\d+)", href)
    return int(match.group(1)) if match else 0


def field_text(program_row: Tag, css_class: str) -> str:
    field = program_row.select_one(f".{css_class} .field-content")
    if not field:
        return ""
    return clean_text(field.get_text(" ", strip=True))


def extract_calendar_sections(program_row: Tag) -> list[dict[str, str]]:
    sections: list[dict[str, str]] = []
    for link in program_row.select(".views-field-field-calendar-section-link a[href]"):
        title = clean_text(link.get_text(" ", strip=True))
        if not title:
            continue
        sections.append(
            {
                "title": title,
                "url": urljoin(BASE_URL, link.get("href", "").strip()),
            }
        )
    return sections


def parse_program(heading: Tag, page: int) -> tuple[str, dict[str, Any]] | None:
    program_title = clean_text(heading.get_text(" ", strip=True))
    if not program_title:
        return None

    content_row = heading.find_next_sibling("div", class_="views-row")
    if not isinstance(content_row, Tag):
        return None

    program_name, program_code = split_program_code(program_title)
    fields = {
        output_key: field_text(content_row, css_class)
        for output_key, css_class in FIELD_SELECTORS.items()
    }

    requirement_text = " ".join(
        value for key, value in fields.items() if key.endswith("_text")
    )
    all_text = " ".join([program_title, fields["description"], requirement_text])

    program = {
        "program_title": program_title,
        "program_name": program_name,
        "program_code": program_code,
        "course_codes": extract_course_codes(all_text),
        "calendar_sections": extract_calendar_sections(content_row),
        "calendar_url": f"{BASE_URL}?page={page}",
        **fields,
    }
    return program_title, program


def parse_programs(html: str, page: int) -> dict[str, dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    programs: dict[str, dict[str, Any]] = {}

    for heading in soup.select("h3.js-views-accordion-group-header"):
        parsed = parse_program(heading, page)
        if parsed:
            key, program = parsed
            programs[key] = program

    return programs


def scrape_programs(
    output_path: Path,
    delay_seconds: float,
    max_pages: int | None = None,
) -> dict[str, dict[str, Any]]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Course-Search-UTSC/0.1 "
                "(personal academic program search project; requests + bs4)"
            )
        }
    )

    first_html = fetch_page(session, 0)
    first_soup = BeautifulSoup(first_html, "html.parser")
    last_page = get_last_page(first_soup)
    if max_pages is not None:
        last_page = min(last_page, max_pages - 1)

    all_programs = parse_programs(first_html, 0)
    for page in range(1, last_page + 1):
        time.sleep(delay_seconds)
        html = fetch_page(session, page)
        all_programs.update(parse_programs(html, page))
        print(f"Scraped page {page}/{last_page}: {len(all_programs)} programs")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(all_programs, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return all_programs


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape UTSC calendar programs into a JSON dictionary keyed by program title."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--delay", type=float, default=0.25)
    parser.add_argument(
        "--max-pages",
        type=int,
        default=None,
        help="Limit pages for testing. Uses page count, so --max-pages 1 scrapes only page 0.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    programs = scrape_programs(args.output, args.delay, args.max_pages)
    print(f"Wrote {len(programs)} programs to {args.output}")


if __name__ == "__main__":
    main()

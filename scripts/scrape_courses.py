#!/usr/bin/env python3
"""Scrape the UTSC Academic Calendar course list into a course-code dictionary."""

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


BASE_URL = "https://utsc.calendar.utoronto.ca/search-courses"
DEFAULT_OUTPUT = Path("data/courses.json")

COURSE_HEADING_RE = re.compile(
    r"^\s*(?P<code>[A-Z]{3,4}[A-Z]?\d{2,3}[HY](?:[135])?)\s*-\s*(?P<title>.+?)\s*$"
)
COURSE_CODE_RE = re.compile(r"\b[A-Z]{3,4}[A-Z]?\d{2,3}[HY](?:[135])?\b")

FIELD_SELECTORS = {
    "prerequisite_text": "views-field-field-prerequisite",
    "corequisite_text": "views-field-field-corequisite",
    "exclusion_text": "views-field-field-exclusion",
    "recommended_preparation_text": "views-field-field-recommended-preparation",
    "breadth_requirements_text": "views-field-field-breadth-requirements",
    "course_experience_text": "views-field-field-course-experience",
}

BREADTH_REQUIREMENT_VALUES = [
    "Arts, Literature and Language",
    "History, Philosophy and Cultural Studies",
    "Social and Behavioural Sciences",
    "Natural Sciences",
    "Quantitative Reasoning",
]


def clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def extract_codes(text: str) -> list[str]:
    return sorted(set(COURSE_CODE_RE.findall(text or "")))


def split_list_field(text: str) -> list[str]:
    if not text:
        return []
    pieces = re.split(r"\s*;\s*", text)
    return [clean_text(piece) for piece in pieces if clean_text(piece)]


def normalize_breadth_requirements(text: str) -> list[str]:
    if not text:
        return []

    matches = [
        value for value in BREADTH_REQUIREMENT_VALUES if value in text
    ]
    if matches:
        return matches

    return split_list_field(text)


def fetch_page(session: requests.Session, page: int, cache_dir: Path | None = None) -> str:
    cache_path = cache_dir / f"page_{page}.html" if cache_dir else None
    if cache_path and cache_path.exists():
        return cache_path.read_text(encoding="utf-8")

    response = session.get(BASE_URL, params={"page": page}, timeout=30)
    response.raise_for_status()
    html = response.text

    if cache_path:
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(html, encoding="utf-8")

    return html


def get_last_page(soup: BeautifulSoup) -> int:
    last_link = soup.select_one(".pager__item--last a[href*='page=']")
    if not last_link:
        return 0
    href = last_link.get("href", "")
    match = re.search(r"[?&]page=(\d+)", href)
    return int(match.group(1)) if match else 0


def field_text(course_row: Tag, css_class: str) -> str:
    field = course_row.select_one(f".{css_class} .field-content")
    if not field:
        return ""
    return clean_text(field.get_text(" ", strip=True))


def parse_course(heading: Tag, page: int) -> tuple[str, dict[str, Any]] | None:
    heading_text = clean_text(heading.get_text(" ", strip=True))
    match = COURSE_HEADING_RE.match(heading_text)
    if not match:
        return None

    code = match.group("code")
    title = match.group("title")
    content_row = heading.find_next_sibling("div", class_="views-row")
    if not isinstance(content_row, Tag):
        return None

    description = field_text(content_row, "views-field-body")
    fields = {
        output_key: field_text(content_row, css_class)
        for output_key, css_class in FIELD_SELECTORS.items()
    }

    timetable_link = content_row.select_one(".views-field-field-timetable-link a[href]")
    timetable_url = ""
    if timetable_link:
        timetable_url = urljoin(BASE_URL, timetable_link.get("href", "").strip())

    course = {
        "code": code,
        "title": title,
        "course_name": f"{code} - {title}",
        "description": description,
        "prerequisites": extract_codes(fields["prerequisite_text"]),
        "corequisites": extract_codes(fields["corequisite_text"]),
        "exclusions": extract_codes(fields["exclusion_text"]),
        "recommended_preparation": extract_codes(fields["recommended_preparation_text"]),
        "breadth_requirements": normalize_breadth_requirements(
            fields["breadth_requirements_text"]
        ),
        "course_experience": split_list_field(fields["course_experience_text"]),
        "timetable_url": timetable_url,
        "calendar_url": f"{BASE_URL}?page={page}",
        **fields,
    }
    return code, course


def parse_courses(html: str, page: int) -> dict[str, dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    courses: dict[str, dict[str, Any]] = {}

    for heading in soup.select("h3.js-views-accordion-group-header"):
        parsed = parse_course(heading, page)
        if parsed:
            code, course = parsed
            courses[code] = course

    return courses


def scrape_courses(
    output_path: Path,
    cache_dir: Path | None,
    delay_seconds: float,
    max_pages: int | None = None,
) -> dict[str, dict[str, Any]]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": (
                "Course-Search-UTSC/0.1 "
                "(personal academic course search project; requests + bs4)"
            )
        }
    )

    first_html = fetch_page(session, 0, cache_dir)
    first_soup = BeautifulSoup(first_html, "html.parser")
    last_page = get_last_page(first_soup)
    if max_pages is not None:
        last_page = min(last_page, max_pages - 1)

    all_courses = parse_courses(first_html, 0)
    for page in range(1, last_page + 1):
        time.sleep(delay_seconds)
        html = fetch_page(session, page, cache_dir)
        all_courses.update(parse_courses(html, page))
        print(f"Scraped page {page}/{last_page}: {len(all_courses)} courses")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(all_courses, ensure_ascii=False, indent=2, sort_keys=True),
        encoding="utf-8",
    )
    return all_courses


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Scrape UTSC calendar courses into a JSON dictionary keyed by course code."
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--cache-dir",
        type=Path,
        default=None,
        help="Optional directory for caching raw HTML pages. Disabled by default.",
    )
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
    courses = scrape_courses(args.output, args.cache_dir, args.delay, args.max_pages)
    print(f"Wrote {len(courses)} courses to {args.output}")


if __name__ == "__main__":
    main()

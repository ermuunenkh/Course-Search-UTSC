# Course-Search-UTSC

A personal UTSC course search project.

## Course Data

The scraper stores courses as a JSON dictionary keyed by course code:

```json
{
  "CSCA08H3": {
    "code": "CSCA08H3",
    "title": "Introduction to Computer Science I",
    "course_name": "CSCA08H3 - Introduction to Computer Science I",
    "prerequisites": ["..."],
    "prerequisite_text": "Original calendar prerequisite text"
  }
}
```

The code-list fields (`prerequisites`, `corequisites`, `exclusions`, and
`recommended_preparation`) are extracted from the original text so the app can
look them up directly in the same dictionary.

The raw text fields are still preserved because some requirements are not simple
course codes, such as credit counts, minimum grades, program enrolment, or
permission of the instructor.

## Scrape Courses

Install dependencies:

```bash
pip install -r requirements.txt
```

Scrape all UTSC calendar courses:

```bash
python scripts/scrape_courses.py
```

Output:

- `data/courses.json`: normalized dictionary keyed by course code

For a quick parser test against only the first page:

```bash
python scripts/scrape_courses.py --max-pages 1
```

## Scrape Programs

Scrape all UTSC calendar programs:

```bash
python scripts/scrape_programs.py
```

Output:

- `data/programs.json`: normalized dictionary keyed by program title

For a quick parser test against only the first page:

```bash
python scripts/scrape_programs.py --max-pages 1
```

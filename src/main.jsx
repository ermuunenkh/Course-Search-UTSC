import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Filter,
  GraduationCap,
  Layers3,
  ListChecks,
  ListFilter,
  Search,
  X,
} from "lucide-react";
import coursesByCode from "../data/courses.json";
import programsByTitle from "../data/programs.json";
import "./styles.css";

const courses = Object.values(coursesByCode);
const courseCodes = Object.keys(coursesByCode);
const programs = Object.values(programsByTitle);

function getSubject(code) {
  const match = code.match(/^([A-Z]{3,4}?)([A-D])(?=\d{2,3}[HY](?:[135])?$)/);
  if (match) {
    return match[1];
  }

  return code.match(/^[A-Z]+/)?.[0] || "";
}

function getLevel(code) {
  return code.match(/^[A-Z]+([A-D])/)?.[1] || "";
}

function getProgramKind(program) {
  const source = `${program.program_title} ${program.program_name}`.toLowerCase();
  if (source.includes("certificate")) return "Certificate";
  if (source.includes("combined degree")) return "Combined Degree";
  if (source.includes("double degree")) return "Double Degree";
  if (source.includes("specialist")) return "Specialist";
  if (source.includes("major")) return "Major";
  if (source.includes("minor")) return "Minor";
  return "Other";
}

function isCoopProgram(program) {
  const source = `${program.program_title} ${program.program_name}`.toLowerCase();
  return /co-?op|cooperative|co-operative/.test(source);
}

const courseSubjects = Array.from(
  new Set(courseCodes.map((code) => getSubject(code)).filter(Boolean)),
).sort();

const breadthRequirements = Array.from(
  new Set(courses.flatMap((course) => course.breadth_requirements || [])),
).sort();

const programSections = Array.from(
  new Set(programs.flatMap((program) => (program.calendar_sections || []).map((section) => section.title))),
).sort();

const programKinds = Array.from(
  new Set(programs.map((program) => getProgramKind(program))),
).sort();

const levels = [
  { label: "All levels", value: "all" },
  { label: "A-level", value: "A" },
  { label: "B-level", value: "B" },
  { label: "C-level", value: "C" },
  { label: "D-level", value: "D" },
];

function includesCourseQuery(course, query) {
  if (!query) return true;
  const haystack = [
    course.code,
    course.title,
    course.description,
    course.prerequisite_text,
    course.exclusion_text,
    course.breadth_requirements_text,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function includesProgramQuery(program, query) {
  if (!query) return true;
  const haystack = [
    program.program_title,
    program.program_name,
    program.program_code,
    program.description,
    program.enrolment_requirements_text,
    program.admission_requirements_text,
    program.completion_requirements_text,
    program.note_text,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function tagList(items, emptyText) {
  if (!items?.length) return <span className="muted">{emptyText}</span>;
  return items.map((item) => (
    <span className="tag" key={item}>
      {item}
    </span>
  ));
}

function App() {
  const [mode, setMode] = useState("course");
  const [query, setQuery] = useState("");
  const [courseSubject, setCourseSubject] = useState("all");
  const [breadth, setBreadth] = useState("all");
  const [level, setLevel] = useState("all");
  const [openOnly, setOpenOnly] = useState(false);
  const [expandedCourseCode, setExpandedCourseCode] = useState("");
  const [programSection, setProgramSection] = useState("all");
  const [programKind, setProgramKind] = useState("all");
  const [withCoursesOnly, setWithCoursesOnly] = useState(false);
  const [coopMode, setCoopMode] = useState("all");
  const [expandedProgramTitle, setExpandedProgramTitle] = useState("");

  const filteredCourses = useMemo(() => {
    return courses
      .filter((course) => includesCourseQuery(course, query))
      .filter((course) => courseSubject === "all" || getSubject(course.code) === courseSubject)
      .filter((course) => breadth === "all" || course.breadth_requirements?.includes(breadth))
      .filter((course) => level === "all" || getLevel(course.code) === level)
      .filter((course) => !openOnly || course.prerequisites.length === 0)
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [breadth, courseSubject, level, openOnly, query]);

  const filteredPrograms = useMemo(() => {
    return programs
      .filter((program) => includesProgramQuery(program, query))
      .filter((program) => {
        if (programSection === "all") return true;
        return (program.calendar_sections || []).some((section) => section.title === programSection);
      })
      .filter((program) => programKind === "all" || getProgramKind(program) === programKind)
      .filter((program) => !withCoursesOnly || program.course_codes.length > 0)
      .filter((program) => {
        if (coopMode === "no") return !isCoopProgram(program);
        if (coopMode === "only") return isCoopProgram(program);
        return true;
      })
      .sort((a, b) => a.program_title.localeCompare(b.program_title));
  }, [coopMode, programKind, programSection, query, withCoursesOnly]);

  const visibleCourses = filteredCourses.slice(0, 80);
  const visiblePrograms = filteredPrograms.slice(0, 80);

  function setView(nextMode) {
    setMode(nextMode);
    setQuery("");
    setExpandedCourseCode("");
    setExpandedProgramTitle("");
  }

  function clearFilters() {
    setQuery("");
    setCourseSubject("all");
    setBreadth("all");
    setLevel("all");
    setOpenOnly(false);
    setExpandedCourseCode("");
    setProgramSection("all");
    setProgramKind("all");
    setWithCoursesOnly(false);
    setCoopMode("all");
    setExpandedProgramTitle("");
  }

  const headerCopy = {
    course: {
      eyebrow: "course.search",
      title: "UTSC Course Finder",
      description:
        "A cleaner search surface for the UTSC calendar. Filter by subject, level, breadth, and prerequisite load without digging through the old site.",
    },
    program: {
      eyebrow: "program.search",
      title: "UTSC Program Finder",
      description:
        "Browse certificates, majors, specialists, and combined degrees with quick filters for calendar sections, program type, and linked course lists.",
    },
    requirements: {
      eyebrow: "requirements",
      title: "Program Requirements",
      description:
        "This view will summarize requirement structures across programs. Leave it as a placeholder for now while search views are built out.",
    },
  }[mode];

  return (
    <main className="app-shell">
      <div className="graph-bg" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, index) => (
          <span key={index} className={`node node-${index + 1}`} />
        ))}
      </div>
      <div className="app-layout">
        <aside className="sidebar">
          <div className="sidebar-copy">
            <p className="eyebrow">{headerCopy.eyebrow}</p>
            <h1>{headerCopy.title}</h1>
            <p className="sidebar-description">{headerCopy.description}</p>
          </div>

          <div className="sidebar-actions">
            <button
              className={`sidebar-action ${mode === "program" ? "sidebar-action-active" : ""}`}
              type="button"
              onClick={() => setView("program")}
            >
              <Layers3 size={16} />
              <span>Program Search</span>
              <small>{programs.length.toLocaleString()} indexed</small>
            </button>
            <button
              className={`sidebar-action ${mode === "course" ? "sidebar-action-active" : ""}`}
              type="button"
              onClick={() => setView("course")}
            >
              <Search size={16} />
              <span>Course Search</span>
              <small>{courseCodes.length.toLocaleString()} indexed</small>
            </button>
            <button
              className={`sidebar-action ${mode === "requirements" ? "sidebar-action-active" : ""}`}
              type="button"
              onClick={() => setView("requirements")}
            >
              <ListFilter size={16} />
              <span>Program Requirements</span>
              <small>Placeholder</small>
            </button>
          </div>
        </aside>

        <div className="content-column">
          {mode !== "requirements" && (
            <section className="toolbar-shell" id="search" aria-label="Search filters">
              <label className="search-box search-box-compact">
                <Search size={18} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={mode === "course" ? "Search courses" : "Search programs"}
                />
              </label>

              {mode === "course" ? (
                <div className="compact-filters">
                  <label className="compact-control">
                    <span><Filter size={13} /> Subject</span>
                    <select value={courseSubject} onChange={(event) => setCourseSubject(event.target.value)}>
                      <option value="all">Any</option>
                      {courseSubjects.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="compact-control">
                    <span><GraduationCap size={13} /> Level</span>
                    <select value={level} onChange={(event) => setLevel(event.target.value)}>
                      {levels.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="compact-control">
                    <span><BookOpen size={13} /> Breadth</span>
                    <select value={breadth} onChange={(event) => setBreadth(event.target.value)}>
                      <option value="all">Any</option>
                      {breadthRequirements.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="toggle-row toggle-row-compact">
                    <input
                      checked={openOnly}
                      type="checkbox"
                      onChange={(event) => setOpenOnly(event.target.checked)}
                    />
                    <span className="toggle-indicator" aria-hidden="true" />
                    <span>No prerequisites</span>
                  </label>

                  <button className="ghost-button ghost-button-compact" type="button" onClick={clearFilters}>
                    <X size={16} />
                    Reset
                  </button>
                </div>
              ) : (
                <div className="compact-filters">
                  <label className="compact-control">
                    <span><Filter size={13} /> Section</span>
                    <select value={programSection} onChange={(event) => setProgramSection(event.target.value)}>
                      <option value="all">Any</option>
                      {programSections.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="compact-control">
                    <span><Layers3 size={13} /> Type</span>
                    <select value={programKind} onChange={(event) => setProgramKind(event.target.value)}>
                      <option value="all">Any</option>
                      {programKinds.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="compact-control">
                    <span><ListChecks size={13} /> Course map</span>
                    <select
                      value={withCoursesOnly ? "mapped" : "all"}
                      onChange={(event) => setWithCoursesOnly(event.target.value === "mapped")}
                    >
                      <option value="all">Any</option>
                      <option value="mapped">Has course codes</option>
                    </select>
                  </label>

                  <label className="compact-control">
                    <span><BookOpen size={13} /> Co-op</span>
                    <select value={coopMode} onChange={(event) => setCoopMode(event.target.value)}>
                      <option value="all">Any</option>
                      <option value="no">No Co-op</option>
                      <option value="only">Co-op only</option>
                    </select>
                  </label>

                  <button className="ghost-button ghost-button-compact" type="button" onClick={clearFilters}>
                    <X size={16} />
                    Reset
                  </button>
                </div>
              )}
            </section>
          )}

          {mode === "course" && (
            <section className="results-shell" id="results">
              <div className="results-header">
                <div>
                  <h2>{filteredCourses.length.toLocaleString()} matches</h2>
                </div>
                <p id="data">
                  Showing {visibleCourses.length.toLocaleString()} of{" "}
                  {filteredCourses.length.toLocaleString()}
                </p>
              </div>

              <div className="course-list">
                {visibleCourses.map((course) => {
                  const expanded = expandedCourseCode === course.code;
                  return (
                    <article className="course-card" key={course.code}>
                      <button
                        className="course-summary"
                        type="button"
                        onClick={() => setExpandedCourseCode(expanded ? "" : course.code)}
                        aria-expanded={expanded}
                      >
                        <div className="summary-copy">
                          <span className="course-code">{course.code}</span>
                          <h3>{course.title}</h3>
                        </div>
                        <div className="summary-meta">
                          {course.breadth_requirements?.[0] && (
                            <span>{course.breadth_requirements[0]}</span>
                          )}
                          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </button>

                      {expanded && (
                        <div className="course-details">
                          <p>{course.description}</p>
                          <div className="detail-grid">
                            <section>
                              <h4>Prerequisites</h4>
                              <div className="tags">
                                {tagList(course.prerequisites, course.prerequisite_text || "None listed")}
                              </div>
                            </section>
                            <section>
                              <h4>Exclusions</h4>
                              <div className="tags">
                                {tagList(course.exclusions, course.exclusion_text || "None listed")}
                              </div>
                            </section>
                            <section>
                              <h4>Breadth</h4>
                              <div className="tags">
                                {tagList(course.breadth_requirements, "None listed")}
                              </div>
                            </section>
                          </div>
                          {course.prerequisite_text && course.prerequisites.length > 0 && (
                            <p className="raw-requirement">
                              <strong>Calendar prerequisite:</strong> {course.prerequisite_text}
                            </p>
                          )}
                          {course.timetable_url && (
                            <a className="timetable-link" href={course.timetable_url} target="_blank">
                              Timetable <ExternalLink size={15} />
                            </a>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {mode === "program" && (
            <section className="results-shell" id="results">
              <div className="results-header">
                <div>
                  <h2>{filteredPrograms.length.toLocaleString()} matches</h2>
                </div>
                <p id="data">
                  Showing {visiblePrograms.length.toLocaleString()} of{" "}
                  {filteredPrograms.length.toLocaleString()}
                </p>
              </div>

              <div className="course-list">
                {visiblePrograms.map((program) => {
                  const expanded = expandedProgramTitle === program.program_title;
                  const primarySection = program.calendar_sections?.[0]?.title || "";
                  return (
                    <article className="course-card" key={program.program_title}>
                      <button
                        className="course-summary"
                        type="button"
                        onClick={() => setExpandedProgramTitle(expanded ? "" : program.program_title)}
                        aria-expanded={expanded}
                      >
                        <div className="summary-copy">
                          {program.program_code && <span className="course-code">{program.program_code}</span>}
                          <h3>{program.program_name || program.program_title}</h3>
                        </div>
                        <div className="summary-meta">
                          {primarySection && <span>{primarySection}</span>}
                          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </button>

                      {expanded && (
                        <div className="course-details">
                          <p>{program.description}</p>
                          <div className="detail-grid">
                            <section>
                              <h4>Program Type</h4>
                              <div className="tags">{tagList([getProgramKind(program)], "Not listed")}</div>
                            </section>
                            <section>
                              <h4>Calendar Sections</h4>
                              <div className="tags">
                                {tagList(
                                  (program.calendar_sections || []).map((section) => section.title),
                                  "None listed",
                                )}
                              </div>
                            </section>
                            <section>
                              <h4>Course Codes</h4>
                              <div className="tags">{tagList(program.course_codes, "None listed")}</div>
                            </section>
                          </div>

                          {program.enrolment_requirements_text && (
                            <p className="raw-requirement">
                              <strong>Enrolment requirements:</strong> {program.enrolment_requirements_text}
                            </p>
                          )}
                          {program.admission_requirements_text && (
                            <p className="raw-requirement">
                              <strong>Admission requirements:</strong> {program.admission_requirements_text}
                            </p>
                          )}
                          {program.completion_requirements_text && (
                            <p className="raw-requirement">
                              <strong>Completion requirements:</strong> {program.completion_requirements_text}
                            </p>
                          )}
                          {program.note_text && (
                            <p className="raw-requirement">
                              <strong>Notes:</strong> {program.note_text}
                            </p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {mode === "requirements" && (
            <section className="results-shell placeholder-shell">
              <div className="results-header">
                <div>
                  <h2>Program requirements</h2>
                </div>
              </div>
              <div className="placeholder-copy">
                <p>
                  Placeholder view. This section will eventually summarize requirement structures,
                  linked course groups, and eligibility paths across UTSC programs.
                </p>
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);

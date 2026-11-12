"""Hybrid ATS scoring engine: rule-based matching + synonym/implication rules + deterministic weighted scoring.

The final number is always computed here, on the server, from the match ratios. A language model (when enabled
later) may add evidence or flag equivalent skills, but it never decides the score.

Score = sum over categories of (effective weight x match ratio). Categories the job description gives no
signal for (for example no education requirement) are marked not applicable and their weight is shared between
the remaining categories, so a job that does not ask for something cannot hand out free points or take any away.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any, Dict, List, Optional

from app.scoring.jd_parser import (
    EDUCATION_LABELS, MANDATORY, OPTIONAL, PREFERRED, extract_requirements,
)
from app.scoring.resume_profile import ResumeProfile, build_profile, education_label
from app.scoring.skills import SOFT, TECHNICAL, IMPLIED_BY, related_skills
from app.scoring.text_utils import clip, content_stems, stem

ENGINE_VERSION = "1.0"
ANALYSIS_MODE = "rule_based"

MATCHED = "MATCHED"
PARTIAL = "PARTIAL_MATCH"
NOT_FOUND = "NOT_FOUND"
UNVERIFIED = "UNVERIFIED"

READY = "READY_TO_APPLY"
IMPROVE = "IMPROVE_BEFORE_APPLYING"
LOW = "LOW_COMPATIBILITY"

DISCLAIMER = (
    "This score is this platform's estimate of how well your resume matches this job description. "
    "It is not a guarantee of passing any employer's applicant tracking system. "
    "\"Not found\" means the requirement was not found in the resume you supplied, not that you lack the skill."
)

IMPORTANCE_WEIGHT = {MANDATORY: 1.0, PREFERRED: 0.5, OPTIONAL: 0.25}
PARTIAL_CREDIT = 0.5

CATEGORY_LABELS = {
    "technicalSkills": "Technical skills",
    "experience": "Experience relevance",
    "responsibilities": "Responsibilities match",
    "keywords": "Keyword relevance",
    "education": "Education match",
    "structure": "Resume structure",
}
CATEGORY_ORDER = list(CATEGORY_LABELS)

_SECTION_PHRASE = {
    "experience": "work experience", "projects": "projects", "summary": "summary", "achievements": "achievements",
    "certifications": "certifications", "education": "education", "skills": "skills list",
}
_GENERIC_TITLE_WORDS = {
    "senior", "junior", "sr", "jr", "lead", "principal", "staff", "associate", "intern", "trainee", "entry",
    "level", "remote", "hybrid", "onsite", "full", "time", "part", "contract", "the", "and", "for",
}


@dataclass(frozen=True)
class ScoringConfig:
    weights: Dict[str, float]
    ready_threshold: int = 75
    improve_threshold: int = 50
    block_ready_on_mandatory_gaps: bool = True

    @classmethod
    def from_settings(cls) -> "ScoringConfig":
        from app.config import settings

        return cls(
            weights={
                "technicalSkills": settings.ats_weight_technical_skills,
                "experience": settings.ats_weight_experience,
                "responsibilities": settings.ats_weight_responsibilities,
                "keywords": settings.ats_weight_keywords,
                "education": settings.ats_weight_education,
                "structure": settings.ats_weight_structure,
            },
            ready_threshold=settings.ats_ready_threshold,
            improve_threshold=settings.ats_improve_threshold,
            block_ready_on_mandatory_gaps=settings.ats_block_ready_on_mandatory_gaps,
        )

    def normalized_weights(self) -> Dict[str, float]:
        total = sum(self.weights.get(k, 0.0) for k in CATEGORY_ORDER)
        return {k: (self.weights.get(k, 0.0) / total * 100.0) for k in CATEGORY_ORDER}


def _item(
    item_id: str, kind: str, category: str, requirement: str, importance: str, status: str, explanation: str,
    evidence: Optional[str] = None, section: Optional[str] = None, confidence: Optional[float] = None,
) -> Dict[str, Any]:
    return {
        "id": item_id,
        "kind": kind,
        "category": category,
        "requirement": requirement,
        "importance": importance,
        "status": status,
        "confidence": round(confidence, 2) if confidence is not None else None,
        "evidence": evidence,
        "evidenceSection": section,
        "explanation": explanation,
    }


def _credit(status: str) -> float:
    return {MATCHED: 1.0, PARTIAL: PARTIAL_CREDIT}.get(status, 0.0)


def _weighted_ratio(entries: List[tuple]) -> Optional[float]:
    """entries: (importance, credit). Returns None when there is nothing to score."""
    total = sum(IMPORTANCE_WEIGHT[imp] for imp, _ in entries)
    if total <= 0:
        return None
    return sum(IMPORTANCE_WEIGHT[imp] * credit for imp, credit in entries) / total


# ---------------------------------------------------------------- technical skills

def _match_skill(name: str, importance: str, kind: str, category: str, profile: ResumeProfile, item_id: str) -> Dict[str, Any]:
    direct = profile.evidence(name)
    if direct:
        snippet, section, _ = direct
        confidence = 0.95 if section in ("experience", "projects") else 0.85 if section in ("summary", "achievements", "certifications") else 0.7
        where = _SECTION_PHRASE.get(section or "", "resume")
        if section == "skills":
            explanation = f"{name} is listed in your skills, but not shown in a job or project. Add where you used it."
        else:
            explanation = f"{name} appears in your {where}."
        return _item(item_id, kind, category, name, importance, MATCHED, explanation, snippet, section, confidence)

    for tool in IMPLIED_BY.get(name, ()):
        implied = profile.evidence(tool)
        if implied:
            snippet, section, _ = implied
            return _item(
                item_id, kind, category, name, importance, MATCHED,
                f"{name} is covered by {tool}, which appears on your resume.", snippet, section, 0.8,
            )

    related = sorted(related_skills(name).intersection(profile.skills))
    if related:
        snippet, section, _ = profile.evidence(related[0])
        shown = ", ".join(related[:3])
        return _item(
            item_id, kind, category, name, importance, PARTIAL,
            f"Your resume shows related experience ({shown}), but {name} itself was not found.",
            snippet, section, 0.5,
        )

    return _item(item_id, kind, category, name, importance, NOT_FOUND, f"{name} was not found in your resume.")


def _score_technical(jd: dict, profile: ResumeProfile, items: List[dict]) -> Optional[float]:
    scored: List[tuple] = []
    for skill in jd["skills"]:
        if skill["kind"] != TECHNICAL:
            continue
        it = _match_skill(skill["name"], skill["importance"], "skill", "technicalSkills", profile, f"skill:{skill['name']}")
        items.append(it)
        scored.append((it["importance"], _credit(it["status"])))
    for cert in jd["certifications"]:
        found_index = profile.certifications.get(cert["name"])
        if found_index is not None:
            it = _item(
                f"cert:{cert['name']}", "certification", "technicalSkills", cert["name"], cert["importance"], MATCHED,
                f"{cert['name']} appears on your resume.", clip(profile.lines[found_index]),
                profile.sections[found_index], 0.9,
            )
        else:
            it = _item(
                f"cert:{cert['name']}", "certification", "technicalSkills", cert["name"], cert["importance"], NOT_FOUND,
                f"{cert['name']} was not found in your resume.",
            )
        items.append(it)
        scored.append((it["importance"], _credit(it["status"])))
    return _weighted_ratio(scored)


# ---------------------------------------------------------------- experience

def _title_ratio(job_title: str, profile: ResumeProfile) -> Optional[float]:
    wanted = content_stems(job_title) - {stem(w) for w in _GENERIC_TITLE_WORDS}
    if not wanted:
        return None
    in_titles = set()
    for line in profile.title_lines:
        in_titles |= content_stems(line)
    hits = len(wanted & in_titles)
    if hits:
        return hits / len(wanted)
    # Mentioned somewhere but never as a job title: weak evidence only.
    return 0.4 * (len(wanted & profile.all_stems) / len(wanted))


def _score_experience(jd: dict, job_title: str, profile: ResumeProfile, items: List[dict]) -> Optional[float]:
    years_ratio: Optional[float] = None
    required = jd["minYears"]
    if required:
        label = f"{required}+ years of experience"
        if profile.years is None:
            items.append(_item(
                "experience:years", "experience", "experience", label, MANDATORY, UNVERIFIED,
                "Your total experience could not be worked out because your roles have no readable dates. "
                "Add dates such as \"Jan 2021 - Present\".",
            ))
        else:
            years_ratio = min(1.0, profile.years / required)
            status = MATCHED if years_ratio >= 1 else PARTIAL if years_ratio >= 0.5 else NOT_FOUND
            source = "from the dates of your roles" if profile.years_source == "dates" else "as stated on your resume"
            items.append(_item(
                "experience:years", "experience", "experience", label, MANDATORY, status,
                f"The job asks for {required}+ years. Your resume shows about {profile.years:g} years, {source}.",
                confidence=0.8 if profile.years_source == "dates" else 0.6,
            ))

    title_ratio = _title_ratio(job_title, profile)
    if title_ratio is not None:
        status = MATCHED if title_ratio >= 0.99 else PARTIAL if title_ratio > 0 else NOT_FOUND
        explanation = {
            MATCHED: "Your resume has a job title that matches this role.",
            PARTIAL: "Your resume only partly matches this role's title or mentions it outside a job title.",
            NOT_FOUND: "No job title on your resume resembles this role.",
        }[status]
        items.append(_item(
            "experience:title", "title", "experience", f"Role relevance: {job_title}", PREFERRED, status, explanation,
        ))

    if years_ratio is not None and title_ratio is not None:
        return 0.7 * years_ratio + 0.3 * title_ratio
    return years_ratio if years_ratio is not None else title_ratio


# ---------------------------------------------------------------- responsibilities

def _score_responsibilities(jd: dict, profile: ResumeProfile, items: List[dict]) -> Optional[float]:
    credits: List[float] = []
    for index, text in enumerate(jd["responsibilities"]):
        wanted = content_stems(text)
        if len(wanted) < 2:
            continue
        best, best_line = 0.0, None
        for line_index, line_stems in enumerate(profile.line_stems):
            if not line_stems:
                continue
            ratio = len(wanted & line_stems) / len(wanted)
            if ratio > best:
                best, best_line = ratio, line_index
        overall = len(wanted & profile.all_stems) / len(wanted)

        if best >= 0.5:
            status = MATCHED
            explanation = "Your resume describes similar work."
        elif best >= 0.25 or overall >= 0.6:
            status = PARTIAL
            explanation = (
                "Some terms from this duty appear in your resume, but no single line describes it. "
                "If you have done this work, describe it in a bullet."
            )
        else:
            status = NOT_FOUND
            explanation = "No matching experience was found for this duty."
        evidence = clip(profile.lines[best_line]) if best_line is not None and best >= 0.25 else None
        section = profile.sections[best_line] if evidence else None
        items.append(_item(
            f"resp:{index}", "responsibility", "responsibilities", text, MANDATORY, status, explanation,
            evidence, section, 0.6 if status == MATCHED else 0.4 if status == PARTIAL else None,
        ))
        credits.append(_credit(status))
    return sum(credits) / len(credits) if credits else None


# ---------------------------------------------------------------- keywords

def _score_keywords(jd: dict, profile: ResumeProfile, items: List[dict]) -> Optional[float]:
    scored: List[tuple] = []
    for skill in jd["skills"]:
        if skill["kind"] != SOFT:
            continue
        direct = profile.evidence(skill["name"])
        if direct:
            snippet, section, _ = direct
            it = _item(
                f"soft:{skill['name']}", "soft_skill", "keywords", skill["name"], skill["importance"], MATCHED,
                f"{skill['name']} is shown on your resume.", snippet, section, 0.7,
            )
        else:
            it = _item(
                f"soft:{skill['name']}", "soft_skill", "keywords", skill["name"], skill["importance"], NOT_FOUND,
                f"{skill['name']} was not found in your resume.",
            )
        items.append(it)
        scored.append((it["importance"], _credit(it["status"])))
    for keyword in jd["keywords"]:
        term = keyword["term"]
        found = stem(term) in profile.all_stems
        it = _item(
            f"kw:{term}", "keyword", "keywords", term, PREFERRED, MATCHED if found else NOT_FOUND,
            f"\"{term}\" appears in your resume." if found else f"\"{term}\" is used {keyword['count']} times in the job description but not in your resume.",
        )
        items.append(it)
        scored.append((PREFERRED, _credit(it["status"])))
    return _weighted_ratio(scored) if len(scored) >= 3 else None


# ---------------------------------------------------------------- education

def _score_education(jd: dict, profile: ResumeProfile, items: List[dict]) -> Optional[float]:
    edu = jd["education"]
    have = profile.education_level
    have_label = education_label(have)

    def evaluate(level: int, importance: str):
        label = f"{EDUCATION_LABELS[level]} or higher" if level < 4 else EDUCATION_LABELS[level]
        equivalent = edu["acceptsEquivalentExperience"]
        if have is not None and have >= level:
            status, text = MATCHED, f"Your resume shows a {have_label}."
        elif have is not None and have == level - 1:
            status, text = PARTIAL, f"The job asks for a {EDUCATION_LABELS[level]}; your highest listed qualification is a {have_label}."
        elif equivalent:
            status, text = PARTIAL, "No matching degree was found, but the job accepts equivalent experience."
        elif have is None:
            status, text = NOT_FOUND, "No degree was found in your resume."
        else:
            status, text = NOT_FOUND, f"The job asks for a {EDUCATION_LABELS[level]}; your highest listed qualification is a {have_label}."
        return _item(
            f"education:{level}", "education", "education", label, importance, status, text,
            profile.education_evidence if status == MATCHED else None,
        )

    if edu["requiredLevel"]:
        it = evaluate(edu["requiredLevel"], MANDATORY)
        items.append(it)
        return _credit(it["status"])
    if edu["preferredLevel"]:
        it = evaluate(edu["preferredLevel"], PREFERRED)
        it["explanation"] += " (Preferred, so it is not part of the score.)"
        items.append(it)
    return None


# ---------------------------------------------------------------- structure

def _structure_checks(profile: ResumeProfile) -> List[Dict[str, Any]]:
    detected = set(profile.sections_detected)
    if profile.word_count < 150:
        length_hint = "Your resume has very little text. If it is a scanned or image-based file, upload a text-based PDF or DOCX."
    else:
        length_hint = "Your resume is very long. Keep it to the most relevant one or two pages."
    spec = [
        ("email", "Email address", 2.0, profile.has_email, "Add a professional email address to your contact details."),
        ("phone", "Phone number", 1.0, profile.has_phone, "Add a phone number so recruiters can reach you."),
        ("experience", "Experience or projects section", 2.0, bool({"experience", "projects"} & detected),
         "Add a clearly labelled \"Experience\" or \"Projects\" section. ATS software looks for standard headings."),
        ("education", "Education section", 1.5, "education" in detected, "Add a clearly labelled \"Education\" section."),
        ("skills", "Skills section", 1.5, "skills" in detected, "Add a \"Skills\" section listing your key tools and technologies."),
        ("dates", "Dated roles", 1.0, profile.date_range_count >= 1,
         "Add start and end dates (for example \"Jan 2021 - Present\") to your roles."),
        ("bullets", "Bullet points", 1.0, profile.bullet_count >= 3,
         "Use short bullet points to describe your responsibilities and results."),
        ("length", "Reasonable length", 1.0, 150 <= profile.word_count <= 1500, length_hint),
    ]
    return [
        {"id": cid, "label": label, "weight": weight, "passed": bool(passed), "hint": None if passed else hint}
        for cid, label, weight, passed, hint in spec
    ]


def _score_structure(checks: List[Dict[str, Any]]) -> float:
    total = sum(c["weight"] for c in checks)
    return sum(c["weight"] for c in checks if c["passed"]) / total


# ---------------------------------------------------------------- recommendations

def _recommendations(items: List[dict], jd: dict, checks: List[dict], categories: Dict[str, dict], profile: ResumeProfile) -> List[Dict[str, str]]:
    recs: List[Dict[str, str]] = []

    def add(priority: str, category: str, text: str) -> None:
        recs.append({"priority": priority, "category": category, "text": text})

    def names(entries: List[dict], limit: int = 8) -> str:
        return ", ".join(e["requirement"] for e in entries[:limit])

    skills = [i for i in items if i["kind"] in ("skill", "certification")]
    missing_required = [i for i in skills if i["importance"] == MANDATORY and i["status"] == NOT_FOUND]
    if missing_required:
        add("high", "technicalSkills",
            f"Required but not found in your resume: {names(missing_required)}. If you have real experience with these, "
            "add them to your skills and to the job or project where you used them. If you do not, treat them as gaps "
            "to close (a course or project) rather than adding them to your resume.")

    partial = [i for i in skills if i["status"] == PARTIAL]
    if partial:
        add("medium", "technicalSkills",
            f"Your resume shows related tools but not the exact ones named: {names(partial)}. Mention the exact tool only "
            "if you have actually used it.")

    list_only = [i for i in skills if i["status"] == MATCHED and i["evidenceSection"] == "skills" and i["importance"] == MANDATORY]
    if list_only:
        add("medium", "technicalSkills",
            f"These required skills appear only in your skills list: {names(list_only)}. Show where you used them, "
            "with what you built or achieved.")

    missing_preferred = [i for i in skills if i["importance"] != MANDATORY and i["status"] == NOT_FOUND]
    if missing_preferred:
        add("low", "technicalSkills", f"Nice-to-have skills not found: {names(missing_preferred, 6)}. Add them only if they are true.")

    years = next((i for i in items if i["id"] == "experience:years"), None)
    if years and years["status"] == UNVERIFIED:
        add("high", "experience",
            "Add start and end dates (for example \"Jan 2021 - Present\") to each role so your experience can be calculated.")
    elif years and years["status"] in (PARTIAL, NOT_FOUND):
        add("high", "experience",
            f"The job asks for {jd['minYears']}+ years and your resume shows about {profile.years:g}. Lead with your most "
            "relevant work, including internships and projects, and state your experience accurately.")

    education = next((i for i in items if i["kind"] == "education" and i["importance"] == MANDATORY), None)
    if education and education["status"] in (NOT_FOUND, PARTIAL):
        add("medium", "education", f"Education requirement: {education['explanation']}")

    resp = categories["responsibilities"]
    if resp["applicable"] and resp["ratio"] is not None and resp["ratio"] < 0.5:
        add("medium", "responsibilities",
            "Many of the job's duties are not reflected in your resume. For each duty you have genuinely performed, "
            "describe it in a bullet with what you did and the result.")

    soft_missing = [i for i in items if i["kind"] == "soft_skill" and i["status"] == NOT_FOUND]
    if soft_missing:
        add("low", "keywords", f"The job mentions {names(soft_missing, 5)}. Show these through real examples, not as buzzwords.")

    for check in checks:
        if not check["passed"]:
            priority = "high" if check["id"] in ("email", "experience") else "medium" if check["id"] in ("dates", "skills") else "low"
            add(priority, "structure", check["hint"])

    if not recs:
        recs.append({"priority": "low", "category": "overall",
                     "text": "Your resume covers the detected requirements well. Keep your strongest, most relevant achievements near the top."})
    order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: order[r["priority"]])
    return recs[:10]


# ---------------------------------------------------------------- entry point

def analyze(
    resume_text: str,
    job_text: str,
    *,
    job_title: str = "",
    contact: Optional[dict] = None,
    config: Optional[ScoringConfig] = None,
    today: Optional[date] = None,
) -> Dict[str, Any]:
    config = config or ScoringConfig.from_settings()
    jd = extract_requirements(job_text)
    profile = build_profile(resume_text, contact=contact, today=today)

    items: List[Dict[str, Any]] = []
    ratios: Dict[str, Optional[float]] = {
        "technicalSkills": _score_technical(jd, profile, items),
        "experience": _score_experience(jd, job_title, profile, items),
        "responsibilities": _score_responsibilities(jd, profile, items),
        "keywords": _score_keywords(jd, profile, items),
        "education": _score_education(jd, profile, items),
    }
    checks = _structure_checks(profile)
    ratios["structure"] = _score_structure(checks)

    base = config.normalized_weights()
    applicable_total = sum(base[k] for k in CATEGORY_ORDER if ratios[k] is not None and base[k] > 0)
    categories: Dict[str, Dict[str, Any]] = {}
    overall = 0.0
    for key in CATEGORY_ORDER:
        ratio = ratios[key]
        applicable = ratio is not None and base[key] > 0 and applicable_total > 0
        effective = base[key] / applicable_total * 100.0 if applicable else 0.0
        points = effective * ratio if applicable else 0.0
        overall += points
        categories[key] = {
            "key": key,
            "label": CATEGORY_LABELS[key],
            "weight": round(base[key], 1),
            "effectiveWeight": round(effective, 1),
            "applicable": applicable,
            "ratio": round(ratio, 3) if ratio is not None else None,
            "points": round(points, 1),
        }
    overall_score = max(0, min(100, int(round(overall))))

    gap_kinds = ("skill", "certification", "experience", "education")
    mandatory_gaps = [
        {"requirement": i["requirement"], "kind": i["kind"], "explanation": i["explanation"]}
        for i in items if i["importance"] == MANDATORY and i["status"] == NOT_FOUND and i["kind"] in gap_kinds
    ]

    if overall_score >= config.ready_threshold:
        recommendation = READY
    elif overall_score >= config.improve_threshold:
        recommendation = IMPROVE
    else:
        recommendation = LOW
    if recommendation == READY and mandatory_gaps and config.block_ready_on_mandatory_gaps:
        recommendation = IMPROVE

    warnings: List[str] = []
    scored_items = [i for i in items if i["status"] != UNVERIFIED and i["kind"] != "title"]
    if len(scored_items) < 3:
        warnings.append(
            "Few requirements could be detected in this job description, so the score reflects limited information. "
            "Try pasting the complete posting, including its requirements section."
        )
    if profile.word_count < 100:
        warnings.append("Very little text was read from your resume. The score may be unreliable.")
    if any(i["status"] == UNVERIFIED for i in items):
        warnings.append("Some requirements could not be verified from your resume; they are not counted in the score.")

    technical_items = [i for i in items if i["kind"] in ("skill", "certification", "soft_skill")]
    detail = {
        "matchedSkills": [i["requirement"] for i in technical_items if i["status"] == MATCHED],
        "partialMatches": [i["requirement"] for i in technical_items if i["status"] == PARTIAL],
        "missingSkills": [i["requirement"] for i in technical_items if i["status"] == NOT_FOUND],
    }

    return {
        "engineVersion": ENGINE_VERSION,
        "analysisMode": ANALYSIS_MODE,
        "overallScore": overall_score,
        "recommendation": recommendation,
        "categoryScores": [categories[k] for k in CATEGORY_ORDER],
        "requirements": items,
        "mandatoryGaps": mandatory_gaps,
        "structureChecks": checks,
        "improvementRecommendations": _recommendations(items, jd, checks, categories, profile),
        "warnings": warnings,
        "disclaimer": DISCLAIMER,
        "semanticAnalysis": {
            "enabled": False,
            "note": "AI semantic matching is not enabled. Matching uses exact terms, synonyms and related-skill rules.",
        },
        "extractedRequirements": {
            "minYears": jd["minYears"],
            "maxYears": jd["maxYears"],
            "skills": [{"name": s["name"], "kind": s["kind"], "importance": s["importance"]} for s in jd["skills"]],
            "certifications": [{"name": c["name"], "importance": c["importance"]} for c in jd["certifications"]],
            "education": jd["education"],
            "responsibilities": jd["responsibilities"],
            "keywords": jd["keywords"],
        },
        "resumeSummary": {
            "yearsOfExperience": profile.years,
            "yearsSource": profile.years_source,
            "highestEducation": education_label(profile.education_level),
            "sectionsDetected": profile.sections_detected,
            "skillsFound": sorted(profile.skills)[:80],
            "certifications": sorted(profile.certifications),
            "wordCount": profile.word_count,
        },
        "scoringConfig": {
            "weights": {k: round(v, 1) for k, v in base.items()},
            "readyThreshold": config.ready_threshold,
            "improveThreshold": config.improve_threshold,
            "blockReadyOnMandatoryGaps": config.block_ready_on_mandatory_gaps,
        },
        "matchedSkills": detail["matchedSkills"],
        "partialMatches": detail["partialMatches"],
        "missingSkills": detail["missingSkills"],
    }

"""Skill taxonomy used by the rule-based matcher.

Each skill has a canonical name and the aliases people actually write. Matching is whole-word, so "java" never
matches inside "javascript" and "sql" never matches inside "mysql". The taxonomy is intentionally data, not logic:
adding a skill means adding one line to SKILLS.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, FrozenSet, List, Tuple

TECHNICAL = "technical"
SOFT = "soft"


@dataclass(frozen=True)
class Skill:
    name: str
    kind: str
    aliases: Tuple[str, ...]


def _s(name: str, kind: str, *aliases: str, include_name: bool = True) -> Skill:
    names = {a.lower() for a in aliases}
    if include_name:
        names.add(name.lower())
    return Skill(name=name, kind=kind, aliases=tuple(sorted(names, key=len, reverse=True)))


def _t(name: str, *aliases: str, include_name: bool = True) -> Skill:
    return _s(name, TECHNICAL, *aliases, include_name=include_name)


def _soft(name: str, *aliases: str) -> Skill:
    return _s(name, SOFT, *aliases)


SKILLS: List[Skill] = [
    # Programming languages
    _t("Python"), _t("Java"), _t("JavaScript", "js", "ecmascript", "es6"), _t("TypeScript"),
    _t("C++"), _t("C#"), _t("PHP"), _t("Ruby"), _t("Rust"), _t("Scala"), _t("Kotlin"),
    # "go" and "r" are ordinary words, so only their unambiguous forms count as aliases.
    _t("Go", "golang", "go language", "go programming", include_name=False), _t("MATLAB"),
    _t("R", "r programming", "r language", include_name=False),
    _t("Bash", "shell scripting", "shell script"),
    # Web
    _t("HTML", "html5"), _t("CSS", "css3", "scss"), _t("Tailwind CSS", "tailwind"), _t("Bootstrap"),
    _t("React", "react.js", "reactjs"), _t("Next.js", "nextjs"), _t("Vue.js", "vue", "vuejs"),
    _t("Angular", "angularjs"), _t("Node.js", "nodejs", "node js"), _t("Express.js", "expressjs", "express js"),
    _t("Django"), _t("Flask"), _t("FastAPI"), _t("Spring Boot", "springboot", "spring framework", "spring mvc"),
    _t(".NET", "dotnet", "asp.net", ".net core"),
    _t("REST APIs", "rest api", "restful", "restful api", "restful apis", "rest services", "web services"),
    _t("GraphQL"), _t("Microservices", "microservice", "micro-services"), _t("Redux"), _t("jQuery"),
    # Databases
    _t("SQL", "t-sql", "pl/sql"), _t("MySQL"), _t("PostgreSQL", "postgres"),
    _t("SQL Server", "mssql", "microsoft sql server"), _t("Oracle Database", "oracle db"), _t("SQLite"),
    _t("MongoDB", "mongo db", "mongo"), _t("Redis"), _t("Elasticsearch", "elastic search"),
    _t("DynamoDB"), _t("Cassandra"), _t("NoSQL"),
    # Cloud and DevOps
    _t("AWS", "amazon web services"), _t("Azure", "microsoft azure"),
    _t("Google Cloud", "gcp", "google cloud platform"), _t("Docker", "containerization", "containerisation"),
    _t("Kubernetes", "k8s"), _t("Terraform"), _t("Ansible"), _t("Jenkins"),
    _t("CI/CD", "cicd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"),
    _t("Git"), _t("GitHub"), _t("GitLab"), _t("GitHub Actions"), _t("Linux", "unix"), _t("Nginx"),
    _t("Version Control"),
    # Data, analytics and AI
    _t("Machine Learning"), _t("Deep Learning"), _t("NLP", "natural language processing"),
    _t("Computer Vision"), _t("TensorFlow"), _t("PyTorch"), _t("scikit-learn", "scikit learn", "sklearn"),
    _t("Pandas"), _t("NumPy"),
    _t("Data Analysis", "data analytics", "analyzing data", "analysing data"),
    _t("Data Visualization", "data visualisation"), _t("Tableau"), _t("Power BI", "powerbi"), _t("Looker"),
    _t("ETL", "elt"), _t("Data Warehousing", "data warehouse"), _t("Big Data"), _t("Hadoop"),
    _t("Apache Spark", "pyspark"), _t("Airflow", "apache airflow"), _t("Kafka", "apache kafka"),
    _t("Statistics", "statistical analysis", "statistical modeling", "statistical modelling"),
    _t("A/B Testing", "ab testing", "a/b tests"), _t("Data Modeling", "data modelling"),
    _t("LLMs", "llm", "large language models"), _t("Generative AI", "genai", "gen ai"),
    _t("Prompt Engineering"), _t("Excel", "microsoft excel", "ms excel", "advanced excel"),
    _t("PowerPoint", "ms powerpoint", "microsoft powerpoint"),
    # Testing and quality
    _t("Unit Testing", "unit tests"), _t("Test Automation", "automation testing", "automated testing"),
    _t("Selenium"), _t("Cypress"), _t("Jest"), _t("PyTest"), _t("Manual Testing"), _t("Postman"),
    _t("Quality Assurance", "qa testing"),
    _t("TDD", "test-driven development", "test driven development"),
    # Mobile and design
    _t("Android"), _t("iOS"), _t("React Native"), _t("Flutter"), _t("Figma"),
    _t("UI/UX Design", "ui/ux", "ux design", "ui design", "user experience", "user interface design"),
    _t("Photoshop", "adobe photoshop"), _t("Adobe Creative Suite", "adobe creative cloud"),
    # Engineering practices and security
    _t("System Design", "systems design", "software architecture"),
    _t("Object-Oriented Programming", "oop", "object oriented", "object-oriented"),
    _t("Data Structures", "algorithms"),
    _t("Cybersecurity", "cyber security", "information security"),
    _t("Penetration Testing", "pentesting"),
    # Project, product and business
    _t("Agile", "agile methodology", "agile methodologies"), _t("Scrum"), _t("Kanban"), _t("JIRA"),
    _t("Confluence"), _t("Project Management"), _t("Product Management"),
    _t("SEO", "search engine optimization", "search engine optimisation"), _t("SEM"),
    _t("Content Marketing"),
    _t("Social Media Marketing", "social media management", "social media"), _t("Email Marketing"),
    _t("Google Ads", "adwords"), _t("PPC", "pay per click"), _t("Google Analytics", "ga4"),
    _t("CRM"), _t("Salesforce"), _t("HubSpot"), _t("Market Research"), _t("Copywriting"),
    _t("Budgeting", "budget management"), _t("Financial Analysis", "financial reporting"),
    _t("Financial Modeling", "financial modelling"), _t("Accounting"), _t("QuickBooks"), _t("SAP"),
    _t("Customer Service", "customer support", "customer success"),
    _t("Negotiation", "negotiating"),
    _t("Recruiting", "recruitment", "talent acquisition"), _t("Payroll"), _t("Supply Chain"),
    _t("Logistics"), _t("Procurement"), _t("Inventory Management"), _t("Data Entry"),
    _t("Event Planning", "event management"), _t("Patient Care"),
    # Soft skills
    _soft("Communication", "communication skills", "communications skills"),
    _soft("Leadership", "led a team", "team lead", "team leader", "leading a team", "lead a team", "managed a team"),
    _soft("Teamwork", "team player", "collaboration", "collaborative", "cross-functional", "cross functional"),
    _soft("Problem Solving", "problem-solving", "solve problems", "solved problems"),
    _soft("Critical Thinking"), _soft("Time Management", "manage time", "prioritize"),
    _soft("Adaptability", "adaptable"), _soft("Mentoring", "mentor", "mentored", "coaching"),
    _soft("Analytical Skills", "analytical thinking", "analytical"),
    _soft("Public Speaking", "presentation skills", "presentations"),
    _soft("Attention to Detail", "detail-oriented", "detail oriented"),
    _soft("Stakeholder Management", "stakeholder engagement", "managing stakeholders"),
]

SKILLS_BY_NAME: Dict[str, Skill] = {s.name: s for s in SKILLS}

# A job asking for the key is satisfied when the resume shows any listed tool (SQL <- MySQL, Agile <- Scrum).
IMPLIED_BY: Dict[str, Tuple[str, ...]] = {
    "SQL": ("MySQL", "PostgreSQL", "SQL Server", "Oracle Database", "SQLite"),
    "NoSQL": ("MongoDB", "DynamoDB", "Cassandra"),
    "JavaScript": ("TypeScript", "React", "Vue.js", "Angular", "Node.js", "Next.js", "jQuery"),
    "CI/CD": ("Jenkins", "GitHub Actions"),
    "Git": ("GitHub", "GitLab"),
    "Version Control": ("Git", "GitHub", "GitLab"),
    "Machine Learning": ("TensorFlow", "PyTorch", "scikit-learn", "Deep Learning"),
    "Agile": ("Scrum", "Kanban"),
    "CSS": ("Tailwind CSS", "Bootstrap"),
    "Unit Testing": ("PyTest", "Jest", "TDD"),
    "Test Automation": ("Selenium", "Cypress"),
    "Data Analysis": ("Pandas",),
}

# Skills in the same family are related but not interchangeable: they earn partial credit, not a match.
FAMILIES: Tuple[Tuple[str, ...], ...] = (
    ("MySQL", "PostgreSQL", "SQL Server", "Oracle Database", "SQLite"),
    ("MongoDB", "DynamoDB", "Cassandra", "Redis"),
    ("React", "Vue.js", "Angular", "Next.js"),
    ("Django", "Flask", "FastAPI"),
    ("AWS", "Azure", "Google Cloud"),
    ("Jenkins", "GitHub Actions", "GitLab", "CI/CD"),
    ("Tableau", "Power BI", "Looker"),
    ("TensorFlow", "PyTorch", "scikit-learn"),
    ("Selenium", "Cypress", "Jest", "PyTest"),
    ("Android", "iOS", "Flutter", "React Native"),
    ("Salesforce", "HubSpot", "CRM"),
    ("Terraform", "Ansible"),
    ("Docker", "Kubernetes"),
    ("Java", "C#", "C++", "Kotlin", "Scala"),
    ("Google Ads", "PPC", "SEM"),
    ("Scrum", "Kanban", "Agile"),
    ("Hadoop", "Apache Spark", "Kafka"),
    ("Figma", "Photoshop"),
)


def related_skills(name: str) -> FrozenSet[str]:
    """Other skills in any family that `name` belongs to."""
    related = set()
    for family in FAMILIES:
        if name in family:
            related.update(family)
    related.discard(name)
    return frozenset(related)


def _compile(skill: Skill) -> "re.Pattern[str]":
    parts = [re.escape(alias).replace(r"\ ", r"[\s-]+") for alias in skill.aliases]
    return re.compile(r"(?<![a-z0-9+#])(?:" + "|".join(parts) + r")(?![a-z0-9+#])")


_PATTERNS: Dict[str, "re.Pattern[str]"] = {s.name: _compile(s) for s in SKILLS}


def skills_in(text_lower: str) -> List[str]:
    """Canonical names of every taxonomy skill that appears in already-lower-cased text."""
    return [name for name, pattern in _PATTERNS.items() if pattern.search(text_lower)]


def find_skill_mentions(lines_lower: List[str]) -> Dict[str, List[int]]:
    """Maps each skill found to the indices of the lines it appears on."""
    found: Dict[str, List[int]] = {}
    for index, line in enumerate(lines_lower):
        if not line:
            continue
        for name in skills_in(line):
            found.setdefault(name, []).append(index)
    return found


# Certifications. Matched the same way as skills; kept separate because they are credentials, not abilities.
CERTIFICATIONS: Dict[str, Tuple[str, ...]] = {
    "AWS Certification": ("aws certified", "aws certification", "aws solutions architect"),
    "Azure Certification": ("azure certified", "azure certification", "az-900", "az-104", "az-204"),
    "Google Cloud Certification": ("google cloud certified", "google cloud certification"),
    "PMP": ("pmp", "project management professional"),
    "CISSP": ("cissp",),
    "CPA": ("cpa", "certified public accountant"),
    "CFA": ("cfa", "chartered financial analyst"),
    "Scrum Master Certification": ("certified scrum master", "csm", "psm", "professional scrum master"),
    "Six Sigma": ("six sigma",),
    "ITIL": ("itil",),
    "CCNA": ("ccna",),
}

_CERT_PATTERNS: Dict[str, "re.Pattern[str]"] = {
    name: re.compile(
        r"(?<![a-z0-9+#])(?:" + "|".join(re.escape(a).replace(r"\ ", r"[\s-]+") for a in aliases) + r")(?![a-z0-9+#])"
    )
    for name, aliases in CERTIFICATIONS.items()
}


def certifications_in(text_lower: str) -> List[str]:
    return [name for name, pattern in _CERT_PATTERNS.items() if pattern.search(text_lower)]

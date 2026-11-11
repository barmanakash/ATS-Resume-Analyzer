"""Collection names, in one place."""

USERS = "users"
RESUMES = "resumes"
JOB_DESCRIPTIONS = "job_descriptions"
RESUME_ANALYSES = "resume_analyses"
RESUME_VERSIONS = "resume_versions"
OPTIMIZATION_SUGGESTIONS = "optimization_suggestions"

# Auth support collections (not in the product spec, needed for secure sessions and email flows)
REFRESH_TOKENS = "refresh_tokens"
AUTH_TOKENS = "auth_tokens"

# Every collection holding documents with a `userId` field. Used for account deletion.
USER_OWNED_COLLECTIONS = [
    RESUMES,
    JOB_DESCRIPTIONS,
    RESUME_ANALYSES,
    RESUME_VERSIONS,
    OPTIMIZATION_SUGGESTIONS,
]

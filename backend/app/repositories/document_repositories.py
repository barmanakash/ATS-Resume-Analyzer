from app.database.collections import JOB_DESCRIPTIONS, RESUME_ANALYSES, RESUMES
from app.repositories.base import UserOwnedRepository


class ResumeRepository(UserOwnedRepository):
    collection_name = RESUMES
    # storagePath must never be sent to clients; parsed content is large and private
    list_projection = {"storagePath": 0, "parsedText": 0, "parsedData": 0}


class JobDescriptionRepository(UserOwnedRepository):
    collection_name = JOB_DESCRIPTIONS


class AnalysisRepository(UserOwnedRepository):
    collection_name = RESUME_ANALYSES
    list_projection = {"analysisDetails": 0}

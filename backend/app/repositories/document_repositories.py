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
    # The list shows a summary only; the full report is loaded when one analysis is opened.
    list_projection = {
        "resumeId": 1, "jobDescriptionId": 1, "resumeName": 1, "jobTitle": 1, "companyName": 1, "status": 1,
        "overallScore": 1, "recommendation": 1, "mandatoryGapCount": 1, "engineVersion": 1,
        "createdAt": 1, "updatedAt": 1,
    }

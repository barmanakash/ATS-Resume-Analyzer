from typing import Any, List

from app.database.collections import OPTIMIZATION_SUGGESTIONS, RESUME_VERSIONS
from app.repositories.base import UserOwnedRepository
from app.utils.mongo import parse_object_id, serialize


class VersionRepository(UserOwnedRepository):
    collection_name = RESUME_VERSIONS
    # The list shows a summary only. The document, its baseline and its history are large and load with one version.
    list_projection = {
        "resumeId": 1, "analysisId": 1, "jobDescriptionId": 1, "versionNumber": 1, "name": 1, "kind": 1, "mode": 1,
        "resumeName": 1, "jobTitle": 1, "companyName": 1, "pendingCount": 1, "createdAt": 1, "updatedAt": 1,
    }


class SuggestionRepository(UserOwnedRepository):
    collection_name = OPTIMIZATION_SUGGESTIONS

    async def list_for_version(self, user_id: Any, version_oid: Any) -> List[dict]:
        cursor = self.col.find({"userId": parse_object_id(user_id), "resumeVersionId": version_oid}).sort("order", 1)
        return [serialize(doc) async for doc in cursor]

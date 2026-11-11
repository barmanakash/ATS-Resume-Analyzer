from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AnalysisCreatePayload(BaseModel):
    resumeId: str
    jobDescriptionId: str


class AnalysisPublic(BaseModel):
    id: str
    userId: str
    resumeId: str
    jobDescriptionId: str
    status: str
    overallScore: int
    matchedSkills: List[str] = []
    missingSkills: List[str] = []
    partialMatches: List[str] = []
    recommendations: List[str] = []
    analysisDetails: Dict[str, Any] = {}
    createdAt: datetime
    updatedAt: datetime

from typing import Literal

from pydantic import BaseModel


class ExportPayload(BaseModel):
    format: Literal["pdf", "docx"]
    # Both templates are single column and ATS friendly; they differ only in typeface and heading colour.
    template: Literal["classic", "modern"] = "classic"
    pageSize: Literal["A4", "LETTER"] = "A4"

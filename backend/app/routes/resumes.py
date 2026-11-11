import re
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, UploadFile

from app.config import settings
from app.core.exceptions import BadRequestError, NotFoundError
from app.database.collections import RESUMES
from app.database.mongodb import get_db
from app.dependencies.auth import get_current_user
from app.document_processing.resume_parser import extract_resume_metadata
from app.schemas.common import ok, page_meta, get_pagination
from app.storage.local_storage import LocalStorageService
from app.utils.mongo import serialize, to_object_id

router = APIRouter(prefix="/resumes", tags=["resumes"])


_ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def _extract_text(file_name: str, content: bytes) -> str:
    suffix = Path(file_name).suffix.lower()
    if suffix == ".txt":
        return content.decode("utf-8", errors="ignore")

    if suffix == ".pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(BytesIO(content))
            texts = []
            for page in reader.pages:
                text = page.extract_text() or ""
                if text:
                    texts.append(text)
            return "\n".join(texts)
        except Exception:
            return ""

    if suffix == ".docx":
        try:
            from docx import Document

            document = Document(BytesIO(content))
            paragraphs = [paragraph.text.strip() for paragraph in document.paragraphs if paragraph.text.strip()]
            return "\n".join(paragraphs)
        except Exception:
            return ""

    return ""


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


@router.get("")
async def list_resumes(
    pagination=Depends(get_pagination),
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    query = {"userId": current_user["_id"]}
    total = await db[RESUMES].count_documents(query)
    docs = [
        serialize(doc)
        async for doc in db[RESUMES]
        .find(query, {"storagePath": 0, "parsedText": 0, "parsedData": 0})
        .sort("createdAt", -1)
        .skip(pagination.skip)
        .limit(pagination.page_size)
    ]
    return ok(docs, meta=page_meta(total, pagination))


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    name: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    if not file.filename:
        raise BadRequestError("Resume file is required.")
    suffix = Path(file.filename).suffix.lower()
    if suffix not in _ALLOWED_EXTENSIONS:
        raise BadRequestError("Only PDF, DOCX, and TXT resume files are supported.")

    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise BadRequestError(f"Resume file exceeds the {settings.max_upload_mb} MB upload limit.")

    storage = LocalStorageService()
    storage_path = storage.save_upload(str(current_user["_id"]), file.filename, content)
    parsed_text = _extract_text(file.filename, content)
    extracted_data = extract_resume_metadata(parsed_text)
    doc = {
        "userId": current_user["_id"],
        "name": _clean_text(name or Path(file.filename).stem),
        "fileName": file.filename,
        "fileType": suffix.lstrip("."),
        "storagePath": storage_path,
        "status": "processed",
        "parsedText": parsed_text,
        "extractedData": {
            "keywords": extracted_data.get("keywords", []),
            "summary": extracted_data.get("summary", ""),
            "wordCount": extracted_data.get("wordCount", 0),
            "hasPhone": extracted_data.get("hasPhone", False),
            "hasEmail": extracted_data.get("hasEmail", False),
        },
        "createdAt": datetime.utcnow(),
        "updatedAt": datetime.utcnow(),
    }
    result = await get_db()[RESUMES].insert_one(doc)
    doc["_id"] = result.inserted_id
    return ok(serialize(doc))


@router.get("/{resume_id}")
async def get_resume(resume_id: str, current_user: dict = Depends(get_current_user)):
    doc = await get_db()[RESUMES].find_one({"_id": to_object_id(resume_id), "userId": current_user["_id"]})
    if not doc:
        raise NotFoundError("Resume not found.")
    return ok(serialize(doc))


@router.patch("/{resume_id}")
async def update_resume(resume_id: str, payload: dict, current_user: dict = Depends(get_current_user)):
    new_name = (payload or {}).get("name")
    if not new_name:
        raise BadRequestError("A new resume name is required.")
    updated = await get_db()[RESUMES].find_one_and_update(
        {"_id": to_object_id(resume_id), "userId": current_user["_id"]},
        {"$set": {"name": _clean_text(new_name), "updatedAt": datetime.utcnow()}},
        return_document=True,
    )
    if not updated:
        raise NotFoundError("Resume not found.")
    return ok(serialize(updated))


@router.delete("/{resume_id}")
async def delete_resume(resume_id: str, current_user: dict = Depends(get_current_user)):
    doc = await get_db()[RESUMES].find_one({"_id": to_object_id(resume_id), "userId": current_user["_id"]})
    if not doc:
        raise NotFoundError("Resume not found.")
    storage = LocalStorageService()
    storage.delete_file(doc.get("storagePath"))
    await get_db()[RESUMES].delete_one({"_id": doc["_id"]})
    return ok({"deleted": True, "id": str(doc["_id"])})

"""Entry point. Any of these start the API:

    uvicorn main:app --reload
    uvicorn app.main:app --reload
    python main.py
"""
import uvicorn

from app.main import app  # noqa: F401  (re-exported so `uvicorn main:app` works)

if __name__ == "__main__":
    # Passing the app as an import string is required for reload to work.
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)

import logging


def setup_logging(level: str = "INFO") -> None:
    """Plain structured-ish logging.

    Rule for the whole codebase: never log resume text, personal information,
    passwords or tokens. Log ids and event names only.
    """
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    )
    logging.getLogger("httpx").setLevel(logging.WARNING)

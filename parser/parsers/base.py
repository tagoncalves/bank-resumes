import io
import pdfplumber
from abc import ABC, abstractmethod
from models.schema import ParsedStatement


class BaseStatementParser(ABC):
    def __init__(self, pdf_bytes: bytes):
        self.pdf_bytes = pdf_bytes
        self._pdf = None
        self._pages = None

    def load(self):
        self._pdf = pdfplumber.open(io.BytesIO(self.pdf_bytes))
        self._pages = self._pdf.pages
        return self

    def close(self):
        if self._pdf:
            self._pdf.close()

    @abstractmethod
    def parse(self) -> ParsedStatement:
        ...

    @staticmethod
    def detect_bank(pdf_bytes: bytes) -> str:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = pdf.pages[0].extract_text() or ""
        text_upper = text.upper()
        if "BBVA" in text_upper:
            return "BBVA"
        if "GALICIA" in text_upper:
            return "Galicia"
        raise ValueError(f"Banco no reconocido. Texto detectado: {text[:200]}")

    def full_text(self) -> str:
        return "\n".join(p.extract_text() or "" for p in self._pages)

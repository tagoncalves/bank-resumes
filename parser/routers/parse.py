import logging
from fastapi import APIRouter, UploadFile, HTTPException, File

from parsers.base import BaseStatementParser
from parsers.bbva import BBVAParser
from parsers.galicia import GaliciaParser
from models.schema import ParsedStatement

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/parse", response_model=ParsedStatement)
async def parse_statement(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF")

    pdf_bytes = await file.read()

    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="El archivo está vacío")

    try:
        bank = BaseStatementParser.detect_bank(pdf_bytes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    parser_class = BBVAParser if bank == "BBVA" else GaliciaParser
    parser = parser_class(pdf_bytes)

    try:
        parser.load()
        result = parser.parse()
        logger.info(f"Parsed {bank} statement: {len(result.transactions)} transactions")
        return result
    except Exception as e:
        logger.exception(f"Parsing failed for {bank}")
        raise HTTPException(status_code=500, detail=f"Error al parsear: {str(e)}")
    finally:
        parser.close()

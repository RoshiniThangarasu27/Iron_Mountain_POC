from pathlib import Path

from eob_extractor.app.extractor import OCRExtractor
from eob_extractor.app.orchestrator import EOBParser
from eob_extractor.app.normalizer import Normalizer

ocr = OCRExtractor()

text = ocr.extract("src/eob_extractor/tests/full_eob.png")
print("OCR Output:")
print(text)

prompt = Path("src/app/prompts/extraction_prompt.txt").read_text()

parser = EOBParser()

payload = parser.parse(text, prompt)

payload = Normalizer().normalize(payload)

print(payload)

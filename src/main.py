from pathlib import Path

from eob_extractor.app.extractor import OCRExtractor
from eob_extractor.app.orchestrator import EOBParser
from eob_extractor.app.normalizer import Normalizer

ocr = OCRExtractor()

text = ocr.extract_text("sample_eob.pdf")

prompt = Path("app/prompts/extraction_prompt.txt").read_text()

parser = EOBParser()

payload = parser.parse(text, prompt)

payload = Normalizer().normalize(payload)

print(payload)

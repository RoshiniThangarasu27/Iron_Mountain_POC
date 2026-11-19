from azure.ai.documentintelligence import DocumentIntelligenceClient

from azure.core.credentials import AzureKeyCredential

from app.config import DOCUMENT_INTELLIGENCE_ENDPOINT, DOCUMENT_INTELLIGENCE_KEY


class OCRExtractor:

    def __init__(self):

        self.client = DocumentIntelligenceClient(
            endpoint=DOCUMENT_INTELLIGENCE_ENDPOINT,
            credential=AzureKeyCredential(DOCUMENT_INTELLIGENCE_KEY),
        )

    def extract(self, pdf_path: str) -> str:

        with open(pdf_path, "rb") as f:

            poller = self.client.begin_analyze_document("prebuilt-layout", body=f)

        result = poller.result()

        return result.content

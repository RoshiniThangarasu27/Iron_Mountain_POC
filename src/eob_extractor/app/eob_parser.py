import json

from azure.ai.inference.models import SystemMessage, UserMessage

from app.foundry_client import get_client

from eob_extractor.app.config import FOUNDRY_MODEL


class EOBParser:

    def __init__(self):

        self.client = get_client()

    def parse(self, document_text: str, prompt: str):

        response = self.client.complete(
            messages=[SystemMessage(prompt), UserMessage(document_text)],
            model=FOUNDRY_MODEL,
            temperature=0,
        )

        content = response.choices[0].message.content

        return json.loads(content)

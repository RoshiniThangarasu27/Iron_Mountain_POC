import json

from openai import AzureOpenAI

from app.config import AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY

client = AzureOpenAI(
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    api_key=AZURE_OPENAI_KEY,
    api_version="2024-02-01",
)


class EOBParser:

    def parse(self, ocr_text, prompt):

        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": ocr_text},
            ],
            temperature=0,
        )

        return json.loads(response.choices[0].message.content)

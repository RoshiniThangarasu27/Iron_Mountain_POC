import json
import base64

from openai import AzureOpenAI

from eob_extractor.app.config import AZURE_OPENAI_KEY, AZURE_OPENAI_DEPLOYMENT,AZURE_OPENAI_ENDPOINT

client = AzureOpenAI(
    azure_endpoint=AZURE_OPENAI_ENDPOINT,
    api_key=AZURE_OPENAI_KEY,
    api_version="2024-02-15-preview",
)

print(AZURE_OPENAI_ENDPOINT)
print(AZURE_OPENAI_KEY)
class EOBParser:

    def parse(self, prompt):

        with open("src/eob_extractor/tests/full_eob.png", "rb") as f:
            image_base64 = base64.b64encode(f.read()).decode("utf-8")

        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Extract the EOB into structured JSON."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}"
                            }
                        }
                    ]
                }
            ],
            temperature=0
        )

        content = response.choices[0].message.content
        print(content)

        if not content:
            raise ValueError("Model returned empty content")

        # Remove markdown code fences
        content = content.strip()

        if content.startswith("```json"):
            content = content[len("```json"):]

        if content.endswith("```"):
            content = content[:-3]

        content = content.strip()

        return json.loads(content)

        return json.loads(content)

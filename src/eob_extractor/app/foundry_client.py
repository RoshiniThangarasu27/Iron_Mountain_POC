from azure.ai.inference import ChatCompletionsClient
from azure.core.credentials import AzureKeyCredential

from eob_extractor.app.config import FOUNDRY_ENDPOINT, FOUNDRY_API_KEY


def get_client():

    return ChatCompletionsClient(
        endpoint=FOUNDRY_ENDPOINT, credential=AzureKeyCredential(FOUNDRY_API_KEY)
    )

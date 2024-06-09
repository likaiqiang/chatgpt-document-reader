from openai import OpenAI

client = OpenAI(
    api_key="sk-bJLXDQCmLs6F7Ojy707cF29b67F94e4eAaBc55A0E3915b9f",
    base_url="https://www.gptapi.us/v1",
)


def get_embedding():
    sentences = ['如何更换花呗绑定银行卡', '花呗更改绑定银行卡', '我爱中国']
    return client.embeddings.create(input=sentences, model="text-embedding-3-small")


result = get_embedding()
print(result)

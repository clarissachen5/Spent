from ollama import Client

client = Client()

response = client.generate(
    model="llama3.2:3b", prompt="Estimate cost of dinner and drinks in Boston."
)

print(response["response"])

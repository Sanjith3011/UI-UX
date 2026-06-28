import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=os.getenv('GEMINI_API_KEY'))

models_to_test = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-1.5-pro-002',
    'gemini-1.5-flash-latest',
    'gemini-pro-vision'
]

print("Testing models for generation...")
for m in models_to_test:
    try:
        model = genai.GenerativeModel(m)
        response = model.generate_content("Hello, reply with OK")
        print(f"SUCCESS with {m}: {response.text.strip()}")
    except Exception as e:
        print(f"FAILED with {m}: {e}")

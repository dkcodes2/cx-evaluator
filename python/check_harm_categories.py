# check_harm_categories.py
from google.generativeai.types import HarmCategory

print("Available HarmCategory values:")
for category in dir(HarmCategory):
    if not category.startswith('_'):
        print(f"- {category}")
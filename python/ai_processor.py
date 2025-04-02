import json
import sys
import os
from google.generativeai import GenerativeModel, configure
from google.generativeai.types import HarmCategory, HarmBlockThreshold

# Configure the Google Generative AI client
configure(api_key=os.environ.get("GOOGLE_API_KEY"))

def analyze_website(content_for_analysis):
    """
    Analyze website content using Google's Generative AI.
    """
    # First, check if the website is an e-commerce site
    ecommerce_check_prompt = f"""
    Analyze the following website content and determine if it is an e-commerce website.
    Respond with only "YES" if it is an e-commerce website, or "NO" if it is not.

    {content_for_analysis}
    """

    # Set up the model
    model = GenerativeModel(
        model_name="gemini-2.0-flash-thinking-exp-01-21",
        generation_config={
            "temperature": 0.9,
            "top_k": 1,
            "top_p": 1,
            "max_output_tokens": 4096,
        },
        safety_settings=[
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ]
    )

    # Check if it's an e-commerce site
    ecommerce_check_response = model.generate_content(ecommerce_check_prompt)
    is_ecommerce = ecommerce_check_response.text.strip().upper() == "YES"

    if not is_ecommerce:
        return json.dumps({
            "isEcommerce": False,
            "message": "This website does not appear to be an e-commerce site."
        })

    # Main analysis prompt
    prompt = f"""Analyze this e-commerce website content and provide a high-level CX (Customer Experience) evaluation. Focus ONLY on these overall aspects:

    1. Visual Appeal & Branding (0-100): Assess the overall aesthetic, color scheme, typography, and how well the brand identity is communicated.
    2. User Journey (0-100): Evaluate the clarity of the path from landing page to checkout, including product discovery and information accessibility.
    3. Intuitive Navigation (0-100): Judge the ease of finding products, using search functionality, and moving between different sections of the site.
    4. Visual Hierarchy (0-100): Analyze how well the layout guides the user's attention to important elements and facilitates easy scanning of content.
    5. Value Proposition (0-100): Assess how clearly and convincingly the site communicates its unique selling points and benefits to the customer.
    6. Call to Action (0-100): Evaluate the prominence, clarity, and persuasiveness of CTAs throughout the site.

    For each aspect, provide:
    1. A score out of 100
    2. A rationale for the score (2-3 sentences)
    3. Three strengths
    4. Three weaknesses

    Aim for a balanced assessment. Recognize strengths where they exist, but also identify areas for improvement. Use the full range of scores as appropriate, avoiding extremes unless truly warranted.

    Website Content:
    {content_for_analysis}

    Format your response exactly like this:

    Visual Appeal & Branding: [score]/100
    Rationale: [2-3 sentences explaining the score and comparing to industry benchmark]
    Strengths:
    • [Strength 1]
    • [Strength 2]
    • [Strength 3]
    Weaknesses:
    • [Weakness 1]
    • [Weakness 2]
    • [Weakness 3]

    [Repeat the above format for the remaining aspects]

    Detailed Summary:
    [Provide a comprehensive 5-7 sentence summary of the website's overall CX, highlighting key strengths, weaknesses, and areas for improvement. Include insights on how these factors collectively impact the user experience and potential conversion rates. Each sentence should be on a new line.]

    Specific Actionable Items:
    • Visual Appeal & Branding: [Detailed, specific action item with clear implementation steps. Make sure to use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
    Expected benefit: [Clearly state the expected benefits in a separate paragraph.]

    • User Journey: [Detailed, specific action item with clear implementation steps. Make sure to use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
    Expected benefit: [Clearly state the expected benefits in a separate paragraph.]

    • Intuitive Navigation: [Detailed, specific action item with clear implementation steps. Make sure to use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
    Expected benefit: [Clearly state the expected benefits in a separate paragraph.]

    • Visual Hierarchy: [Detailed, specific action item with clear implementation steps. Make sure to use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
    Expected benefit: [Clearly state the expected benefits in a separate paragraph.]

    • Value Proposition: [Detailed, specific action item with clear implementation steps. Make sure to use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
    Expected benefit: [Clearly state the expected benefits in a separate paragraph.]

    • Call to Action: [Detailed, specific action item with clear implementation steps. Make sure to use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
    Expected benefit: [Clearly state the expected benefits in a separate paragraph.]

    • Additional Recommendation: [Detailed, specific action item with clear implementation steps. Make sure to use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
    Expected benefit: [Clearly state the expected benefits in a separate paragraph.]

    IMPORTANT: For each actionable item, provide detailed implementation guidance, not just general advice. Explain HOW to implement the recommendation, not just WHAT to implement.

    Ensure that all sections, including the Specific Actionable Items, are fully completed in your response.
    """

    # Generate the analysis
    response = model.generate_content(prompt)
    text = response.text

    if not text:
        raise Exception("Failed to generate analysis")

    return json.dumps({
        "isEcommerce": True,
        "analysis": text
    })

def generate_page_analysis(url, actual_page_urls):
    """
    Generate detailed page analysis for different page types.
    """
    # Set up the model
    model = GenerativeModel(
        model_name="gemini-2.0-flash-thinking-exp-01-21",
        generation_config={
            "temperature": 0.7,
            "top_k": 1,
            "top_p": 1,
            "max_output_tokens": 4096,
        },
        safety_settings=[
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
        ]
    )

    # Create the prompt
    prompt = f"""
Generate a detailed page analysis for the e-commerce website at {url}.
Focus on these page types with their actual URLs:
- Homepage: {actual_page_urls["Homepage"]}
- Product Listing: {actual_page_urls["Product Listing"] or "Not found"}
- Product Detail: {actual_page_urls["Product Detail"] or "Not found"}
- Shopping Cart: {actual_page_urls["Shopping Cart"] or "Not found"}
- Checkout: {actual_page_urls["Checkout"] or "Not found"}

IMPORTANT: You MUST provide an analysis for ALL FIVE page types listed above, even if some URLs are marked as "Not found". 
For pages marked as "Not found", provide a general analysis based on typical pages of that type in e-commerce websites.

CRITICAL: Only analyze pages from the {url.split("//")[1].split("/")[0]} domain. Do not reference or analyze pages from other domains.

For each page type, provide the following information in EXACTLY this format:

Homepage:
Page URL: [URL]
Overall Score: [0-100]
Score Reasoning: [Provide a detailed 3-5 sentence explanation of the score, analyzing the page's strengths and weaknesses in terms of user experience, design, functionality, and conversion optimization.]

Strengths:
• [Strength 1]
• [Strength 2]
• [Strength 3]

Weaknesses:
• [Weakness 1]
• [Weakness 2]
• [Weakness 3]

Recommendations:
1. [Detailed suggestion 1 - explaining both what to implement and how to implement it. Use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
Reasoning: [Detailed explanation of why this recommendation matters and what specific benefits it will bring. Present this as a complete paragraph with proper sentence structure.]
Reference Website:
Name: [Website Name - use a real e-commerce site like Amazon, Shopify, Nike, etc.]
URL: [Full absolute URL starting with https:// to a SPECIFIC relevant page on that website, not a generic homepage]
Description: [Brief description of why this specific page is a good example]

2. [Detailed suggestion 2 - explaining both what to implement and how to implement it. Use complete sentences and proper paragraph structure. Avoid using abbreviations like "e.g." at the end of lines.]
Reasoning: [Detailed explanation of why this recommendation matters and what specific benefits it will bring. Present this as a complete paragraph with proper sentence structure.]

CRITICAL: Follow this exact format for EACH page type. Use bullet points (•) for strengths and weaknesses, and numbered items for recommendations.
CRITICAL: Include ALL sections for EACH page type.
CRITICAL: Separate each page type with a blank line.
CRITICAL: Do not use markdown formatting like **bold** or *italic*. Use plain text only.
CRITICAL: Do not use "Page Type:" prefix before the page type name.
CRITICAL: Do not use square brackets around page type names.
CRITICAL: Start each section directly with the page type name followed by a colon (e.g., "Homepage:").
CRITICAL: Provide DETAILED recommendations with specific implementation guidance, not just general advice.
CRITICAL: For reference websites, always provide FULL absolute URLs (starting with https://) to SPECIFIC pages, not generic homepages or placeholder text.
"""

    # Generate the analysis
    response = model.generate_content(prompt)
    text = response.text

    if not text:
        raise Exception("Failed to generate page analysis data")

    # Return the raw text - parsing will be handled by TypeScript
    return text

def main():
    # Read input from stdin
    input_data = json.loads(sys.stdin.read())
    
    # Determine which function to call based on the command
    if input_data["command"] == "analyze_website":
        result = analyze_website(input_data["content"])
        print(result)
    elif input_data["command"] == "generate_page_analysis":
        result = generate_page_analysis(input_data["url"], input_data["actualPageUrls"])
        print(result)
    else:
        print(json.dumps({"error": "Unknown command"}))

if __name__ == "__main__":
    main()


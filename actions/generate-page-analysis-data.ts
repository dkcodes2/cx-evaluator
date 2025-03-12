"use server"

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"

// Simple in-memory cache
const cache: { [key: string]: { result: any; timestamp: number } } = {}
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

function cleanAndParseJSON(text: string) {
  try {
    // Remove any markdown code block indicators and leading/trailing whitespace
    text = text.replace(/```json\s*|\s*```/g, "").trim()

    // Find the first '[' and last ']' to extract the JSON array
    const start = text.indexOf("[")
    const end = text.lastIndexOf("]")

    if (start === -1 || end === -1) {
      console.error("Could not find JSON array markers in response")
      return null
    }

    // Extract just the JSON array
    let jsonText = text.slice(start, end + 1)

    // Remove any trailing commas before closing brackets or braces
    jsonText = jsonText.replace(/,(\s*[\]}])/g, "$1")

    // Attempt to parse the JSON
    try {
      return JSON.parse(jsonText)
    } catch (parseError) {
      console.error("Initial parse failed, attempting to fix truncated JSON")

      // If parsing fails, it might be due to truncation. Let's try to fix it.
      const objects = jsonText.split(/},\s*{/)
      const lastObject = objects[objects.length - 1]

      // Check if the last object is complete
      if (!lastObject.endsWith("}]")) {
        // Remove the incomplete object
        objects.pop()
        jsonText = objects.join("},{") + "}]"
      }

      // Try parsing again
      return JSON.parse(jsonText)
    }
  } catch (error) {
    console.error("Error in cleanAndParseJSON:", error)
    return null
  }
}

export async function generatePageAnalysisData(url: string) {
  console.log(`Generating page analysis data for URL: ${url}`)
  try {
    // Check cache first
    const cacheKey = `page_analysis_${url}`
    if (cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < CACHE_DURATION) {
      console.log(`Returning cached page analysis data for ${url}`)
      return cache[cacheKey].result
    }

    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      console.error("GOOGLE_API_KEY is not configured in environment variables")
      return {
        error: "API_KEY_MISSING",
        message: "GOOGLE_API_KEY is not configured in environment variables",
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" })

    const generationConfig = {
      temperature: 0.4,
      topK: 1,
      topP: 1,
      maxOutputTokens: 2048,
    }

    const safetySettings = [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
      {
        category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
        threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
      },
    ]

    const prompt = `
Generate a JSON array containing page analysis data for the e-commerce website at ${url}.
Focus on these page types: Homepage, Product Listing, Product Detail, Shopping Cart, and Checkout.

Each object in the array should follow this EXACT structure, with NO additional fields:
{
  "pageUrl": "string",
  "pageType": "string",
  "score": number,
  "scoreReasoning": "string",
  "strengths": ["string", "string", "string"],
  "weaknesses": ["string", "string", "string"],
  "recommendations": [
    {
      "suggestion": "string",
      "reasoning": "string",
      "referenceWebsite": {
        "name": "string",
        "url": "string",
        "description": "string"
      }
    },
    {
      "suggestion": "string",
      "reasoning": "string",
      "referenceWebsite": {
        "name": "string",
        "url": "string",
        "description": "string"
      }
    }
  ]
}

Respond ONLY with the JSON array. Do not include any explanation or markdown formatting.`

    console.log("Sending page analysis prompt to Gemini API")
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    })

    const response = await result.response
    const text = response.text()

    if (!text) {
      throw new Error("Failed to generate page analysis data")
    }

    console.log("Raw API response:", text)

    // Try to parse the JSON with our new cleaning function
    const jsonData = cleanAndParseJSON(text)

    if (!jsonData || !Array.isArray(jsonData)) {
      throw new Error("Failed to parse valid JSON data from the API response")
    }

    // Validate and sanitize the parsed data
    const validatedData = jsonData.map((page: any) => ({
      pageUrl: typeof page.pageUrl === "string" ? page.pageUrl : "",
      pageType: typeof page.pageType === "string" ? page.pageType : "",
      score: typeof page.score === "number" ? page.score : 0,
      scoreReasoning: typeof page.scoreReasoning === "string" ? page.scoreReasoning : "",
      strengths: Array.isArray(page.strengths)
        ? page.strengths.filter((s: any) => typeof s === "string").slice(0, 3)
        : [],
      weaknesses: Array.isArray(page.weaknesses)
        ? page.weaknesses.filter((w: any) => typeof w === "string").slice(0, 3)
        : [],
      recommendations: Array.isArray(page.recommendations)
        ? page.recommendations.slice(0, 2).map((rec: any) => ({
            suggestion: typeof rec.suggestion === "string" ? rec.suggestion : "",
            reasoning: typeof rec.reasoning === "string" ? rec.reasoning : "",
            referenceWebsite: {
              name: typeof rec.referenceWebsite?.name === "string" ? rec.referenceWebsite.name : "",
              url: typeof rec.referenceWebsite?.url === "string" ? rec.referenceWebsite.url : "",
              description:
                typeof rec.referenceWebsite?.description === "string" ? rec.referenceWebsite.description : "",
            },
          }))
        : [],
    }))

    // Cache the result
    cache[cacheKey] = { result: validatedData, timestamp: Date.now() }

    console.log(`Page analysis data generated for URL: ${url}`)
    return validatedData
  } catch (error) {
    console.error(`Error generating page analysis data for ${url}:`, error)
    if (error instanceof Error) {
      return {
        error: "GENERATION_ERROR",
        message: `An error occurred while generating page analysis data: ${error.message}`,
        details: error.stack,
      }
    }
    return {
      error: "UNKNOWN_ERROR",
      message: "An unexpected error occurred while generating page analysis data.",
      details: String(error),
    }
  }
}


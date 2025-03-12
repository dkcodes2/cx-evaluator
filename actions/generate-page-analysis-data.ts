"use server"

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"

// Simple in-memory cache
const cache: { [key: string]: { result: any; timestamp: number } } = {}
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

interface PageAnalysis {
  pageUrl: string
  pageType: string
  score: number
  scoreReasoning: string
  strengths: string[]
  weaknesses: string[]
  recommendations: Array<{
    suggestion: string
    reasoning: string
    referenceWebsite: {
      name: string
      url: string
      description: string
    }
  }>
}

function parseAnalysisText(text: string, baseUrl: string): PageAnalysis[] {
  const pageTypes = ["Homepage", "Product Listing", "Product Detail", "Shopping Cart", "Checkout"]
  const analyses: PageAnalysis[] = []

  // Create a regex pattern to match each page section
  const pageSectionRegex = new RegExp(`(${pageTypes.join("|")}):[\\s\\S]*?(?=(${pageTypes.join("|")}):|\$)`, "g")

  // Find all page sections
  const pageSections = text.match(pageSectionRegex) || []

  console.log(`Found ${pageSections.length} page sections`)

  pageSections.forEach((section) => {
    try {
      // Determine page type
      const pageTypeMatch = section.match(new RegExp(`^(${pageTypes.join("|")}):`))
      if (!pageTypeMatch) return

      const pageType = pageTypeMatch[1]
      console.log(`Processing ${pageType} section`)

      // Extract page URL
      let pageUrl = section.match(/Page URL:\s*(.*?)(?=\n|$)/)?.[1]?.trim() || baseUrl
      if (!pageUrl.startsWith("http")) {
        pageUrl = baseUrl + (pageUrl.startsWith("/") ? pageUrl : "/" + pageUrl)
      }

      // Extract score
      const scoreMatch = section.match(/Overall Score:\s*(\d+)/)
      const score = scoreMatch ? Number.parseInt(scoreMatch[1]) : 0

      // Extract score reasoning
      const reasoningMatch = section.match(/Score Reasoning:\s*([\s\S]*?)(?=\nStrengths:|\n\n)/)
      const scoreReasoning = reasoningMatch ? reasoningMatch[1].trim() : ""

      // Extract strengths
      const strengthsMatch = section.match(/Strengths:\s*([\s\S]*?)(?=\nWeaknesses:|\n\n)/)
      const strengthsText = strengthsMatch ? strengthsMatch[1] : ""
      const strengths = strengthsText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.startsWith("•") || s.startsWith("-") || s.startsWith("*"))
        .map((s) => s.replace(/^[•\-*]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1"))

      // Extract weaknesses
      const weaknessesMatch = section.match(/Weaknesses:\s*([\s\S]*?)(?=\nRecommendations:|\n\n)/)
      const weaknessesText = weaknessesMatch ? weaknessesMatch[1] : ""
      const weaknesses = weaknessesText
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.startsWith("•") || s.startsWith("-") || s.startsWith("*"))
        .map((s) => s.replace(/^[•\-*]\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1"))

      // Extract recommendations
      const recommendationsMatch = section.match(/Recommendations:\s*([\s\S]*?)(?=\n\n\w|$)/)
      const recommendationsText = recommendationsMatch ? recommendationsMatch[1] : ""

      // Split recommendations by numbered items
      const recommendationItems = recommendationsText.split(/\d+\.\s+/).filter(Boolean)

      const recommendations = recommendationItems.map((item) => {
        const lines = item
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)

        const suggestion = lines[0]?.replace(/\*\*(.*?)\*\*/g, "$1") || ""

        // Find reasoning line
        const reasoningLine = lines.find((line) => line.startsWith("Reasoning:")) || ""
        const reasoning = reasoningLine
          .replace("Reasoning:", "")
          .trim()
          .replace(/\*\*(.*?)\*\*/g, "$1")

        // Extract reference website details
        const nameMatch = item.match(/Name:\s*(.*?)(?=\n|$)/)
        const urlMatch = item.match(/URL:\s*(.*?)(?=\n|$)/)
        const descMatch = item.match(/Description:\s*(.*?)(?=\n|$)/)

        return {
          suggestion,
          reasoning,
          referenceWebsite: {
            name: nameMatch ? nameMatch[1].trim().replace(/\*\*(.*?)\*\*/g, "$1") : "",
            url: urlMatch ? urlMatch[1].trim() : "",
            description: descMatch ? descMatch[1].trim().replace(/\*\*(.*?)\*\*/g, "$1") : "",
          },
        }
      })

      analyses.push({
        pageUrl,
        pageType,
        score,
        scoreReasoning,
        strengths: strengths.length > 0 ? strengths : ["No strengths provided"],
        weaknesses: weaknesses.length > 0 ? weaknesses : ["No weaknesses provided"],
        recommendations:
          recommendations.length > 0
            ? recommendations
            : [
                {
                  suggestion: "No recommendations provided",
                  reasoning: "",
                  referenceWebsite: { name: "", url: "", description: "" },
                },
              ],
      })
    } catch (error) {
      console.error(`Error parsing section:`, error)
    }
  })

  // If we didn't find all page types, generate placeholders for the missing ones
  pageTypes.forEach((pageType) => {
    if (!analyses.some((a) => a.pageType === pageType)) {
      analyses.push({
        pageUrl: baseUrl + (pageType === "Homepage" ? "" : "/" + pageType.toLowerCase().replace(" ", "-")),
        pageType,
        score: 0,
        scoreReasoning: "No data available for this page type",
        strengths: ["No data available"],
        weaknesses: ["No data available"],
        recommendations: [
          {
            suggestion: "No recommendations available",
            reasoning: "",
            referenceWebsite: { name: "", url: "", description: "" },
          },
        ],
      })
    }
  })

  return analyses
}

export async function generatePageAnalysisData(url: string) {
  console.log(`Generating page analysis data for URL: ${url}`)
  try {
    // Check cache first
    if (cache[url] && Date.now() - cache[url].timestamp < CACHE_DURATION) {
      console.log(`Returning cached page analysis data for ${url}`)
      return cache[url].result
    }

    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      console.error("GOOGLE_API_KEY is not configured in environment variables")
      return []
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
Generate a detailed page analysis for the e-commerce website at ${url}.
Focus on these page types: Homepage, Product Listing, Product Detail, Shopping Cart, and Checkout.

For each page type, provide the following information:
1. Page URL (use ${url} as the base URL)
2. Page Type
3. Overall Score (0-100)
4. Score Reasoning (2-3 sentences)
5. Three Strengths
6. Three Weaknesses
7. Two Recommendations, each including:
   - Suggestion
   - Reasoning
   - Reference Website (name, URL, and brief description)

Format your response as a detailed analysis. Do not use JSON format. Ensure each section is clearly labeled and separated.

IMPORTANT: Do not use markdown formatting like **bold** or *italic*. Use plain text only.

Example format:

Homepage:
Page URL: ${url}
Page Type: Homepage
Overall Score: 85
Score Reasoning: The homepage effectively showcases the brand and key products. It has a clean design and clear navigation. However, there's room for improvement in mobile responsiveness and call-to-action placement.
Strengths:
• Strong brand presentation
• Clear product categories
• Engaging hero image
Weaknesses:
• Limited mobile optimization
• Cluttered footer
• Lack of personalized content
Recommendations:
1. Improve mobile responsiveness
   Reasoning: A significant portion of e-commerce traffic comes from mobile devices. Enhancing mobile experience can increase conversion rates.
   Reference Website:
   Name: Etsy
   URL: https://www.etsy.com
   Description: Excellent example of a mobile-friendly e-commerce homepage

2. Streamline footer content
   Reasoning: A cleaner footer can improve navigation and reduce cognitive load for users.
   Reference Website:
   Name: Apple
   URL: https://www.apple.com
   Description: Demonstrates a well-organized and minimal footer design

Product Listing:
Page URL: ${url}/collections
Page Type: Product Listing
Overall Score: 80
Score Reasoning: The product listing pages provide good filtering options and clear product information. However, there are opportunities to improve sorting options and visual hierarchy.
Strengths:
• Effective filtering options
• Clear product thumbnails
• Consistent layout
Weaknesses:
• Limited sorting options
• Pagination could be improved
• Lack of quick view functionality
Recommendations:
1. Add more sorting options
   Reasoning: Additional sorting options like "Best Selling" or "New Arrivals" can help users find relevant products faster.
   Reference Website:
   Name: Nordstrom
   URL: https://www.nordstrom.com
   Description: Offers comprehensive sorting options that enhance product discovery

2. Implement quick view functionality
   Reasoning: Quick view allows users to preview product details without leaving the listing page, improving browsing efficiency.
   Reference Website:
   Name: Sephora
   URL: https://www.sephora.com
   Description: Features an effective quick view implementation that shows key product details

[Continue with similar detailed analyses for Product Detail, Shopping Cart, and Checkout pages]

Ensure that you provide a comprehensive analysis for all five page types mentioned above.
`

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

    // Parse the text into structured data
    const parsedData = parseAnalysisText(text, url)

    console.log(`Parsed ${parsedData.length} page analyses`)

    // Cache the result
    cache[url] = { result: parsedData, timestamp: Date.now() }

    console.log(`Page analysis data generated for URL: ${url}`)
    return parsedData
  } catch (error) {
    console.error(`Error generating page analysis data for ${url}:`, error)
    // Return placeholder data for all page types
    return ["Homepage", "Product Listing", "Product Detail", "Shopping Cart", "Checkout"].map((pageType) => ({
      pageUrl: url + (pageType === "Homepage" ? "" : "/" + pageType.toLowerCase().replace(" ", "-")),
      pageType,
      score: 0,
      scoreReasoning: "An error occurred while generating analysis data.",
      strengths: ["Data unavailable due to error"],
      weaknesses: ["Data unavailable due to error"],
      recommendations: [
        {
          suggestion: "Try analyzing the website again",
          reasoning: "Temporary error occurred during analysis",
          referenceWebsite: {
            name: "Tata CX Support",
            url: "https://example.com/support",
            description: "Contact support if the issue persists",
          },
        },
      ],
    }))
  }
}


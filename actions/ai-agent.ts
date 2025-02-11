"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import * as cheerio from "cheerio"

// Simple in-memory cache (Resets upon every server restart)
const cache: { [url: string]: { result: string; timestamp: number } } = {}
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

export async function analyzeWebsite(url: string) {
  try {
    // Check cache first
    if (cache[url] && Date.now() - cache[url].timestamp < CACHE_DURATION) {
      return cache[url].result
    }

    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured in environment variables")
    }

    const fetchResponse = await fetch(url)
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch website: ${fetchResponse.statusText}`)
    }
    const html = await fetchResponse.text()

    const $ = cheerio.load(html)
    const title = $("title").text()
    const description = $('meta[name="description"]').attr("content") || ""
    const h1Tags = $("h1")
      .map((i, el) => $(el).text())
      .get()

    const contentForAnalysis = `
Website URL: ${url}
Title: ${title}
Description: ${description}
Main Headings: ${h1Tags.join(", ")}
    `.trim()

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })

    const prompt = `Analyze this e-commerce website content and provide a balanced, fair CX (Customer Experience) evaluation. Evaluate the following aspects:

1. Visual Appeal & Branding
2. User Journey
3. Intuitive Navigation
4. Visual Hierarchy
5. Value Proposition
6. Call to Action

For each aspect, provide:
1. A score out of 100
2. A rationale for the score, including a benchmark comparison (e.g., "Compared to industry standards...")
3. Three strengths
4. Three weaknesses

Use the following guidelines for balanced scoring:

- Visual Appeal & Branding (0-100): Assess the overall aesthetic, color scheme, typography, and how well the brand identity is communicated.
- User Journey (0-100): Evaluate the clarity of the path from landing page to checkout, including product discovery and information accessibility.
- Intuitive Navigation (0-100): Judge the ease of finding products, using search functionality, and moving between different sections of the site.
- Visual Hierarchy (0-100): Analyze how well the layout guides the user's attention to important elements and facilitates easy scanning of content.
- Value Proposition (0-100): Assess how clearly and convincingly the site communicates its unique selling points and benefits to the customer.
- Call to Action (0-100): Evaluate the prominence, clarity, and persuasiveness of CTAs throughout the site.

Aim for a balanced assessment. Recognize strengths where they exist, but also identify areas for improvement. Use the full range of scores as appropriate, avoiding extremes unless truly warranted.

Website Content:
${contentForAnalysis}

Format your response exactly like this:

Overall CX Score: [average of all scores]

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

User Journey: [score]/100
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
• Visual Appeal & Branding: [Detailed, specific action item]
• User Journey: [Detailed, specific action item]
• Intuitive Navigation: [Detailed, specific action item]
• Visual Hierarchy: [Detailed, specific action item]
• Value Proposition: [Detailed, specific action item]
• Call to Action: [Detailed, specific action item]
• Additional Recommendation: [Detailed, specific action item]
`

    // Perform a single analysis
    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    if (!text) {
      throw new Error("Failed to generate analysis")
    }

    // Cache result for consistent scoring
    cache[url] = { result: text, timestamp: Date.now() }

    return text
  } catch (error) {
    console.error("Error analyzing website:", error)
    if (error instanceof Error) {
      return `An error occurred while analyzing the website: ${error.message}`
    }
    return "An unexpected error occurred while analyzing the website."
  }
}


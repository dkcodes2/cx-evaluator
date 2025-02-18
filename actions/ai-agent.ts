"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import * as cheerio from "cheerio"

// Simple in-memory cache (Note: This will reset on server restart)
const cache: { [url: string]: { result: string; timestamp: number } } = {}
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

async function fetchWebsiteContent(url: string) {
  const response = await fetch(url)
  const html = await response.text()
  const $ = cheerio.load(html)

  const data = {
    title: $("title").text(),
    description: $('meta[name="description"]').attr("content") || "",
    h1Tags: $("h1")
      .map((_, el) => $(el).text())
      .get(),
    links: $("a")
      .map((_, el) => $(el).attr("href"))
      .get(),
  }

  // Fetch content from up to 3 product pages
  const productLinks = data.links.filter((link) => link && (link.includes("/product") || link.includes("/item")))
  for (let i = 0; i < Math.min(3, productLinks.length); i++) {
    const productUrl = new URL(productLinks[i], url).href
    const productResponse = await fetch(productUrl)
    const productHtml = await productResponse.text()
    const $product = cheerio.load(productHtml)

    data[`product${i + 1}`] = {
      title: $product("title").text(),
      description: $product('meta[name="description"]').attr("content") || "",
      price: $product('.price, [class*="price"]').first().text() || "N/A",
    }
  }

  return data
}

export async function analyzeWebsite(url: string) {
  try {
    // Check cache first
    if (cache[url] && Date.now() - cache[url].timestamp < CACHE_DURATION) {
      return cache[url].result
    }

    if (!process.env.GOOGLE_API_KEY) {
      throw new Error("GOOGLE_API_KEY is not configured in environment variables")
    }

    const websiteData = await fetchWebsiteContent(url)

    const contentForAnalysis = `
Website URL: ${url}
Title: ${websiteData.title}
Description: ${websiteData.description}
Main Headings: ${websiteData.h1Tags.join(", ")}
Number of Links: ${websiteData.links.length}
Product 1: ${JSON.stringify(websiteData.product1)}
Product 2: ${JSON.stringify(websiteData.product2)}
Product 3: ${JSON.stringify(websiteData.product3)}
    `.trim()

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
    const model = genAI.getGenerativeModel({ model: "gemini-pro" })

    // First, check if the website is an e-commerce site
    const ecommerceCheckPrompt = `
Analyze the following website content and determine if it is an e-commerce website.
Respond with only "YES" if it is an e-commerce website, or "NO" if it is not.

${contentForAnalysis}
`

    const ecommerceCheckResult = await model.generateContent(ecommerceCheckPrompt)
    const ecommerceCheckResponse = await ecommerceCheckResult.response
    const isEcommerce = ecommerceCheckResponse.text().trim().toUpperCase() === "YES"

    if (!isEcommerce) {
      return JSON.stringify({ isEcommerce: false, message: "This website does not appear to be an e-commerce site." })
    }

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

    const result = await model.generateContent(prompt)
    const response = await result.response
    const text = response.text()

    if (!text) {
      throw new Error("Failed to generate analysis")
    }

    const finalResult = JSON.stringify({ isEcommerce: true, analysis: text })

    // Cache the result
    cache[url] = { result: finalResult, timestamp: Date.now() }

    return finalResult
  } catch (error) {
    console.error("Error analyzing website:", error)
    if (error instanceof Error) {
      return JSON.stringify({ error: `An error occurred while analyzing the website: ${error.message}` })
    }
    return JSON.stringify({ error: "An unexpected error occurred while analyzing the website." })
  }
}
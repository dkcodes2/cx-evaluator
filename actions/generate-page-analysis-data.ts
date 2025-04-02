"use server"
import { simulateUserFlow } from "./ai-agent"

function isSameDomain(baseUrl: string, urlToCheck: string): boolean {
  try {
    const baseHostname = new URL(baseUrl).hostname
    const checkHostname = new URL(urlToCheck).hostname
    return baseHostname === checkHostname
  } catch {
    return false
  }
}

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

async function getActualPageUrls(baseUrl: string) {
  try {
    console.log(`Getting actual page URLs for ${baseUrl}`)
    const websiteData = await simulateUserFlow(baseUrl)

    // Create a map of page types to actual URLs
    const pageUrls = {
      Homepage: baseUrl,
      "Product Listing": null,
      "Product Detail": null,
      "Shopping Cart": null,
      Checkout: null,
    }

    // Find a category page for Product Listing
    if (websiteData.categories && websiteData.categories.length > 0) {
      // Try to find a category with products
      const categoriesWithProducts = websiteData.categories
        .filter((cat) => cat.productCount > 0)
        .sort((a, b) => b.productCount - a.productCount)

      if (categoriesWithProducts.length > 0) {
        const categoryUrl = categoriesWithProducts[0].url
        pageUrls["Product Listing"] = isSameDomain(baseUrl, categoryUrl) ? categoryUrl : null
        console.log(`Selected category page with ${categoriesWithProducts[0].productCount} products: ${categoryUrl}`)
      } else {
        // Fallback to first category
        const categoryUrl = websiteData.categories[0].url
        pageUrls["Product Listing"] = isSameDomain(baseUrl, categoryUrl) ? categoryUrl : null
      }
    }

    // Find a product page for Product Detail
    if (websiteData.products && websiteData.products.length > 0) {
      // Try to find a product with price and description
      const productsWithDetails = websiteData.products.filter(
        (product) => product.price && product.price !== "N/A" && product.description && product.description !== "N/A",
      )

      if (productsWithDetails.length > 0) {
        const productUrl = productsWithDetails[0].url
        pageUrls["Product Detail"] = isSameDomain(baseUrl, productUrl) ? productUrl : null
        console.log(`Selected product page with details: ${productUrl}`)
      } else {
        // Fallback to first product
        const productUrl = websiteData.products[0].url
        pageUrls["Product Detail"] = isSameDomain(baseUrl, productUrl) ? productUrl : null
      }
    }

    // Find cart page
    if (websiteData.cart && websiteData.cart.url) {
      const cartUrl = websiteData.cart.url
      pageUrls["Shopping Cart"] = isSameDomain(baseUrl, cartUrl) ? cartUrl : null
    }

    // Find checkout page
    if (websiteData.checkout && websiteData.checkout.url) {
      const checkoutUrl = websiteData.checkout.url
      pageUrls["Checkout"] = isSameDomain(baseUrl, checkoutUrl) ? checkoutUrl : null
    }

    console.log("Found actual page URLs:", pageUrls)
    return pageUrls
  } catch (error) {
    console.error("Error getting actual page URLs:", error)
    return {
      Homepage: baseUrl,
      "Product Listing": null,
      "Product Detail": null,
      "Shopping Cart": null,
      Checkout: null,
    }
  }
}

// Enhanced parseAnalysisText function with more robust parsing
function parseAnalysisText(
  text: string,
  baseUrl: string,
  actualPageUrls: Record<string, string | null>,
): PageAnalysis[] {
  const pageTypes = ["Homepage", "Product Listing", "Product Detail", "Shopping Cart", "Checkout"]
  const analyses: PageAnalysis[] = []

  console.log("Starting to parse analysis text")
  console.log("Text length:", text.length)

  // First, try to split by page type headers
  let pageSections: string[] = []

  // Try multiple approaches to extract page sections
  // Approach 1: Use regex to find sections starting with page type followed by colon
  const pageSectionRegex = new RegExp(
    `(?:^|\n)(?:Page Type: )?(\\[?${pageTypes.join("|")}\\]?):[\\s\\S]*?(?=(?:\n(?:Page Type: )?(\\[?${pageTypes.join("|")}\\]?):|$))`,
    "g",
  )
  pageSections = Array.from(text.matchAll(pageSectionRegex)).map((match) => match[0].trim())

  // If that didn't work well, try another approach
  if (pageSections.length < 3) {
    console.log("First regex approach didn't find enough sections, trying alternative")
    // Approach 2: Split by page type headers more aggressively
    const pageTypeHeaders = pageTypes.map((type) => `\n${type}:`).join("|")
    const bracketedPageTypeHeaders = pageTypes.map((type) => `\n\\[${type}\\]:`).join("|")
    const pageTypeWithPrefix = pageTypes.map((type) => `\nPage Type: ${type}`).join("|")
    const combinedHeaders = `${pageTypeHeaders}|${bracketedPageTypeHeaders}|${pageTypeWithPrefix}`
    pageSections = text
      .split(new RegExp(combinedHeaders))
      .filter((_, index) => index > 0) // Skip the first split which is before any header
      .map((section, index) => {
        const pageType = pageTypes[Math.min(index, pageTypes.length - 1)]
        return text.includes(`[${pageType}]:`) ? `[${pageType}]:${section}` : `${pageType}:${section}`
      })
  }

  // If still not enough sections, try one more approach
  if (pageSections.length < 3) {
    console.log("Second approach didn't find enough sections, trying final approach")
    // Approach 3: Just look for each page type explicitly
    pageSections = []
    for (const pageType of pageTypes) {
      const regex = new RegExp(
        `(?:Page Type: )?\\[?${pageType}\\]?:[\\s\\S]*?(?=(?:\n(?:Page Type: )?(?:\\[?${pageTypes.join("|")}\\]?):|$))`,
        "i",
      )
      const match = text.match(regex)
      if (match) {
        pageSections.push(match[0])
      }
    }
  }

  console.log(`Found ${pageSections.length} page sections using regex`)

  // If we still don't have enough sections, log the full text for debugging
  if (pageSections.length < 3) {
    console.log("Warning: Not enough page sections found. Full text:", text)
  }

  // Process each page section
  for (let i = 0; i < pageSections.length; i++) {
    const section = pageSections[i]
    try {
      // Determine page type
      let pageType = ""
      for (const type of pageTypes) {
        if (
          section.startsWith(`[${type}]:`) ||
          section.startsWith(`${type}:`) ||
          section.startsWith(`Page Type: ${type}`) ||
          section.includes(`\n[${type}]:`) ||
          section.includes(`\n${type}:`) ||
          section.includes(`\nPage Type: ${type}`)
        ) {
          pageType = type
          break
        }
      }

      if (!pageType) {
        console.log(`Could not determine page type for section ${i + 1}, skipping`)
        continue
      }

      console.log(`Processing ${pageType} section (${section.length} chars)`)

      // Use the actual URL we found during user flow simulation
      // This ensures we only use URLs from the same domain
      let pageUrl = actualPageUrls[pageType]

      // If we don't have an actual URL for this page type, set it to null
      // We'll display "Not found" in the UI
      if (!pageUrl && pageType !== "Homepage") {
        pageUrl = null
      }

      // Extract score - try multiple patterns
      let score = 0
      const scorePatterns = [/Overall Score:\s*(\d+)/i, /Score:\s*(\d+)/i, /(\d+)\/100/i]

      for (const pattern of scorePatterns) {
        const match = section.match(pattern)
        if (match && match[1]) {
          score = Number.parseInt(match[1], 10)
          if (score > 0) break
        }
      }

      // Extract score reasoning with multiple patterns
      let scoreReasoning = ""
      const reasoningPatterns = [
        /Score Reasoning:\s*([\s\S]*?)(?=\n(?:Strengths:|Weaknesses:|Recommendations:)|\n\n)/i,
        /Rationale:\s*([\s\S]*?)(?=\n(?:Strengths:|Weaknesses:|Recommendations:)|\n\n)/i,
        /Reasoning:\s*([\s\S]*?)(?=\n(?:Strengths:|Weaknesses:|Recommendations:)|\n\n)/i,
      ]

      for (const pattern of reasoningPatterns) {
        const match = section.match(pattern)
        if (match && match[1] && match[1].trim().length > 0) {
          scoreReasoning = match[1].trim()
          break
        }
      }

      // If still no reasoning but we have content, extract a default reasoning
      if (!scoreReasoning && section.length > 200) {
        // Try to extract the first paragraph after the page type as reasoning
        const firstParaMatch = section.match(new RegExp(`${pageType}:.*?\n(.*?)(?=\n\n|$)`, "s"))
        if (firstParaMatch && firstParaMatch[1] && firstParaMatch[1].trim().length > 10) {
          scoreReasoning = firstParaMatch[1].trim()
        } else {
          scoreReasoning = "No specific reasoning provided in the analysis."
        }
      }

      // Extract strengths with multiple patterns
      let strengths: string[] = []
      const strengthsPatterns = [
        /Strengths:\s*([\s\S]*?)(?=\n(?:Weaknesses:|Recommendations:)|\n\n)/i,
        /Pros:\s*([\s\S]*?)(?=\n(?:Weaknesses:|Cons:|Recommendations:)|\n\n)/i,
        /Positive aspects:\s*([\s\S]*?)(?=\n(?:Weaknesses:|Negative aspects:|Recommendations:)|\n\n)/i,
      ]

      for (const pattern of strengthsPatterns) {
        const match = section.match(pattern)
        if (match && match[1]) {
          const strengthsText = match[1].trim()
          // Extract bullet points with multiple bullet styles
          const bulletPoints = strengthsText
            .split("\n")
            .map((line) => line.trim())
            .filter(
              (line) => line.startsWith("•") || line.startsWith("-") || line.startsWith("*") || /^\d+\./.test(line),
            )
            .map((line) => line.replace(/^[•\-*\d.]\s*/, "").trim())

          if (bulletPoints.length > 0) {
            strengths = bulletPoints
            break
          }

          // If no bullet points found, try to split by newlines
          const lines = strengthsText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
          if (lines.length > 0) {
            strengths = lines
            break
          }
        }
      }

      // Extract weaknesses with multiple patterns
      let weaknesses: string[] = []
      const weaknessesPatterns = [
        /Weaknesses:\s*([\s\S]*?)(?=\n(?:Recommendations:|Strengths:)|\n\n)/i,
        /Cons:\s*([\s\S]*?)(?=\n(?:Recommendations:|Strengths:|Pros:)|\n\n)/i,
        /Negative aspects:\s*([\s\S]*?)(?=\n(?:Recommendations:|Strengths:|Positive aspects:)|\n\n)/i,
      ]

      for (const pattern of weaknessesPatterns) {
        const match = section.match(pattern)
        if (match && match[1]) {
          const weaknessesText = match[1].trim()
          // Extract bullet points with multiple bullet styles
          const bulletPoints = weaknessesText
            .split("\n")
            .map((line) => line.trim())
            .filter(
              (line) => line.startsWith("•") || line.startsWith("-") || line.startsWith("*") || /^\d+\./.test(line),
            )
            .map((line) => line.replace(/^[•\-*\d.]\s*/, "").trim())

          if (bulletPoints.length > 0) {
            weaknesses = bulletPoints
            break
          }

          // If no bullet points found, try to split by newlines
          const lines = weaknessesText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
          if (lines.length > 0) {
            weaknesses = lines
            break
          }
        }
      }

      // Extract recommendations with multiple patterns
      let recommendationsText = ""
      const recommendationsPatterns = [
        /Recommendations:\s*([\s\S]*?)(?=\n\n(?:[A-Za-z]|$)|$)/i,
        /Suggestions:\s*([\s\S]*?)(?=\n\n(?:[A-Za-z]|$)|$)/i,
        /Improvements:\s*([\s\S]*?)(?=\n\n(?:[A-Za-z]|$)|$)/i,
      ]

      for (const pattern of recommendationsPatterns) {
        const match = section.match(pattern)
        if (match && match[1] && match[1].trim().length > 0) {
          recommendationsText = match[1].trim()
          break
        }
      }

      // Parse recommendations with enhanced logic
      let recommendations: Array<{
        suggestion: string
        reasoning: string
        referenceWebsite: {
          name: string
          url: string
          description: string
        }
      }> = []

      if (recommendationsText) {
        // Try multiple approaches to split recommendations

        // Approach 1: Split by numbered items
        let recommendationItems: string[] = recommendationsText
          .split(/(?:\n|^)\s*\d+\.\s+/)
          .filter(Boolean)
          .map((item) => item.trim())

        // Approach 2: If that didn't work well, try splitting by bullet points
        if (recommendationItems.length < 1) {
          recommendationItems = recommendationsText
            .split(/(?:\n|^)\s*[•\-*]\s+/)
            .filter(Boolean)
            .map((item) => item.trim())
        }

        // Approach 3: If still not enough, try splitting by double newlines
        if (recommendationItems.length < 1) {
          recommendationItems = recommendationsText
            .split(/\n\s*\n/)
            .filter(Boolean)
            .map((item) => item.trim())
        }

        // Process each recommendation item
        recommendations = recommendationItems
          .map((item) => {
            // Clean up the item text to fix common formatting issues
            item = item
              .replace(/\n\s*([a-z])/g, " $1") // Join lines that start with lowercase letters
              .replace(/([a-z])\n\s*([a-z])/g, "$1 $2") // Join broken sentences
              .replace(/\n\s*,/g, ",") // Fix comma at start of line
              .replace(/\n\s*\./g, ".") // Fix period at start of line
              .replace(/\b(e\.g\.)\s*\n/g, "$1 ") // Fix e.g. line breaks
              .replace(/\b(i\.e\.)\s*\n/g, "$1 ") // Fix i.e. line breaks
              .trim()

            // Split into lines for easier processing
            const lines = item
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean)

            // First line is usually the suggestion
            const suggestion = lines[0] || ""

            // Look for reasoning - capture all content until the next section
            let reasoning = ""
            let reasoningStarted = false
            let referenceStarted = false

            // Collect all lines that appear to be part of the reasoning
            for (let i = 1; i < lines.length; i++) {
              const line = lines[i]

              // If we hit a reference section, stop collecting reasoning
              if (line.includes("Reference Website:") || line.includes("Reference:") || line.includes("Example:")) {
                referenceStarted = true
                break
              }

              // If we find an explicit reasoning marker, start collecting
              if (line.startsWith("Reasoning:") || line.startsWith("Rationale:") || line.startsWith("Why:")) {
                reasoningStarted = true
                reasoning = line.replace(/^(Reasoning|Rationale|Why):\s*/i, "").trim()
              }
              // Otherwise collect all lines as part of reasoning
              else if (i > 0 && !referenceStarted) {
                if (reasoning) reasoning += "\n" + line
                else reasoning = line
              }
            }

            // If no explicit reasoning found but we have lines, use them
            if (!reasoning && lines.length > 1) {
              reasoning = lines.slice(1).join("\n")
            }

            // Extract reference website details
            const referenceWebsite = {
              name: "",
              url: "",
              description: "",
            }

            // Find reference website section
            const refIndex = lines.findIndex(
              (line) => line.includes("Reference Website:") || line.includes("Reference:") || line.includes("Example:"),
            )

            if (refIndex !== -1) {
              // Process reference website details
              for (let i = refIndex + 1; i < lines.length; i++) {
                const line = lines[i]

                if (line.startsWith("Name:")) {
                  referenceWebsite.name = line.replace(/^Name:\s*/i, "").trim()
                } else if (line.startsWith("URL:")) {
                  referenceWebsite.url = line.replace(/^URL:\s*/i, "").trim()
                } else if (line.startsWith("Description:")) {
                  referenceWebsite.description = line.replace(/^Description:\s*/i, "").trim()
                } else if (!referenceWebsite.name && line.includes("http")) {
                  // If we find a URL without explicit label
                  const urlMatch = line.match(/(https?:\/\/[^\s]+)/)
                  if (urlMatch) {
                    referenceWebsite.url = urlMatch[1]
                    referenceWebsite.name = line.replace(urlMatch[1], "").trim() || "Reference Website"
                  }
                } else if (referenceWebsite.name && !referenceWebsite.description) {
                  // If we have a name but no description yet, use remaining lines as description
                  referenceWebsite.description = line
                }
              }
            } else {
              // Look for URLs anywhere in the item
              const urlMatch = item.match(/(https?:\/\/[^\s\n]+)/)
              if (urlMatch) {
                referenceWebsite.url = urlMatch[1]
                referenceWebsite.name = "Reference Website"
              }
            }

            return {
              suggestion,
              reasoning,
              referenceWebsite,
            }
          })
          .filter((rec) => rec.suggestion.length > 0) // Filter out empty suggestions
      }

      // Create the page analysis object
      analyses.push({
        pageUrl: pageUrl || null,
        pageType,
        score,
        scoreReasoning,
        strengths: strengths.length > 0 ? strengths : ["No strengths provided in the analysis"],
        weaknesses: weaknesses.length > 0 ? weaknesses : ["No weaknesses provided in the analysis"],
        recommendations:
          recommendations.length > 0
            ? recommendations
            : [
                {
                  suggestion: "No recommendations provided",
                  reasoning: "The analysis did not include specific recommendations for this page type",
                  referenceWebsite: {
                    name: "",
                    url: "",
                    description: "",
                  },
                },
              ],
      })

      console.log(`Successfully parsed ${pageType} section with score ${score}`)
    } catch (error) {
      console.error(`Error parsing section:`, error)
    }
  }

  // If we didn't find all 5 page types, add placeholders for missing ones
  const foundPageTypes = new Set(analyses.map((a) => a.pageType))

  for (const pageType of pageTypes) {
    if (!foundPageTypes.has(pageType)) {
      console.log(`Adding placeholder for missing page type: ${pageType}`)
      analyses.push({
        pageUrl: actualPageUrls[pageType] || null,
        pageType,
        score: 0,
        scoreReasoning: "This page type was not found in the analysis.",
        strengths: ["No data available for this page type"],
        weaknesses: ["No data available for this page type"],
        recommendations: [
          {
            suggestion: "Try analyzing the website again",
            reasoning: "This page type was not included in the analysis results",
            referenceWebsite: {
              name: "",
              url: "",
              description: "",
            },
          },
        ],
      })
    }
  }

  // Sort analyses by page type to maintain consistent order
  const pageTypeOrder = {
    Homepage: 0,
    "Product Listing": 1,
    "Product Detail": 2,
    "Shopping Cart": 3,
    Checkout: 4,
  }

  analyses.sort((a, b) => pageTypeOrder[a.pageType] - pageTypeOrder[b.pageType])

  console.log(`Returning ${analyses.length} page analyses`)
  return analyses
}

// Find the generatePageAnalysisData function and update it to use the Python bridge

export async function generatePageAnalysisData(url: string) {
  console.log(`Generating page analysis data for URL: ${url}`)
  try {
    // Check cache first
    if (cache[url] && Date.now() - cache[url].timestamp < CACHE_DURATION) {
      console.log(`Returning cached page analysis data for ${url}`)
      return cache[url].result
    }

    // Get actual page URLs first
    const actualPageUrls = await getActualPageUrls(url)

    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      console.error("GOOGLE_API_KEY is not configured in environment variables")
      return []
    }

    // Import the Python bridge
    const { callPythonGeneratePageAnalysis } = await import("./python-bridge")

    // Call Python for page analysis
    console.log("Calling Python for page analysis")
    const text = await callPythonGeneratePageAnalysis(url, actualPageUrls)
    console.log("Python page analysis completed")

    if (!text) {
      throw new Error("Failed to generate page analysis data")
    }

    console.log("Raw API response length:", text.length)
    // Log the first 500 characters for debugging
    console.log("Raw API response (first 500 chars):", text.substring(0, 500))

    // Parse the text into structured data, passing the actual page URLs
    const parsedData = parseAnalysisText(text, url, actualPageUrls)

    console.log(`Parsed ${parsedData.length} page analyses`)

    // Cache the result
    cache[url] = { result: parsedData, timestamp: Date.now() }

    console.log(`Page analysis data generated for URL: ${url}`)
    return parsedData
  } catch (error) {
    console.error(`Error generating page analysis data for ${url}:`, error)
    // Return placeholder data for all page types
    return ["Homepage", "Product Listing", "Product Detail", "Shopping Cart", "Checkout"].map((pageType) => ({
      pageUrl: pageType === "Homepage" ? url : null,
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
            name: "",
            url: "",
            description: "",
          },
        },
      ],
    }))
  }
}


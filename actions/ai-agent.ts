"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"
import * as cheerio from "cheerio"

// Simple in-memory cache (Note: This will reset on server restart)
const cache: { [url: string]: { result: string; timestamp: number } } = {}
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

async function fetchPage(url: string) {
  console.log(`Fetching page: ${url}`)
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.text()
}

function findCartIcon($: cheerio.CheerioAPI): string | null {
  // Common cart icon selectors
  const cartSelectors = [
    'a[href*="cart"]',
    'a[href*="basket"]',
    'a[href*="bag"]',
    '[class*="cart"]',
    '[class*="basket"]',
    '[class*="bag"]',
    '[aria-label*="cart" i]',
    '[aria-label*="basket" i]',
    '[aria-label*="bag" i]',
    '[title*="cart" i]',
    '[title*="basket" i]',
    '[title*="bag" i]',
  ]

  for (const selector of cartSelectors) {
    const element = $(selector).first()
    if (element.length) {
      return element.attr("href") || null
    }
  }
  return null
}

function findCategoryLinks($: cheerio.CheerioAPI): string[] {
  // Common category link selectors
  const categorySelectors = [
    'a[href*="/category"]',
    'a[href*="/collection"]',
    'a[href*="/department"]',
    'a[href*="/shop"]',
    '[class*="category-link"]',
    '[class*="collection-link"]',
    "nav a", // General navigation links
    "#navigation a",
    ".navigation a",
    ".menu a",
  ]

  const links = new Set<string>()

  categorySelectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const href = $(el).attr("href")
      if (href && !href.includes("javascript:") && !href.startsWith("#")) {
        links.add(href)
      }
    })
  })

  return Array.from(links)
}

function findProductLinks($: cheerio.CheerioAPI): string[] {
  // Common product link selectors
  const productSelectors = [
    'a[href*="/product"]',
    'a[href*="/item"]',
    '[class*="product-link"]',
    '[class*="product-card"]',
    '[class*="product-title"]',
    ".product a",
  ]

  const links = new Set<string>()

  productSelectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const href = $(el).attr("href")
      if (href && !href.includes("javascript:") && !href.startsWith("#")) {
        links.add(href)
      }
    })
  })

  return Array.from(links)
}

function findAddToCartButton($: cheerio.CheerioAPI) {
  // Common add to cart button selectors
  const addToCartSelectors = [
    'button[class*="add-to-cart"]',
    'button[class*="add-to-bag"]',
    'button[class*="add-to-basket"]',
    'button:contains("Add to Cart")',
    'button:contains("Add to Bag")',
    'button:contains("Add to Basket")',
    '[aria-label*="add to cart" i]',
    '[aria-label*="add to bag" i]',
    '[aria-label*="add to basket" i]',
  ]

  for (const selector of addToCartSelectors) {
    const element = $(selector).first()
    if (element.length) {
      return {
        text: element.text().trim(),
        isProminent:
          element.is('[class*="primary"], [class*="main"], [class*="prominent"]') ||
          element.css("background-color") !== "transparent",
      }
    }
  }
  return null
}

async function simulateUserFlow(baseUrl: string) {
  console.log(`Simulating user flow for: ${baseUrl}`)
  const data: any = {}

  try {
    // Step 1: Visit homepage
    const homepageHtml = await fetchPage(baseUrl)
    const $homepage = cheerio.load(homepageHtml)

    data.homepage = {
      title: $homepage("title").text(),
      description: $homepage('meta[name="description"]').attr("content") || "",
      h1Tags: $homepage("h1")
        .map((_, el) => $homepage(el).text())
        .get(),
    }

    // Step 2: Find and visit a category page
    const categoryLinks = findCategoryLinks($homepage)
    console.log(`Found ${categoryLinks.length} category links`)

    if (categoryLinks.length > 0) {
      const categoryUrl = new URL(categoryLinks[0], baseUrl).href
      const categoryHtml = await fetchPage(categoryUrl)
      const $category = cheerio.load(categoryHtml)

      data.category = {
        url: categoryUrl,
        title: $category("title").text(),
        productCount: $category('[class*="product"]').length,
      }

      // Step 3: Find and visit a product page
      const productLinks = findProductLinks($category)
      console.log(`Found ${productLinks.length} product links`)

      if (productLinks.length > 0) {
        const productUrl = new URL(productLinks[0], baseUrl).href
        const productHtml = await fetchPage(productUrl)
        const $product = cheerio.load(productHtml)

        const addToCartButton = findAddToCartButton($product)

        data.product = {
          url: productUrl,
          title: $product("title").text(),
          price: $product('[class*="price"]').first().text() || "N/A",
          description:
            $product('meta[name="description"]').attr("content") ||
            $product('[class*="product-description"]').first().text() ||
            "N/A",
        }

        if (addToCartButton) {
          data.addToCart = addToCartButton
        }

        // Step 4: Try to find cart page
        const cartUrl = findCartIcon($product)
        if (cartUrl) {
          const fullCartUrl = new URL(cartUrl, baseUrl).href
          const cartHtml = await fetchPage(fullCartUrl)
          const $cart = cheerio.load(cartHtml)

          data.cart = {
            url: fullCartUrl,
            title: $cart("title").text(),
            itemCount: $cart('[class*="cart-item"], [class*="bag-item"], [class*="basket-item"]').length,
          }
        }
      }
    }

    console.log("User flow simulation completed successfully")
    return data
  } catch (error) {
    console.error("Error during user flow simulation:", error)
    // Return partial data if available
    return data
  }
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

    console.log(`Simulating user flow for ${url}`)
    const websiteData = await simulateUserFlow(url)
    console.log(`User flow simulation completed for ${url}`)

    const contentForAnalysis = `
Website URL: ${url}
Homepage Title: ${websiteData.homepage.title}
Homepage Description: ${websiteData.homepage.description}
Homepage H1 Tags: ${websiteData.homepage.h1Tags.join(", ")}

Category Page:
URL: ${websiteData.category?.url || "N/A"}
Title: ${websiteData.category?.title || "N/A"}
Product Count: ${websiteData.category?.productCount || "N/A"}

Product Page:
URL: ${websiteData.product?.url || "N/A"}
Title: ${websiteData.product?.title || "N/A"}
Price: ${websiteData.product?.price || "N/A"}
Description: ${websiteData.product?.description || "N/A"}

Add to Cart:
Button Text: ${websiteData.addToCart?.buttonText || "N/A"}
Is Prominent: ${websiteData.addToCart?.isProminent ? "Yes" : "No"}

Cart Page:
URL: ${websiteData.cart?.url || "N/A"}
Title: ${websiteData.cart?.title || "N/A"}
Item Count: ${websiteData.cart?.itemCount || "N/A"}
    `.trim()

    console.log(`Content prepared for analysis:`, contentForAnalysis)

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
      return JSON.stringify({
        error: `An error occurred while analyzing the website: ${error.message}`,
        details: error.stack,
      })
    }
    return JSON.stringify({
      error: "An unexpected error occurred while analyzing the website.",
      details: String(error),
    })
  }
}

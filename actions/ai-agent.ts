"use server"

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai"
import * as cheerio from "cheerio"

// Remove the import of URL from 'url'
// import { URL } from "url"

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
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.text()
}

function findNavigationElements($: cheerio.CheerioAPI): string[] {
  const links = new Set<string>()

  // Common navigation selectors
  const navigationSelectors = [
    "nav a",
    "header a",
    "#navigation a",
    ".navigation a",
    ".menu a",
    ".nav a",
    '[class*="menu"] a',
    '[class*="nav"] a',
    '[role="navigation"] a',
    '[aria-label*="navigation" i] a',
    '[aria-label*="menu" i] a',
    'a[href*="/category"]',
    'a[href*="/c/"]',
    'a[href*="/department"]',
    'a[href*="/d/"]',
    'a[href*="/shop"]',
    'a[href*="/collection"]',
    ".menu-item a",
    ".nav-item a",
    '[class*="menu-item"] a',
    '[class*="nav-item"] a',
  ]

  navigationSelectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const $el = $(el)
      const href = $el.attr("href")
      const text = $el.text().trim()

      if (
        href &&
        !href.startsWith("#") &&
        !href.startsWith("javascript:") &&
        !href.includes("login") &&
        !href.includes("signin") &&
        !href.includes("account") &&
        !href.includes("cart") &&
        !href.includes("checkout")
      ) {
        links.add(href)
      }
    })
  })

  return Array.from(links)
}

function findProductElements($: cheerio.CheerioAPI): string[] {
  const links = new Set<string>()

  // Common product link patterns
  const productSelectors = [
    'a[href*="/product"]',
    'a[href*="/p/"]',
    'a[href*="/item"]',
    'a[href*="/i/"]',
    '[class*="product-card"] a',
    '[class*="product-tile"] a',
    '[class*="product-item"] a',
    '[class*="productCard"] a',
    '[class*="productTile"] a',
    ".products-grid a",
    ".product-list a",
    ".product-grid a",
    '[class*="product-grid"] a',
    '[class*="product-list"] a',
    "[data-product-id] a",
    "[data-item-id] a",
    '[class*="product"] a',
    ".product-title a",
    ".product-name a",
    '[class*="product-title"] a',
    '[class*="product-name"] a',
  ]

  productSelectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const href = $(el).attr("href")
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        links.add(href)
      }
    })
  })

  return Array.from(links)
}

function findAddToCartButton($: cheerio.CheerioAPI) {
  // Common add to cart button patterns
  const addToCartSelectors = [
    // Standard buttons
    'button[class*="add-to-cart"]',
    'button[class*="add-to-bag"]',
    'button[class*="add-to-basket"]',

    // Button text patterns
    'button:contains("Add to Cart")',
    'button:contains("Add to Bag")',
    'button:contains("Add to Basket")',

    // ARIA patterns
    '[aria-label*="add to cart" i]',
    '[aria-label*="add to bag" i]',
    '[aria-label*="add to basket" i]',

    // Common class patterns
    '[class*="add-to-cart"]',
    '[class*="addToCart"]',
    '[class*="add-to-bag"]',
    '[class*="addToBag"]',

    // Form submit buttons
    'form[action*="cart"] button[type="submit"]',
    'form[action*="basket"] button[type="submit"]',

    // Data attribute patterns
    '[data-action="add-to-cart"]',
    '[data-button-action="add-to-cart"]',

    // Specific to major e-commerce platforms
    "#add-to-cart-button", // Amazon-like
    "#addToCart", // Common pattern
    ".add-to-cart-button", // Common pattern

    // Generic buttons with cart-related text
    'button[id*="cart" i]',
    'button[class*="cart" i]',
    'button[id*="basket" i]',
    'button[class*="basket" i]',
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

function findCartIcon($: cheerio.CheerioAPI): string | null {
  // Common cart icon patterns
  const cartSelectors = [
    'a[href*="cart"]',
    'a[href*="basket"]',
    'a[href*="bag"]',
    '[class*="cart"]',
    '[class*="basket"]',
    '[class*="bag"]',
    '[class*="shopping"]',
    '[aria-label*="cart" i]',
    '[aria-label*="basket" i]',
    '[aria-label*="bag" i]',
    '[aria-label*="shopping" i]',
    '[title*="cart" i]',
    '[title*="basket" i]',
    '[title*="bag" i]',
    '[class*="icon-cart"]',
    '[class*="cart-icon"]',
    '[class*="icon-basket"]',
    '[class*="basket-icon"]',
  ]

  for (const selector of cartSelectors) {
    const element = $(selector).first()
    if (element.length) {
      const href = element.attr("href") || element.parent("a").attr("href")
      if (href) {
        return href
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
      title: $homepage("title").text().trim(),
      description: $homepage('meta[name="description"]').attr("content") || "",
      h1Tags: $homepage("h1")
        .map((_, el) => $homepage(el).text().trim())
        .get(),
    }

    // Step 2: Explore multiple category pages
    const categoryLinks = findNavigationElements($homepage)
    console.log(`Found ${categoryLinks.length} category links`)

    data.categories = []

    for (const link of categoryLinks.slice(0, 5)) {
      // Explore up to 5 category pages
      try {
        const categoryUrl = new URL(link, baseUrl).href
        console.log(`Exploring category: ${categoryUrl}`)
        const categoryHtml = await fetchPage(categoryUrl)
        const $category = cheerio.load(categoryHtml)

        const categoryData = {
          url: categoryUrl,
          title: $category("title").text().trim(),
          productCount: findProductElements($category).length,
          description: $category('meta[name="description"]').attr("content") || "",
        }

        data.categories.push(categoryData)
        console.log(`Category explored: ${categoryData.url}`)
      } catch (error) {
        console.log(`Failed to process category link ${link}:`, error)
      }
    }

    // Step 3: Explore multiple product pages
    data.products = []

    const productLinks = findProductElements($homepage)
    for (const link of productLinks.slice(0, 3)) {
      // Explore up to 3 products
      try {
        const productUrl = new URL(link, baseUrl).href
        console.log(`Exploring product: ${productUrl}`)
        const productHtml = await fetchPage(productUrl)
        const $product = cheerio.load(productHtml)

        const productData = {
          url: productUrl,
          title: $product("title").text().trim(),
          price: $product('[itemprop="price"], .price, [class*="price"]').first().text().trim() || "N/A",
          description:
            $product('[itemprop="description"], .description, [class*="description"]').first().text().trim() || "N/A",
        }

        data.products.push(productData)
        console.log(`Product explored: ${productData.url}`)
      } catch (error) {
        console.log(`Failed to process product link ${link}:`, error)
      }
    }

    // Step 4: Explore cart and checkout process
    const cartUrl = findCartIcon($homepage)
    if (cartUrl) {
      try {
        const fullCartUrl = new URL(cartUrl, baseUrl).href
        console.log(`Exploring cart: ${fullCartUrl}`)
        const cartHtml = await fetchPage(fullCartUrl)
        const $cart = cheerio.load(cartHtml)

        data.cart = {
          url: fullCartUrl,
          title: $cart("title").text().trim(),
          itemCount: $cart('[class*="cart-item"], [class*="cart_item"]').length,
        }
        console.log(`Cart explored: ${data.cart.url}`)

        // Try to find checkout button
        const checkoutButton = $cart('a[href*="checkout"], button[class*="checkout"]').first()
        if (checkoutButton.length) {
          const checkoutUrl = new URL(checkoutButton.attr("href") || "", baseUrl).href
          console.log(`Exploring checkout: ${checkoutUrl}`)
          const checkoutHtml = await fetchPage(checkoutUrl)
          const $checkout = cheerio.load(checkoutHtml)

          data.checkout = {
            url: checkoutUrl,
            title: $checkout("title").text().trim(),
            steps: $checkout('[class*="checkout-step"], [class*="step"]')
              .map((_, el) => $checkout(el).text().trim())
              .get(),
          }
          console.log(`Checkout explored: ${data.checkout.url}`)
        }
      } catch (error) {
        console.log("Failed to process cart or checkout:", error)
      }
    }

    console.log("User flow simulation completed successfully")
    return data
  } catch (error) {
    console.error("Error during user flow simulation:", error)
    return data
  }
}

export async function analyzeWebsite(url: string) {
  console.log(`Starting analysis for URL: ${url}`)
  try {
    // Check cache first
    if (cache[url] && Date.now() - cache[url].timestamp < CACHE_DURATION) {
      return cache[url].result
    }

    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      console.error("GOOGLE_API_KEY is not configured in environment variables")
      return JSON.stringify({
        error: "API_KEY_MISSING",
        message: "GOOGLE_API_KEY is not configured in environment variables",
        details:
          "Please set the GOOGLE_API_KEY environment variable in your Vercel project settings or .env.local file.",
      })
    }

    console.log(`Simulating user flow for ${url}`)
    const websiteData = await simulateUserFlow(url)
    console.log(`User flow simulation completed for ${url}`)

    const contentForAnalysis = `
Website URL: ${url}
Homepage Title: ${websiteData.homepage.title}
Homepage Description: ${websiteData.homepage.description}
Homepage H1 Tags: ${websiteData.homepage.h1Tags.join(", ")}

Categories:
${websiteData.categories
  .map(
    (category: { url: any; title: any; productCount: any; description: any; }) => `
  URL: ${category.url}
  Title: ${category.title}
  Product Count: ${category.productCount}
  Description: ${category.description}
`,
  )
  .join("")}

Products:
${websiteData.products
  .map(
    (product: { url: any; title: any; price: any; description: any; }) => `
  URL: ${product.url}
  Title: ${product.title}
  Price: ${product.price}
  Description: ${product.description}
`,
  )
  .join("")}

Cart Page:
URL: ${websiteData.cart?.url || "N/A"}
Title: ${websiteData.cart?.title || "N/A"}
Item Count: ${websiteData.cart?.itemCount || "N/A"}

Checkout Page:
URL: ${websiteData.checkout?.url || "N/A"}
Title: ${websiteData.checkout?.title || "N/A"}
Steps: ${websiteData.checkout?.steps.join(", ") || "N/A"}
`.trim()

    console.log(`Content prepared for analysis:`, contentForAnalysis)

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-thinking-exp-01-21" })

    const generationConfig = {
      temperature: 0.9,
      topK: 1,
      topP: 1,
      maxOutputTokens: 4096, // Increased from 2048 to 4096
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

    // First, check if the website is an e-commerce site
    const ecommerceCheckPrompt = `
Analyze the following website content and determine if it is an e-commerce website.
Respond with only "YES" if it is an e-commerce website, or "NO" if it is not.

${contentForAnalysis}
`

    console.log("Sending e-commerce check prompt to Gemini API")
    const ecommerceCheckResult = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: ecommerceCheckPrompt }] }],
      generationConfig,
      safetySettings,
    })

    const ecommerceCheckResponse = await ecommerceCheckResult.response
    const isEcommerce = ecommerceCheckResponse.text().trim().toUpperCase() === "YES"
    console.log(`E-commerce check result: ${isEcommerce ? "Yes" : "No"}`)

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

Ensure that all sections, including the Specific Actionable Items, are fully completed in your response.
`

    console.log("Sending main analysis prompt to Gemini API")
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig,
      safetySettings,
    })

    const response = await result.response
    const text = response.text()

    if (!text) {
      throw new Error("Failed to generate analysis")
    }

    console.log("Analysis generated successfully")
    const finalResult = JSON.stringify({ isEcommerce: true, analysis: text })

    // Cache the result
    cache[url] = { result: finalResult, timestamp: Date.now() }

    console.log(`Analysis completed for URL: ${url}`)
    console.log(`Final result:`, finalResult)
    return finalResult
  } catch (error) {
    console.error(`Error analyzing website ${url}:`, error)
    if (error instanceof Error) {
      return JSON.stringify({
        error: "ANALYSIS_ERROR",
        message: `An error occurred while analyzing the website: ${error.message}`,
        details: error.stack,
      })
    }
    return JSON.stringify({
      error: "UNKNOWN_ERROR",
      message: "An unexpected error occurred while analyzing the website.",
      details: String(error),
    })
  }
}


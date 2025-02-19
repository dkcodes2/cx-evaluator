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
    // Standard navigation elements
    "nav a",
    "header a",
    "#navigation a",
    ".navigation a",
    ".menu a",
    ".nav a",

    // Common e-commerce navigation patterns
    '[class*="menu"] a',
    '[class*="nav"] a',
    '[role="navigation"] a',
    '[aria-label*="navigation" i] a',
    '[aria-label*="menu" i] a',

    // Common category/department links
    'a[href*="/category"]',
    'a[href*="/c/"]',
    'a[href*="/department"]',
    'a[href*="/d/"]',
    'a[href*="/shop"]',
    'a[href*="/collection"]',

    // Common menu item patterns
    ".menu-item a",
    ".nav-item a",
    '[class*="menu-item"] a',
    '[class*="nav-item"] a',

    // Specific to major e-commerce platforms
    "#nav-main a", // Amazon-like
    "#main-menu a", // Common pattern
    ".department-menu a", // Walmart-like
    ".category-menu a", // Common pattern
    '[data-nav-role="link"]', // Custom data attributes
    '[data-nav-type="category"]', // Custom data attributes

    // Mega menu patterns
    ".mega-menu a",
    '[class*="mega-menu"] a',
    ".dropdown-menu a",
    '[class*="dropdown"] a',
  ]

  navigationSelectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const $el = $(el)
      const href = $el.attr("href")
      const text = $el.text().trim()

      // Skip if no href or if it's a non-navigation link
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        href.includes("login") ||
        href.includes("signin") ||
        href.includes("account") ||
        href.includes("cart") ||
        href.includes("checkout")
      ) {
        return
      }

      // Skip common non-category links
      const skipWords = ["about", "contact", "help", "faq", "support", "privacy", "terms"]
      if (skipWords.some((word) => href.toLowerCase().includes(word) || text.toLowerCase().includes(word))) {
        return
      }

      links.add(href)
    })
  })

  return Array.from(links)
}

function findProductElements($: cheerio.CheerioAPI): string[] {
  const links = new Set<string>()

  // Common product link patterns
  const productSelectors = [
    // Standard product elements
    'a[href*="/product"]',
    'a[href*="/p/"]',
    'a[href*="/item"]',
    'a[href*="/i/"]',

    // Common product card patterns
    '[class*="product-card"] a',
    '[class*="product-tile"] a',
    '[class*="product-item"] a',
    '[class*="productCard"] a',
    '[class*="productTile"] a',

    // Product grid/list patterns
    ".products-grid a",
    ".product-list a",
    ".product-grid a",
    '[class*="product-grid"] a',
    '[class*="product-list"] a',

    // Common e-commerce patterns
    "[data-product-id] a",
    "[data-item-id] a",
    '[class*="product"] a',

    // Product title/name patterns
    ".product-title a",
    ".product-name a",
    '[class*="product-title"] a',
    '[class*="product-name"] a',

    // Specific to major e-commerce platforms
    "[data-asin] a", // Amazon-like
    "[data-product] a", // Common pattern
    "[data-sku] a", // Common pattern

    // Product link patterns
    'a[href*="dp/"]', // Amazon-like
    'a[href*="prod"]', // Common pattern
    'a[href*="sku"]', // Common pattern
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
    // Standard cart links
    'a[href*="cart"]',
    'a[href*="basket"]',
    'a[href*="bag"]',

    // Class patterns
    '[class*="cart"]',
    '[class*="basket"]',
    '[class*="bag"]',
    '[class*="shopping"]',

    // ARIA patterns
    '[aria-label*="cart" i]',
    '[aria-label*="basket" i]',
    '[aria-label*="bag" i]',
    '[aria-label*="shopping" i]',

    // Title patterns
    '[title*="cart" i]',
    '[title*="basket" i]',
    '[title*="bag" i]',

    // Icon patterns
    '[class*="icon-cart"]',
    '[class*="cart-icon"]',
    '[class*="icon-basket"]',
    '[class*="basket-icon"]',

    // Specific to major e-commerce platforms
    "#nav-cart", // Amazon-like
    "#mini-cart", // Common pattern
    ".shopping-cart", // Common pattern

    // Data attribute patterns
    '[data-role="cart"]',
    '[data-action="cart"]',
  ]

  for (const selector of cartSelectors) {
    const element = $(selector).first()
    if (element.length) {
      // Try to find the closest anchor tag if the element itself is not an anchor
      const anchor = element.is("a") ? element : element.closest("a")
      if (anchor.length) {
        return anchor.attr("href") || null
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

    // Step 2: Find navigation links and visit a category page
    const navigationLinks = findNavigationElements($homepage)
    console.log(`Found ${navigationLinks.length} navigation links`)

    if (navigationLinks.length > 0) {
      // Try each navigation link until we find one that works
      for (const link of navigationLinks.slice(0, 5)) {
        // Try first 5 links
        try {
          const categoryUrl = new URL(link, baseUrl).href
          console.log(`Trying category URL: ${categoryUrl}`)
          const categoryHtml = await fetchPage(categoryUrl)
          const $category = cheerio.load(categoryHtml)

          // Check if this page has product elements
          const productElements = $category('[class*="product"], [data-product], [data-asin]')
          if (productElements.length > 0) {
            data.category = {
              url: categoryUrl,
              title: $category("title").text(),
              productCount: productElements.length,
            }
            break
          }
        } catch (error) {
          console.log(`Failed to process category link ${link}:`, error)
          continue
        }
      }
    }

    // Step 3: Find and visit a product page
    if (data.category) {
      const $category = cheerio.load(await fetchPage(data.category.url))
      const productLinks = findProductElements($category)
      console.log(`Found ${productLinks.length} product links`)

      if (productLinks.length > 0) {
        // Try each product link until we find one that works
        for (const link of productLinks.slice(0, 5)) {
          // Try first 5 links
          try {
            const productUrl = new URL(link, baseUrl).href
            console.log(`Trying product URL: ${productUrl}`)
            const productHtml = await fetchPage(productUrl)
            const $product = cheerio.load(productHtml)

            const addToCartButton = findAddToCartButton($product)
            const price = $product('[class*="price"], [data-price], .price').first().text()

            if (price || addToCartButton) {
              data.product = {
                url: productUrl,
                title: $product("title").text(),
                price: price || "N/A",
                description:
                  $product('meta[name="description"]').attr("content") ||
                  $product('[class*="product-description"], [class*="description"]').first().text() ||
                  "N/A",
              }

              if (addToCartButton) {
                data.addToCart = addToCartButton
              }
              break
            }
          } catch (error) {
            console.log(`Failed to process product link ${link}:`, error)
            continue
          }
        }
      }
    }

    // Step 4: Try to find cart page
    const cartUrl = findCartIcon($homepage) // Try finding cart from homepage first
    if (cartUrl) {
      try {
        const fullCartUrl = new URL(cartUrl, baseUrl).href
        console.log(`Found cart URL: ${fullCartUrl}`)
        const cartHtml = await fetchPage(fullCartUrl)
        const $cart = cheerio.load(cartHtml)

        data.cart = {
          url: fullCartUrl,
          title: $cart("title").text(),
          itemCount: $cart('[class*="cart-item"], [class*="bag-item"], [class*="basket-item"], [data-cart-item]')
            .length,
        }
      } catch (error) {
        console.log("Failed to process cart page:", error)
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
Button Text: ${websiteData.addToCart?.text || "N/A"}
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


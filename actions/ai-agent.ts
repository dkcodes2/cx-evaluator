"use server"
import * as cheerio from "cheerio"

// Remove the import of URL from 'url'
// import { URL } from "url"

// Add this function at the top of the file, before the fetchPage function
function getRandomUserAgent() {
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36 Edg/92.0.902.84",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
  ]
  return userAgents[Math.floor(Math.random() * userAgents.length)]
}

// Simple in-memory cache (Note: This will reset on server restart)
const cache: { [url: string]: { result: string; timestamp: number } } = {}
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

// Replace the existing fetchPage function with this updated version
async function fetchPage(url: string) {
  console.log(`Attempting to fetch page: ${url}`)

  // First try direct request without proxy
  try {
    console.log(`Trying direct request to: ${url}`)
    const response = await fetch(url, {
      headers: {
        "User-Agent": getRandomUserAgent(),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    })

    if (!response.ok) {
      throw new Error(`Direct request failed with status: ${response.status}`)
    }

    const html = await response.text()

    // Verify we got actual HTML content, not an error page
    if (html.length < 100 || html.includes("Access denied") || html.includes("Forbidden")) {
      throw new Error("Direct request returned invalid content")
    }

    console.log(`Successfully fetched page directly`)
    return html
  } catch (error) {
    console.log(`Direct request failed: ${error.message}. Trying proxy services...`)

    // List of proxy services to try if direct request fails
    const proxyServices = [
      // CORS Anywhere alternatives
      (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
      (url: string) => `https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`,
      (url: string) => `https://cors.bridged.cc/${url}`,
      (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
      (url: string) => `https://api.codetabs.com/v1/proxy?quest=${url}`,
    ]

    // Try each proxy service until one works
    for (let i = 0; i < proxyServices.length; i++) {
      try {
        const proxyUrl = proxyServices[i](url)
        console.log(`Trying proxy service ${i + 1}: ${proxyUrl}`)

        const response = await fetch(proxyUrl, {
          headers: {
            "User-Agent": getRandomUserAgent(),
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
          },
          cache: "no-store", // Bypass cache
        })

        if (!response.ok) {
          console.log(`Proxy service ${i + 1} returned status: ${response.status}`)
          continue // Try next proxy
        }

        const html = await response.text()

        // Verify we got actual HTML content, not an error page
        if (html.length < 100 || html.includes("Access denied") || html.includes("Forbidden")) {
          console.log(`Proxy service ${i + 1} returned invalid content`)
          continue // Try next proxy
        }

        console.log(`Successfully fetched page via proxy service ${i + 1}`)
        return html
      } catch (error) {
        console.log(`Error with proxy service ${i + 1}:`, error)
        // Continue to next proxy service
      }
    }

    // If all proxies fail, throw an error
    throw new Error(`All fetch attempts failed for ${url}`)
  }
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

// Update the findProductElements function to better detect Nike product pages
function findProductElements($: cheerio.CheerioAPI): string[] {
  const links = new Set<string>()

  // Common product link patterns
  const productSelectors = [
    // Nike-specific selectors
    'a[href*="/t/"]',
    'a[href*="/product"]',
    ".product-card a",
    ".product-grid__card a",
    ".product-card__link-overlay",
    ".product-card__img-link-overlay",
    "a[data-product-id]",
    'a[data-test="product-card"]',
    'a[aria-label*="product"]',
    'a[data-qa="product-card"]',

    // General e-commerce product selectors
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

    // Additional general patterns
    'a[href*="shoes"]',
    'a[href*="clothing"]',
    'a[href*="apparel"]',
    'a[href*="gear"]',
    'a[href*="equipment"]',
    'a[href*="accessories"]',
    'a[href*="collection"]',
    'a[href*="detail"]',
    'a[href*="buy"]',
    'a[href*="shop"]',
    'a[href*="pid="]',
    'a[href*="skuid="]',
    'a[href*="style="]',
  ]

  // First try the selectors
  productSelectors.forEach((selector) => {
    $(selector).each((_, el) => {
      const href = $(el).attr("href")
      if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
        links.add(href)
      }
    })
  })

  // If we still don't have enough product links, try to find links with product-related text
  if (links.size < 3) {
    $("a").each((_, el) => {
      const $el = $(el)
      const href = $el.attr("href")
      const text = $el.text().toLowerCase().trim()

      if (
        href &&
        !href.startsWith("#") &&
        !href.startsWith("javascript:") &&
        !links.has(href) &&
        (text.includes("shoe") ||
          text.includes("sneaker") ||
          text.includes("product") ||
          text.includes("item") ||
          text.includes("buy") ||
          text.includes("gear") ||
          text.includes("apparel") ||
          text.includes("clothing") ||
          text.includes("equipment"))
      ) {
        links.add(href)
      }
    })
  }

  // Look for image links that might be product links
  if (links.size < 3) {
    $("a:has(img)").each((_, el) => {
      const $el = $(el)
      const href = $el.attr("href")

      if (
        href &&
        !href.startsWith("#") &&
        !href.startsWith("javascript:") &&
        !links.has(href) &&
        (href.includes("/product") ||
          href.includes("/p/") ||
          href.includes("/t/") ||
          href.includes("/item") ||
          href.includes("pid=") ||
          href.includes("skuid="))
      ) {
        links.add(href)
      }
    })
  }

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

// Enhance the findCartIcon function with more comprehensive selectors
function findCartIcon($: cheerio.CheerioAPI): string | null {
  // Common cart icon patterns - expanded with more patterns
  const cartSelectors = [
    // Standard cart links
    'a[href*="cart"]',
    'a[href*="basket"]',
    'a[href*="bag"]',
    'a[href*="shopping"]',
    'a[href*="checkout"]',
    'a[href*="kasse"]', // German
    'a[href*="panier"]', // French
    'a[href*="carrello"]', // Italian
    'a[href*="carro"]', // Spanish

    // Class-based selectors
    '[class*="cart"]',
    '[class*="basket"]',
    '[class*="bag"]',
    '[class*="shopping"]',
    '[class*="checkout"]',
    '[class*="minicart"]',
    '[class*="mini-cart"]',
    '[class*="cartIcon"]',
    '[class*="cart-icon"]',
    '[class*="cart_icon"]',
    '[class*="icon-cart"]',
    '[class*="icon_cart"]',

    // ARIA attributes
    '[aria-label*="cart" i]',
    '[aria-label*="basket" i]',
    '[aria-label*="bag" i]',
    '[aria-label*="shopping" i]',
    '[aria-label*="checkout" i]',
    '[aria-label*="your items" i]',

    // Title attributes
    '[title*="cart" i]',
    '[title*="basket" i]',
    '[title*="bag" i]',
    '[title*="shopping" i]',
    '[title*="checkout" i]',

    // ID-based selectors
    '[id*="cart"]',
    '[id*="basket"]',
    '[id*="bag"]',
    '[id*="shopping"]',
    '[id*="checkout"]',
    '[id*="minicart"]',
    '[id*="mini-cart"]',

    // Data attributes
    '[data-testid*="cart"]',
    '[data-test*="cart"]',
    '[data-component*="cart"]',
    '[data-role*="cart"]',

    // Common icon patterns
    ".fa-shopping-cart",
    ".fa-cart",
    ".fa-shopping-bag",
    ".fa-shopping-basket",
    '.material-icons:contains("shopping_cart")',
    '.material-icons:contains("shopping_basket")',

    // Common button patterns
    'button[class*="cart"]',
    'button[class*="basket"]',
    'button[class*="bag"]',
    'button[aria-label*="cart" i]',
    'button[title*="cart" i]',

    // SVG patterns
    'svg[class*="cart"]',
    'svg[class*="basket"]',
    'svg[class*="bag"]',
  ]

  // First try direct cart links
  for (const selector of cartSelectors) {
    const element = $(selector).first()
    if (element.length) {
      // Check if the element itself is a link
      const href = element.attr("href")
      if (href) {
        return href
      }

      // Check if the element is inside a link
      const parentLink = element.closest("a")
      if (parentLink.length && parentLink.attr("href")) {
        return parentLink.attr("href")
      }

      // Check if the element has a link inside it
      const childLink = element.find("a").first()
      if (childLink.length && childLink.attr("href")) {
        return childLink.attr("href")
      }
    }
  }

  // If no direct cart link found, look for text-based links
  const cartTextLinks = $("a").filter((_, el) => {
    const text = $(el).text().toLowerCase().trim()
    return (
      text === "cart" ||
      text === "view cart" ||
      text === "shopping cart" ||
      text === "my cart" ||
      text === "basket" ||
      text === "shopping basket" ||
      text === "bag" ||
      text === "shopping bag" ||
      text === "checkout" ||
      text === "proceed to checkout"
    )
  })

  if (cartTextLinks.length) {
    return cartTextLinks.first().attr("href") || null
  }

  return null
}

// Add a new function to find checkout buttons/links
function findCheckoutButton($: cheerio.CheerioAPI): string | null {
  // Common checkout button patterns
  const checkoutSelectors = [
    // Standard checkout links
    'a[href*="checkout"]',
    'a[href*="payment"]',
    'a[href*="order"]',
    'a[href*="purchase"]',
    'a[href*="buy"]',
    'a[href*="kasse"]', // German
    'a[href*="paiement"]', // French
    'a[href*="pagamento"]', // Italian
    'a[href*="pago"]', // Spanish

    // Button selectors
    'button[class*="checkout"]',
    'button[class*="payment"]',
    'button[class*="order"]',
    'button[class*="purchase"]',
    'button[class*="buy"]',

    // Class-based selectors
    '[class*="checkout"]',
    '[class*="check-out"]',
    '[class*="payment"]',
    '[class*="order-now"]',
    '[class*="purchase"]',

    // ARIA attributes
    '[aria-label*="checkout" i]',
    '[aria-label*="payment" i]',
    '[aria-label*="order" i]',
    '[aria-label*="purchase" i]',

    // Title attributes
    '[title*="checkout" i]',
    '[title*="payment" i]',
    '[title*="order" i]',
    '[title*="purchase" i]',

    // ID-based selectors
    '[id*="checkout"]',
    '[id*="payment"]',
    '[id*="order"]',
    '[id*="purchase"]',

    // Data attributes
    '[data-testid*="checkout"]',
    '[data-test*="checkout"]',
    '[data-component*="checkout"]',
    '[data-role*="checkout"]',

    // Form selectors
    'form[action*="checkout"] button[type="submit"]',
    'form[action*="payment"] button[type="submit"]',
    'form[action*="order"] button[type="submit"]',
  ]

  // First try direct checkout elements
  for (const selector of checkoutSelectors) {
    const element = $(selector).first()
    if (element.length) {
      // Check if the element itself is a link
      const href = element.attr("href")
      if (href) {
        return href
      }

      // Check if the element is inside a link
      const parentLink = element.closest("a")
      if (parentLink.length && parentLink.attr("href")) {
        return parentLink.attr("href")
      }

      // Check if the element has a link inside it
      const childLink = element.find("a").first()
      if (childLink.length && childLink.attr("href")) {
        return childLink.attr("href")
      }
    }
  }

  // If no direct checkout element found, look for text-based links
  const checkoutTextLinks = $("a").filter((_, el) => {
    const text = $(el).text().toLowerCase().trim()
    return (
      text === "checkout" ||
      text === "proceed to checkout" ||
      text === "go to checkout" ||
      text === "continue to checkout" ||
      text === "secure checkout" ||
      text === "place order" ||
      text === "complete order" ||
      text === "buy now" ||
      text === "pay now" ||
      text === "payment"
    )
  })

  if (checkoutTextLinks.length) {
    return checkoutTextLinks.first().attr("href") || null
  }

  return null
}

// Update the simulateUserFlow function to use the new findCheckoutButton function
// and improve cart/checkout detection
// Update the simulateUserFlow function to improve product page exploration
export async function simulateUserFlow(baseUrl: string) {
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

        // Try to find product links from category pages
        if (data.categories.length === 1) {
          const productLinksFromCategory = findProductElements($category)
          if (productLinksFromCategory.length > 0) {
            console.log(`Found ${productLinksFromCategory.length} product links from category page`)
            // Save these for later if we don't find enough from homepage
            data._productLinksFromCategory = productLinksFromCategory
          }
        }
      } catch (error) {
        console.log(`Failed to process category link ${link}:`, error)
      }
    }

    // Step 3: Explore multiple product pages
    data.products = []

    // First try to get product links from homepage
    let productLinks = findProductElements($homepage)
    console.log(`Found ${productLinks.length} product links from homepage`)

    // If we didn't find enough product links from homepage, try from category pages
    if (productLinks.length < 3 && data._productLinksFromCategory && data._productLinksFromCategory.length > 0) {
      console.log(`Using product links from category page instead`)
      productLinks = data._productLinksFromCategory
    }

    // If we still don't have enough links, try a more aggressive approach
    if (productLinks.length < 2) {
      console.log(`Not enough product links found, trying more aggressive approach`)

      // Try to find links that might be product links based on URL patterns
      $homepage("a").each((_, el) => {
        const href = $homepage(el).attr("href")
        if (href && !href.startsWith("#") && !href.startsWith("javascript:")) {
          // Check for common product URL patterns
          if (
            href.includes("/product") ||
            href.includes("/p/") ||
            href.includes("/t/") ||
            href.includes("/item") ||
            href.includes("pid=") ||
            href.includes("skuid=") ||
            href.includes("style=") ||
            href.match(/\/[a-z0-9-]+\/[a-z0-9-]+$/i)
          ) {
            // Pattern like /category/product-name
            productLinks.push(href)
          }
        }
      })

      // Remove duplicates
      productLinks = [...new Set(productLinks)]
      console.log(`After aggressive approach, found ${productLinks.length} product links`)
    }

    // Nike-specific fallback if we still don't have product links
    if (productLinks.length === 0 && baseUrl.includes("nike.com")) {
      console.log("Using Nike-specific fallback for product links")
      // Try some common Nike product URLs
      productLinks = [
        "/t/air-force-1-07-shoes-WrLlWX/CW2288-111",
        "/t/air-jordan-1-mid-shoes-BpARGV/554724-140",
        "/t/dunk-low-shoes-N8M9ck/DD1391-100",
      ]
    }

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
          price:
            $product('[itemprop="price"], .price, [class*="price"], [data-test="product-price"]')
              .first()
              .text()
              .trim() || "N/A",
          description:
            $product(
              '[itemprop="description"], .description, [class*="description"], [data-test="product-description"]',
            )
              .first()
              .text()
              .trim() || "N/A",
        }

        data.products.push(productData)
        console.log(`Product explored: ${productData.url}`)
      } catch (error) {
        console.log(`Failed to process product link ${link}:`, parseError(error))
      }
    }

    // Step 4: Explore cart and checkout process
    // First try to find cart from homepage
    let cartUrl = findCartIcon($homepage)
    console.log(`Cart URL from homepage: ${cartUrl || "Not found"}`)

    // If cart not found on homepage, try to find it from product pages
    if (!cartUrl && data.products.length > 0) {
      for (const product of data.products) {
        try {
          console.log(`Looking for cart on product page: ${product.url}`)
          const productHtml = await fetchPage(product.url)
          const $product = cheerio.load(productHtml)
          cartUrl = findCartIcon($product)
          if (cartUrl) {
            console.log(`Found cart URL on product page: ${cartUrl}`)
            break
          }
        } catch (error) {
          console.log(`Failed to check for cart on product page ${product.url}:`, parseError(error))
        }
      }
    }

    if (cartUrl) {
      try {
        const fullCartUrl = new URL(cartUrl, baseUrl).href
        console.log(`Exploring cart: ${fullCartUrl}`)
        const cartHtml = await fetchPage(fullCartUrl)
        const $cart = cheerio.load(cartHtml)

        data.cart = {
          url: fullCartUrl,
          title: $cart("title").text().trim(),
          itemCount: $cart(
            '[class*="cart-item"], [class*="cart_item"], [class*="item"], [class*="product"], tr:has(td)',
          ).length,
        }
        console.log(`Cart explored: ${data.cart.url}`)

        // Try to find checkout button
        let checkoutUrl = findCheckoutButton($cart)
        console.log(`Checkout URL from cart: ${checkoutUrl || "Not found"}`)

        if (checkoutUrl) {
          const fullCheckoutUrl = new URL(checkoutUrl, baseUrl).href
          console.log(`Exploring checkout: ${fullCheckoutUrl}`)
          const checkoutHtml = await fetchPage(fullCheckoutUrl)
          const $checkout = cheerio.load(checkoutHtml)

          data.checkout = {
            url: fullCheckoutUrl,
            title: $checkout("title").text().trim(),
            steps: $checkout(
              '[class*="checkout-step"], [class*="step"], [class*="progress"], [class*="stage"], ol li, ul[class*="step"] li',
            )
              .map((_, el) => $checkout(el).text().trim())
              .get(),
            hasPaymentForm:
              $checkout(
                'input[name*="card"], input[type="credit-card"], [class*="payment"], [class*="credit-card"], [id*="payment"]',
              ).length > 0,
            hasAddressForm:
              $checkout(
                'input[name*="address"], [class*="address"], [id*="address"], input[name*="zip"], input[name*="postal"]',
              ).length > 0,
          }
          console.log(`Checkout explored: ${data.checkout.url}`)
        } else {
          // If checkout not found on cart page, try direct checkout links from homepage
          checkoutUrl = findCheckoutButton($homepage)
          if (checkoutUrl) {
            const fullCheckoutUrl = new URL(checkoutUrl, baseUrl).href
            console.log(`Exploring direct checkout from homepage: ${fullCheckoutUrl}`)
            const checkoutHtml = await fetchPage(fullCheckoutUrl)
            const $checkout = cheerio.load(checkoutHtml)

            data.checkout = {
              url: fullCheckoutUrl,
              title: $checkout("title").text().trim(),
              steps: $checkout(
                '[class*="checkout-step"], [class*="step"], [class*="progress"], [class*="stage"], ol li, ul[class*="step"] li',
              )
                .map((_, el) => $checkout(el).text().trim())
                .get(),
              hasPaymentForm:
                $checkout(
                  'input[name*="card"], input[type="credit-card"], [class*="payment"], [class*="credit-card"], [id*="payment"]',
                ).length > 0,
              hasAddressForm:
                $checkout(
                  'input[name*="address"], [class*="address"], [id*="address"], input[name*="zip"], input[name*="postal"]',
                ).length > 0,
            }
            console.log(`Direct checkout explored: ${data.checkout.url}`)
          }
        }
      } catch (error) {
        console.log("Failed to process cart or checkout:", parseError(error))
      }
    } else {
      // If no cart found, try direct checkout from homepage
      const checkoutUrl = findCheckoutButton($homepage)
      if (checkoutUrl) {
        try {
          const fullCheckoutUrl = new URL(checkoutUrl, baseUrl).href
          console.log(`Exploring direct checkout: ${fullCheckoutUrl}`)
          const checkoutHtml = await fetchPage(fullCheckoutUrl)
          const $checkout = cheerio.load(checkoutHtml)

          data.checkout = {
            url: fullCheckoutUrl,
            title: $checkout("title").text().trim(),
            steps: $checkout(
              '[class*="checkout-step"], [class*="step"], [class*="progress"], [class*="stage"], ol li, ul[class*="step"] li',
            )
              .map((_, el) => $checkout(el).text().trim())
              .get(),
            hasPaymentForm:
              $checkout(
                'input[name*="card"], input[type="credit-card"], [class*="payment"], [class*="credit-card"], [id*="payment"]',
              ).length > 0,
            hasAddressForm:
              $checkout(
                'input[name*="address"], [class*="address"], [id*="address"], input[name*="zip"], input[name*="postal"]',
              ).length > 0,
          }
          console.log(`Direct checkout explored: ${data.checkout.url}`)
        } catch (error) {
          console.log("Failed to process direct checkout:", parseError(error))
        }
      }
    }

    console.log("User flow simulation completed successfully")
    return data
  } catch (error) {
    console.error("Error during user flow simulation:", parseError(error))
    return data
  }
}

// Helper function to safely parse errors
function parseError(error: any): string {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

// Find the analyzeWebsite function and replace it with this updated version
// that uses the Python bridge for AI processing

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
    (category) => `
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
    (product) => `
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

    // Import the Python bridge
    const { callPythonAnalyzeWebsite } = await import("./python-bridge")

    // Call Python for analysis
    console.log("Calling Python for website analysis")
    const finalResult = await callPythonAnalyzeWebsite(contentForAnalysis)
    console.log("Python analysis completed")

    // Cache the result
    cache[url] = { result: finalResult, timestamp: Date.now() }

    console.log(`Analysis completed for URL: ${url}`)
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


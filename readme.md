# E-Commerce Website Analyzer

This repository contains a **Next.js** application that analyzes one or two e-commerce websites and generates a **Customer Experience (CX)** assessment. It simulates a user journey (home, categories, products, cart, checkout) and then leverages **Google’s Generative AI (Gemini)** to provide a structured analysis of various CX components.

---

## Table of Contents

1. [Features](#features)  
2. [Technology Stack](#technology-stack)  
3. [Requirements](#requirements)  
4. [Setup](#setup)  
5. [Usage](#usage)  
6. [Project Structure](#project-structure)  
7. [Code Flow Overview](#code-flow-overview)  
8. [Customization](#customization)  
9. [License](#license)

---

## Features

* **Single/Two Website Analysis**: Analyze one site or compare two sites side by side.  
* **User Flow Simulation**:  
  * Visits the homepage to gather metadata.  
  * Looks for category pages (via navigation menus).  
  * Gathers product links (via product selectors).  
  * Checks for cart and checkout pages.  
* **Google Generative AI**: Uses the `@google/generative-ai` library to connect to Google’s Gemini model.  
* **Scoring by CX Components**:  
  * Visual Appeal & Branding  
  * User Journey  
  * Intuitive Navigation  
  * Visual Hierarchy  
  * Value Proposition  
  * Call to Action  
* **Actionable Recommendations**: Includes specific to-dos for improving each component.  
* **In-Memory Caching**: Prevents repeated analyses for the same URL within a 1-hour window.  
* **UI Components**:  
  * Progress bars to visualize component scores.  
  * Accordions for structured breakdown of Strengths, Weaknesses, and Summaries.

---

## Technology Stack

* **React / Next.js** (Client and Server Components)  
* **TypeScript** (Strongly typed codebase)  
* **Cheerio** (DOM parsing on fetched HTML)  
* **`@google/generative-ai`** (API to Google’s Gemini model)  
* **Tailwind CSS** (Styling)

---

## Requirements

1. **Node.js** (v16+ recommended)  
2. **NPM** or **Yarn** package manager  
3. **Google Generative AI Key**:
   * A valid **`GOOGLE_API_KEY`** for the generative AI integration.  
4. **Network Connectivity**:
   * The code fetches external websites; make sure outbound traffic is allowed.

---

## Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/your-username/ecommerce-analyzer.git
   cd ecommerce-analyzer
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```
   Or, if you use Yarn:
   ```bash
   yarn
   ```

3. **Configure Environment Variables**:
   * In your Vercel project settings or in a local `.env` file, set:
     ```
     GOOGLE_API_KEY=<YOUR_GOOGLE_GENERATIVE_AI_API_KEY>
     ```
   * If using `.env.local` with Next.js, it might look like:
     ```
     GOOGLE_API_KEY=<YOUR_GOOGLE_GENERATIVE_AI_API_KEY>
     ```

4. **Run the Development Server**:
   ```bash
   npm run dev
   ```
   Or:
   ```bash
   yarn dev
   ```
   * Then visit [http://localhost:3000](http://localhost:3000) to see the app.

---

## Usage

1. **Open the application** in your browser at `http://localhost:3000`.  
2. **Select** either:
   * **Single Website**: to analyze one e-commerce site.  
   * **Compare Two Websites**: to analyze and compare both.  
3. **Enter the URL(s)** in the input field(s).  
4. **Click “Analyze Website(s)”**:
   1. The application fetches and parses each site’s homepage, categories, product pages, and cart/checkout page.  
   2. Summarizes the site content.  
   3. Checks with Google’s AI if it’s e-commerce.  
   4. If yes, requests a detailed CX breakdown.  
   5. Results appear once the AI finishes.  
5. **View the Analysis**:
   * **Overall Score** (0-100).  
   * **Component scores** with Strengths, Weaknesses.  
   * **Detailed Summary**.  
   * **Actionable Items** for each category.

---

## Project Structure

A simplified view:

```
ecommerce-analyzer
├── actions
│   └── ai-agent.ts           # Server-side logic for analyzing websites (simulates user flow + AI prompts)
├── components/ui
│   ├── progress.tsx          # Custom progress bar component
│   ├── tooltip.tsx           # Tooltip utilities
│   └── ... (other UI components)
├── pages
│   └── index.tsx             # Main page of the Next.js app (UI for single/two-site analysis)
├── .env.local                # (Ignored by Git) Place your GOOGLE_API_KEY here
├── package.json
└── README.md                 # You are here!
```

---

## Code Flow Overview

1. **`Home` Page** (`index.tsx`)
   * Accepts user input for website URLs.  
   * Invokes `analyzeWebsite(url)` from `ai-agent.ts`.
2. **`analyzeWebsite(url)`** (`ai-agent.ts`)
   * Checks the cache to avoid repeated requests.  
   * **`simulateUserFlow(url)`**:
     * Fetches homepage, categories, products, cart/checkout.  
   * Summarizes site data as `contentForAnalysis`.  
   * Queries Google’s Generative AI in two steps:
     1. **E-commerce check** (YES/NO).  
     2. If YES, a detailed CX analysis by 6 components.  
   * Returns JSON with either an error or the AI’s results.  
   * Caches the final result for 1 hour.
3. **UI Parsing**
   * The Next.js component extracts structured data (scores, rationale, etc.) from the AI’s text and displays them via Accordions, Tables, and Progress bars.

---

## Customization

* **Cheerio Selectors**: Update arrays in `findNavigationElements`, `findProductElements`, or `findCartIcon` if your site uses different naming conventions.  
* **Prompt Adjustments**: Modify prompts in `analyzeWebsite()` to change the style or depth of analysis.  
* **Styling**: All UI is styled with Tailwind CSS; override or extend in your global stylesheet if needed.  
* **Cache Duration**: Change `CACHE_DURATION` in `ai-agent.ts` to customize how long results are cached.

---

## License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.

---

*Thank you for using the E-Commerce Website Analyzer! Feel free to open issues or submit pull requests to improve the tool.*
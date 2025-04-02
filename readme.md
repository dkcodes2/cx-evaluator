# E-commerce Website Analyzer

A powerful tool for analyzing e-commerce websites and providing detailed CX (Customer Experience) evaluations and recommendations.

---

## Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Requirements](#requirements)
- [Setup](#setup)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Code Flow Overview](#code-flow-overview)
- [Customization](#customization)
  - [Modifying AI Prompts](#modifying-ai-prompts)
  - [Adding New Analysis Components](#adding-new-analysis-components)
  - [Extending Web Scraping](#extending-web-scraping)
- [License](#license)

---

## Features

- **Comprehensive E-commerce Analysis**: Evaluates websites across six key CX dimensions: Visual Appeal & Branding, User Journey, Intuitive Navigation, Visual Hierarchy, Value Proposition, and Call to Action.
- **Single or Comparative Analysis**: Analyze a single website or compare two websites side-by-side.
- **Page-Specific Analysis**: Detailed evaluation of key e-commerce pages (Homepage, Product Listing, Product Detail, Shopping Cart, Checkout).
- **Actionable Recommendations**: Provides specific, implementable suggestions to improve website performance.
- **Visual Scoring**: Clear visual representation of scores with color-coded indicators.
- **Robust Web Content Fetching**: Advanced techniques to bypass common restrictions like CORS and firewalls.
- **AI-Powered Insights**: Leverages Google's Generative AI for in-depth analysis and recommendations.

---

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **UI Components**: shadcn/ui, Lucide React icons
- **Backend**: Next.js Server Actions
- **AI Processing**: Python with Google Generative AI
- **Web Scraping**: Cheerio for HTML parsing
- **Data Visualization**: Custom progress indicators, circular progress components
- **Inter-Process Communication**: Node.js child process for JavaScript-Python bridge

---

## Requirements

- Node.js 18.x or higher
- Python 3.8 or higher
- Google API Key for Generative AI access
- npm or yarn package manager

---

## Setup

### Step 1: Install JavaScript Dependencies

Navigate to your project directory and install the required npm packages:

```bash
npm install
```

This will install all the dependencies listed in your `package.json` file.

### Step 2: Set Up Python Environment

1. Make sure you have Python 3.8 or later installed:

```bash
python --version
# or
python3 --version
```

2. Install the required Python packages:

```bash
pip install -r python/requirements.txt
```

If you're using a specific Python version or virtual environment, use the appropriate pip command:

```bash
# For Python 3 specifically
pip3 install -r python/requirements.txt

# Or if using a virtual environment
python -m pip install -r python/requirements.txt
```

### Step 3: Set Up Environment Variables

Create a `.env.local` file in the root directory of your project (if it doesn't exist already):

```bash
touch .env.local
```

Add your Google API key to the `.env.local` file:

```env
GOOGLE_API_KEY=your_google_api_key_here
```

You'll need to obtain a Google Gemini API key from the [Google AI Studio](https://makersuite.google.com/app/apikey).


### Step 4: Run the Setup Script

The project includes a setup script to ensure Python dependencies are correctly installed:

```bash
npm run setup
```

This script will verify that Python is correctly configured and install the necessary dependencies.

### Step 5: Start the Development Server

Start the Next.js development server:

```bash
npm run dev
```

---

## Usage

- Access the application at `http://localhost:3000`
- Choose analysis mode:
  - **Single Website**: Analyze one e-commerce website
  - **Compare Two Websites**: Compare two e-commerce websites side-by-side
- Enter website URL(s) and click "Analyze Website(s)"
- Review the results:
  - Overall CX Score
  - Component Scores (Visual Appeal, User Journey, etc.)
  - Detailed Summary
  - Actionable Recommendations
  - Page-specific analysis (for single website mode)

---

## Project Structure

```
tata-cx/
├── actions/
│   ├── ai-agent.ts
│   ├── generate-page-analysis-data.ts
│   └── python-bridge.ts
├── app/
│   ├── page.tsx
│   └── layout.tsx
├── components/
│   ├── comparison-view.tsx
│   ├── page-analysis.tsx
│   ├── score-display.tsx
│   └── ui/
│       ├── circular-progress.tsx
│       └── progress.tsx
├── python/
│   ├── ai_processor.py
│   └── requirements.txt
├── setup.ts
└── package.json
```

---

## Code Flow Overview

1. **User Input**: User enters website URL(s) in the UI
2. **Web Scraping**: `ai-agent.ts` fetches content and simulates user flow
3. **Data Processing**:
   - JavaScript sends data to Python via `python-bridge.ts`
   - Python processes it using Google Generative AI
   - Results are returned to JS
4. **Analysis Generation**:
   - Overall analysis: `analyzeWebsite` function
   - Page-specific: `generatePageAnalysisData` function
5. **Rendering**: Results shown using various visualization components

---

## Customization

### Modifying AI Prompts
Edit prompts in `python/ai_processor.py`:
- `analyze_website` for overall analysis
- `generate_page_analysis` for page-specific analysis

### Adding New Analysis Components
- Create a new component in `components/`
- Update `app/page.tsx` to include it
- Modify AI prompts accordingly

### Extending Web Scraping
Modify functions in `actions/ai-agent.ts`:
- `fetchPage`, `findNavigationElements`, `simulateUserFlow`, etc.

---

## License

MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
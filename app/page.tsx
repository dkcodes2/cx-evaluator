"use client"

import { useState, useEffect } from "react"
import { analyzeWebsite } from "../actions/ai-agent"
import { generatePageAnalysisData } from "../actions/generate-page-analysis-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { PageAnalysis } from "@/components/page-analysis"
import { CircularProgress } from "@/components/ui/circular-progress"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

interface AnalysisComponent {
  name: string
  score: number
  rationale: string
  strengths: string[]
  weaknesses: string[]
}

interface ActionableItem {
  category: string
  action: string
}

interface PageAnalysisData {
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

const componentNames = [
  "Visual Appeal & Branding",
  "User Journey",
  "Intuitive Navigation",
  "Visual Hierarchy",
  "Value Proposition",
  "Call to Action",
]

export default function Home() {
  const [urls, setUrls] = useState<string[]>(["", ""])
  const [activeUrlCount, setActiveUrlCount] = useState(1)
  const [overallScores, setOverallScores] = useState<number[]>([])
  const [componentsArray, setComponentsArray] = useState<AnalysisComponent[][]>([])
  const [summaries, setSummaries] = useState<string[]>([])
  const [actionableItemsArray, setActionableItemsArray] = useState<ActionableItem[][]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [analysisAttempts, setAnalysisAttempts] = useState(0)
  const [partialResults, setPartialResults] = useState<boolean[]>([])
  const [pageAnalysisData, setPageAnalysisData] = useState<PageAnalysisData[]>([])
  const [isLoadingPageAnalysis, setIsLoadingPageAnalysis] = useState(false)

  const getScoreColorClass = (score: number | null) => {
    if (score === null) return "border-gray-300 text-gray-400"
    if (score >= 90) return "border-green-500 text-green-600"
    if (score >= 50) return "border-yellow-500 text-yellow-600"
    return "border-red-500 text-red-600"
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return "text-gray-400"
    if (score >= 90) return "text-green-500"
    if (score >= 50) return "text-yellow-500"
    return "text-red-500"
  }

  const getProgressColor = (score: number) => {
    if (score >= 90) return "bg-green-500"
    if (score >= 80) return "bg-yellow-500"
    if (score >= 70) return "bg-orange-500"
    return "bg-red-500"
  }

  useEffect(() => {
    console.log("State updated:", {
      overallScores,
      componentsArray,
      summaries,
      actionableItemsArray,
      errors,
      partialResults,
    })
  }, [overallScores, componentsArray, summaries, actionableItemsArray, errors, partialResults])

  useEffect(() => {
    const loadPageData = async () => {
      // Only load data if we have valid URLs and main analysis has completed
      if (overallScores.length === 0 || !overallScores[0]) return

      const urlToAnalyze = urls[0].trim()
      if (!urlToAnalyze) return

      if (pageAnalysisData.length === 0) {
        loadPageAnalysisData(urlToAnalyze)
      }
    }

    loadPageData()
  }, [overallScores, pageAnalysisData.length])

  const loadPageAnalysisData = async (url: string) => {
    try {
      setIsLoadingPageAnalysis(true)
      const data = await generatePageAnalysisData(url)

      if (data && Array.isArray(data) && data.length > 0) {
        console.log("Page analysis data loaded:", data)
        setPageAnalysisData(data)
      } else if (data && data.error) {
        console.error("Error loading page analysis data:", data.error)
      } else {
        console.error("Invalid page analysis data format:", data)
      }
    } catch (error) {
      console.error("Error loading page analysis data:", error)
    } finally {
      setIsLoadingPageAnalysis(false)
    }
  }

  const handleAnalysis = async () => {
    const urlsToAnalyze = urls.slice(0, activeUrlCount).filter((url) => url.trim() !== "")

    if (urlsToAnalyze.length === 0) {
      setErrors(["Please enter at least one website URL"])
      return
    }

    setIsLoading(true)
    setErrors([])
    setOverallScores(new Array(activeUrlCount).fill(null))
    setComponentsArray(new Array(activeUrlCount).fill([]))
    setSummaries(new Array(activeUrlCount).fill(""))
    setActionableItemsArray(new Array(activeUrlCount).fill([]))
    setPartialResults(new Array(activeUrlCount).fill(false))

    // Reset tab data
    setPageAnalysisData([])

    try {
      console.log("Starting analysis for URLs:", urlsToAnalyze)
      const results = await Promise.all(
        urlsToAnalyze.map(async (url, index) => {
          console.log(`Starting analysis for URL ${index + 1}:`, url)
          const resultString = await analyzeWebsite(url)
          console.log(`Raw result for URL ${index + 1}:`, resultString)
          return { url, resultString }
        }),
      )

      results.forEach(({ url, resultString }, index) => {
        let result
        try {
          result = JSON.parse(resultString)
        } catch (parseError) {
          console.error(`Error parsing result for ${url}:`, parseError)
          setErrors((prev) => {
            const newErrors = [...prev]
            newErrors[index] = "Failed to parse analysis results. Please try again."
            return newErrors
          })
          return
        }

        console.log(`Parsed result for URL ${index + 1}:`, result)

        if (result.error) {
          setErrors((prev) => {
            const newErrors = [...prev]
            newErrors[index] = `${result.message}\n\nDetails: ${result.details || "No additional details available"}`
            return newErrors
          })
        } else if (!result.isEcommerce) {
          setErrors((prev) => {
            const newErrors = [...prev]
            newErrors[index] = result.message
            return newErrors
          })
        } else if (!result.analysis) {
          setErrors((prev) => {
            const newErrors = [...prev]
            newErrors[index] = "No analysis data received. Please try again."
            return newErrors
          })
        } else {
          const analysis = result.analysis
          const componentResults: AnalysisComponent[] = []

          componentNames.forEach((name) => {
            try {
              const componentRegex = new RegExp(
                `${name}:\\s*(\\d+)/100\\s*(?:Rationale:)?\\s*([\\s\\S]*?)(?=\\n(?:${componentNames.join("|")}|Detailed Summary|$))`,
                "i",
              )
              const componentMatch = analysis.match(componentRegex)

              if (componentMatch) {
                const [, score, content] = componentMatch
                const rationaleRegex = /Rationale:\s*([\s\\S]*?)(?=\nStrengths:|\nWeaknesses:|\n\n|$)/i
                const strengthsRegex = /Strengths:\s*((?:•[^\n]*\n*)+)/i
                const weaknessesRegex = /Weaknesses:\s*((?:•[^\n]*\n*)+)/i

                const rationaleMatch = content.match(rationaleRegex)
                const strengthsMatch = content.match(strengthsRegex)
                const weaknessesMatch = content.match(weaknessesRegex)

                const rationale = rationaleMatch ? rationaleMatch[1].trim() : ""
                const strengths = strengthsMatch
                  ? strengthsMatch[1]
                      .split("\n")
                      .map((s: string) => s.trim())
                      .filter((s: string) => s.startsWith("•"))
                      .map((s: string) => s.substring(1).trim())
                  : []
                const weaknesses = weaknessesMatch
                  ? weaknessesMatch[1]
                      .split("\n")
                      .map((s: string) => s.trim())
                      .filter((s: string) => s.startsWith("•"))
                      .map((s: string) => s.substring(1).trim())
                  : []

                componentResults.push({
                  name,
                  score: Number.parseInt(score),
                  rationale,
                  strengths,
                  weaknesses,
                })
              } else {
                console.warn(`Failed to parse component: ${name}`)
              }
            } catch (parseError) {
              console.error(`Error parsing component ${name}:`, parseError)
            }
          })

          if (componentResults.length === 0) {
            setErrors((prev) => {
              const newErrors = [...prev]
              newErrors[index] = "Unable to parse any analysis results. Please try again."
              return newErrors
            })
          } else {
            setComponentsArray((prev) => {
              const newComponentsArray = [...prev]
              newComponentsArray[index] = componentResults
              return newComponentsArray
            })

            const totalScore = componentResults.reduce((sum, component) => sum + component.score, 0)
            const calculatedOverallScore = Math.round(totalScore / componentResults.length)

            setOverallScores((prev) => {
              const newOverallScores = [...prev]
              newOverallScores[index] = calculatedOverallScore
              return newOverallScores
            })

            if (componentResults.length < componentNames.length) {
              setPartialResults((prev) => {
                const newPartialResults = [...prev]
                newPartialResults[index] = true
                return newPartialResults
              })
            }

            try {
              const summaryMatch = analysis.match(
                /Detailed Summary:\s*([\s\\S]*?)(?=\n\nSpecific Actionable Items:|\s*$)/i,
              )
              if (summaryMatch) {
                setSummaries((prev) => {
                  const newSummaries = [...prev]
                  newSummaries[index] = summaryMatch[1].trim()
                  return newSummaries
                })
              }

              const actionableItemsMatch = analysis.match(/Specific Actionable Items:\s*([\s\S]*?)$/i)
              if (actionableItemsMatch) {
                const items = actionableItemsMatch[1]
                  .split("\n")
                  .map((item: string) => item.trim())
                  .filter((item: string) => item.startsWith("•"))
                  .map((item: { substring: (arg0: number) => { (): any; new(): any; split: { (arg0: string): { (): any; new(): any; map: { (arg0: (s: any) => any): [any, ...any[]]; new(): any } }; new(): any } } }) => {
                    const [category, ...actionParts] = item
                      .substring(1)
                      .split(":")
                      .map((s: string) => s.trim())
                    return {
                      category,
                      action: actionParts.join(":").trim(),
                    }
                  })
                  .filter((item: { category: any; action: any }) => item.category && item.action)

                setActionableItemsArray((prev) => {
                  const newActionableItemsArray = [...prev]
                  newActionableItemsArray[index] = items
                  return newActionableItemsArray
                })
              }
            } catch (parseError) {
              console.error("Error parsing summary or actionable items:", parseError)
            }
          }
        }
      })

      console.log("Analysis completed. Final state:", {
        overallScores,
        componentsArray,
        summaries,
        actionableItemsArray,
        errors,
        partialResults,
      })

      // After main analysis is complete, load the page analysis data
      if (urls[0] && activeUrlCount === 1) {
        loadPageAnalysisData(urls[0])
      }
    } catch (error) {
      console.error("Error during analysis:", error)
      setErrors([
        "An unexpected error occurred while analyzing the website(s). Please try again later or contact support if the issue persists.",
      ])
    } finally {
      setIsLoading(false)
      setAnalysisAttempts((prev) => prev + 1)
    }
  }

  return (
    <div className="min-h-screen bg-[#e8f0fe]">
      <div className="container mx-auto p-4">
        <Card className="bg-white shadow-lg">
          <CardHeader className="bg-[#4285F4]">
            <CardTitle className="text-2xl font-bold text-white">E-commerce Website Analyzer</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center space-x-2">
                  <Button
                    variant={activeUrlCount === 1 ? "default" : "outline"}
                    onClick={() => setActiveUrlCount(1)}
                    className={activeUrlCount === 1 ? "bg-[#4285F4] hover:bg-[#3367D6] text-white" : ""}
                  >
                    Single Website
                  </Button>
                  <Button
                    variant={activeUrlCount === 2 ? "default" : "outline"}
                    onClick={() => setActiveUrlCount(2)}
                    className={activeUrlCount === 2 ? "bg-[#4285F4] hover:bg-[#3367D6] text-white" : ""}
                  >
                    Compare Two Websites
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="url"
                    value={urls[0]}
                    onChange={(e) => {
                      const newUrls = [...urls]
                      newUrls[0] = e.target.value
                      setUrls(newUrls)
                    }}
                    placeholder="Enter first e-commerce website URL (e.g., https://example.com)"
                    className="flex-grow"
                  />
                  {activeUrlCount > 1 && (
                    <Input
                      type="url"
                      value={urls[1]}
                      onChange={(e) => {
                        const newUrls = [...urls]
                        newUrls[1] = e.target.value
                        setUrls(newUrls)
                      }}
                      placeholder="Enter second e-commerce website URL (e.g., https://example.com)"
                      className="flex-grow"
                    />
                  )}
                </div>
                <Button
                  onClick={handleAnalysis}
                  disabled={isLoading}
                  className="w-full bg-[#4285F4] hover:bg-[#3367D6] text-white"
                >
                  {isLoading
                    ? "Analyzing..."
                    : `Analyze Website${activeUrlCount > 1 ? "s" : ""} (Attempt ${analysisAttempts + 1})`}
                </Button>
              </div>
            </div>

            {errors.some((error) => error) && (
              <div className="space-y-2 mt-4">
                {errors.map((error, index) =>
                  error ? (
                    <Alert key={index} variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>{activeUrlCount > 1 ? `Error (Website ${index + 1})` : "Error"}</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null,
                )}
              </div>
            )}

            {isLoading && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Analyzing</AlertTitle>
                <AlertDescription>
                  Please wait while we analyze the website{activeUrlCount > 1 ? "s" : ""}... This may take a few minutes
                  as we simulate user flow across multiple pages.
                </AlertDescription>
              </Alert>
            )}

            {partialResults.some((partial) => partial) && (
              <Alert className="mt-4">
                <Info className="h-4 w-4" />
                <AlertTitle>Partial Results</AlertTitle>
                <AlertDescription>
                  Some components of the analysis could not be parsed. The results shown may be incomplete.
                </AlertDescription>
              </Alert>
            )}

            {activeUrlCount === 1 && componentsArray[0]?.length > 0 && (
              <div className="mt-6 space-y-8">
                {/* Overall Score Card */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="text-center md:text-left md:flex-1">
                      <h2 className="text-3xl font-bold text-[#4285F4] mb-2">Overall CX Score</h2>
                      <p className="text-gray-600 max-w-2xl">
                        {summaries[0]
                          ? summaries[0].split("\n")[0]
                          : "Analysis of your website's customer experience performance"}
                      </p>
                    </div>
                    <div className="flex flex-col items-center">
                      <CircularProgress value={overallScores[0] ?? 0} size={160} strokeWidth={12} className="mb-2" />
                      <div
                        className={`text-sm font-medium px-3 py-1 rounded-full ${
                          overallScores[0] >= 90
                            ? "bg-green-100 text-green-800"
                            : overallScores[0] >= 70
                              ? "bg-yellow-100 text-yellow-800"
                              : overallScores[0] >= 50
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {overallScores[0] >= 90
                          ? "Excellent"
                          : overallScores[0] >= 70
                            ? "Good"
                            : overallScores[0] >= 50
                              ? "Average"
                              : "Needs Improvement"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Component Score Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {componentsArray[0].map((component, index) => (
                    <div key={component.name} className="bg-white rounded-lg shadow-sm border overflow-hidden">
                      <div className="p-4 border-b bg-gray-50">
                        <div className="flex justify-between items-center">
                          <h3 className="text-lg font-semibold text-gray-800">{component.name}</h3>
                          <span
                            className={`font-bold text-lg ${
                              component.score >= 90
                                ? "text-green-600"
                                : component.score >= 70
                                  ? "text-yellow-600"
                                  : component.score >= 50
                                    ? "text-orange-600"
                                    : "text-red-600"
                            }`}
                          >
                            {component.score}
                          </span>
                        </div>
                        <Progress
                          value={component.score}
                          className="h-2 mt-2"
                          indicatorClassName={
                            component.score >= 90
                              ? "bg-green-500"
                              : component.score >= 70
                                ? "bg-yellow-500"
                                : component.score >= 50
                                  ? "bg-orange-500"
                                  : "bg-red-500"
                          }
                        />
                      </div>
                      <div className="p-4">
                        <p className="text-sm text-gray-600 mb-4">{component.rationale}</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                              Strengths
                            </h4>
                            <ul className="text-sm space-y-1">
                              {component.strengths.slice(0, 2).map((strength, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="text-green-500 mr-1">✓</span> {strength}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                              Weaknesses
                            </h4>
                            <ul className="text-sm space-y-1">
                              {component.weaknesses.slice(0, 2).map((weakness, i) => (
                                <li key={i} className="flex items-start">
                                  <span className="text-red-500 mr-1">✗</span> {weakness}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Detailed Summary */}
                {summaries[0] && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-xl font-bold mb-4 text-[#4285F4]">Detailed Summary</h2>
                    <div className="space-y-2">
                      {summaries[0].split("\n").map((sentence, i) => (
                        <p key={i} className="text-gray-700">
                          {sentence}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actionable Items */}
                {actionableItemsArray[0]?.length > 0 && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-xl font-bold mb-4 text-[#4285F4]">Actionable Recommendations</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {actionableItemsArray[0].map((item, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-start">
                            <div className="bg-[#4285F4] text-white rounded-full p-1 mr-3 mt-0.5">
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-[#4285F4] mb-1">{item.category}</h3>
                              <p className="text-sm text-gray-700">{item.action}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Page Analysis Section - Only for Single Website View */}
                <div className="mt-8">
                  <h2 className="text-2xl font-bold text-[#4285F4] mb-6">Page Analysis</h2>
                  {isLoadingPageAnalysis ? (
                    <div className="flex justify-center items-center p-12 bg-white rounded-lg border">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4285F4] mx-auto mb-4"></div>
                        <p className="text-gray-500">Loading page analysis data...</p>
                      </div>
                    </div>
                  ) : pageAnalysisData.length > 0 ? (
                    <div className="space-y-6">
                      {pageAnalysisData.map((page, index) => (
                        <PageAnalysis
                          key={index}
                          pageUrl={page.pageUrl}
                          pageType={page.pageType}
                          score={page.score}
                          scoreReasoning={page.scoreReasoning}
                          strengths={page.strengths}
                          weaknesses={page.weaknesses}
                          recommendations={page.recommendations}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-12 bg-white rounded-lg border">
                      <p className="text-gray-500">
                        No page analysis data available yet. Complete the website analysis to view page data.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeUrlCount === 2 && (componentsArray[0]?.length > 0 || componentsArray[1]?.length > 0) && (
              <div className="mt-6 space-y-8">
                {/* Overall Scores Comparison */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                  <h2 className="text-2xl font-bold text-[#4285F4] mb-6 text-center">Overall CX Score Comparison</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col items-center">
                      <h3 className="text-lg font-semibold mb-4">{urls[0]}</h3>
                      <CircularProgress value={overallScores[0] ?? 0} size={140} strokeWidth={10} className="mb-4" />
                      <div
                        className={`text-sm font-medium px-3 py-1 rounded-full ${
                          overallScores[0] >= 90
                            ? "bg-green-100 text-green-800"
                            : overallScores[0] >= 70
                              ? "bg-yellow-100 text-yellow-800"
                              : overallScores[0] >= 50
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {overallScores[0] >= 90
                          ? "Excellent"
                          : overallScores[0] >= 70
                            ? "Good"
                            : overallScores[0] >= 50
                              ? "Average"
                              : "Needs Improvement"}
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <h3 className="text-lg font-semibold mb-4">{urls[1]}</h3>
                      <CircularProgress value={overallScores[1] ?? 0} size={140} strokeWidth={10} className="mb-4" />
                      <div
                        className={`text-sm font-medium px-3 py-1 rounded-full ${
                          overallScores[1] >= 90
                            ? "bg-green-100 text-green-800"
                            : overallScores[1] >= 70
                              ? "bg-yellow-100 text-yellow-800"
                              : overallScores[1] >= 50
                                ? "bg-orange-100 text-orange-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {overallScores[1] >= 90
                          ? "Excellent"
                          : overallScores[1] >= 70
                            ? "Good"
                            : overallScores[1] >= 50
                              ? "Average"
                              : "Needs Improvement"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-center">
                    <div
                      className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
                        overallScores[0] > overallScores[1]
                          ? "bg-green-100 text-green-800"
                          : overallScores[1] > overallScores[0]
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {overallScores[0] > overallScores[1] ? (
                        <>
                          <ArrowUp className="h-4 w-4" />
                          <span>Website 1 outperforms by {overallScores[0] - overallScores[1]} points</span>
                        </>
                      ) : overallScores[1] > overallScores[0] ? (
                        <>
                          <ArrowDown className="h-4 w-4" />
                          <span>Website 2 outperforms by {overallScores[1] - overallScores[0]} points</span>
                        </>
                      ) : (
                        <>
                          <Minus className="h-4 w-4" />
                          <span>Equal overall performance</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Component Comparison Cards */}
                <div className="space-y-6">
                  <h2 className="text-2xl font-bold text-[#4285F4]">Component Comparison</h2>
                  {componentNames.map((name, idx) => {
                    const comp1 = componentsArray[0]?.find((c) => c.name === name)
                    const comp2 = componentsArray[1]?.find((c) => c.name === name)

                    if (!comp1 && !comp2) return null

                    return (
                      <div key={name} className="bg-white rounded-lg shadow-sm border p-5">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="text-lg font-semibold text-gray-800">{name}</h3>
                          <div
                            className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 ${
                              comp1 && comp2 && comp1.score > comp2.score
                                ? "bg-green-100 text-green-800"
                                : comp1 && comp2 && comp2.score > comp1.score
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {comp1 && comp2 ? (
                              comp1.score > comp2.score ? (
                                <>
                                  <ArrowUp className="h-4 w-4" />
                                  <span>Website 1 leads by {comp1.score - comp2.score}</span>
                                </>
                              ) : comp2.score > comp1.score ? (
                                <>
                                  <ArrowDown className="h-4 w-4" />
                                  <span>Website 2 leads by {comp2.score - comp1.score}</span>
                                </>
                              ) : (
                                <>
                                  <Minus className="h-4 w-4" />
                                  <span>Equal scores</span>
                                </>
                              )
                            ) : (
                              <span>Incomplete data</span>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Website 1</span>
                              {comp1 ? (
                                <span
                                  className={`text-sm font-bold ${
                                    comp1.score >= 90
                                      ? "text-green-600"
                                      : comp1.score >= 70
                                        ? "text-yellow-600"
                                        : comp1.score >= 50
                                          ? "text-orange-600"
                                          : "text-red-600"
                                  }`}
                                >
                                  {comp1.score}/100
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">N/A</span>
                              )}
                            </div>
                            {comp1 ? (
                              <Progress
                                value={comp1.score}
                                className="h-3 rounded-full"
                                indicatorClassName={`${
                                  comp1.score >= 90
                                    ? "bg-green-500"
                                    : comp1.score >= 70
                                      ? "bg-yellow-500"
                                      : comp1.score >= 50
                                        ? "bg-orange-500"
                                        : "bg-red-500"
                                } rounded-full`}
                              />
                            ) : (
                              <Progress value={0} className="h-3 rounded-full" />
                            )}

                            {comp1 && (
                              <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                                    Top Strength
                                  </h4>
                                  {comp1.strengths.length > 0 ? (
                                    <p className="text-sm flex items-start">
                                      <span className="text-green-500 mr-1">✓</span> {comp1.strengths[0]}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-500">No data</p>
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                                    Top Weakness
                                  </h4>
                                  {comp1.weaknesses.length > 0 ? (
                                    <p className="text-sm flex items-start">
                                      <span className="text-red-500 mr-1">✗</span> {comp1.weaknesses[0]}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-500">No data</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between mb-1">
                              <span className="text-sm font-medium">Website 2</span>
                              {comp2 ? (
                                <span
                                  className={`text-sm font-bold ${
                                    comp2.score >= 90
                                      ? "text-green-600"
                                      : comp2.score >= 70
                                        ? "text-yellow-600"
                                        : comp2.score >= 50
                                          ? "text-orange-600"
                                          : "text-red-600"
                                  }`}
                                >
                                  {comp2.score}/100
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400">N/A</span>
                              )}
                            </div>
                            {comp2 ? (
                              <Progress
                                value={comp2.score}
                                className="h-3 rounded-full"
                                indicatorClassName={`${
                                  comp2.score >= 90
                                    ? "bg-green-500"
                                    : comp2.score >= 70
                                      ? "bg-yellow-500"
                                      : comp2.score >= 50
                                        ? "bg-orange-500"
                                        : "bg-red-500"
                                } rounded-full`}
                              />
                            ) : (
                              <Progress value={0} className="h-3 rounded-full" />
                            )}

                            {comp2 && (
                              <div className="mt-4 grid grid-cols-2 gap-4">
                                <div>
                                  <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                                    Top Strength
                                  </h4>
                                  {comp2.strengths.length > 0 ? (
                                    <p className="text-sm flex items-start">
                                      <span className="text-green-500 mr-1">✓</span> {comp2.strengths[0]}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-500">No data</p>
                                  )}
                                </div>
                                <div>
                                  <h4 className="text-xs uppercase tracking-wider text-gray-500 font-semibold mb-2">
                                    Top Weakness
                                  </h4>
                                  {comp2.weaknesses.length > 0 ? (
                                    <p className="text-sm flex items-start">
                                      <span className="text-red-500 mr-1">✗</span> {comp2.weaknesses[0]}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-gray-500">No data</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Summaries Comparison */}
                {(summaries[0] || summaries[1]) && (
                  <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h2 className="text-2xl font-bold mb-4 text-[#4285F4]">Detailed Summaries</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-[#4285F4] mb-2">Website 1</h3>
                        {summaries[0] ? (
                          <div className="space-y-2">
                            {summaries[0].split("\n").map((sentence, i) => (
                              <p key={i} className="text-sm text-gray-700">
                                {sentence}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No summary available</p>
                        )}
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="font-bold text-[#4285F4] mb-2">Website 2</h3>
                        {summaries[1] ? (
                          <div className="space-y-2">
                            {summaries[1].split("\n").map((sentence, i) => (
                              <p key={i} className="text-sm text-gray-700">
                                {sentence}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No summary available</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


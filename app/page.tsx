"use client"

import { useState, useEffect } from "react"
import { analyzeWebsite } from "../actions/ai-agent"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Info } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

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
                const rationaleRegex = /Rationale:\s*([\s\S]*?)(?=\nStrengths:|\nWeaknesses:|\n\n|$)/i
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
                /Detailed Summary:\s*([\s\S]*?)(?=\n\nSpecific Actionable Items:|\s*$)/i,
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
              <div className="mt-6 space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-[#4285F4]">Overall Score</h2>
                  <p className="text-5xl font-bold text-[#4285F4] mt-2">{overallScores[0] ?? "N/A"}</p>
                </div>

                <Accordion type="multiple" className="w-full">
                  {componentsArray[0].map((component, index) => (
                    <AccordionItem key={component.name} value={`item-${index}`}>
                      <AccordionTrigger className="bg-[#e8f0fe] p-4 rounded-t-lg">
                        <div className="flex justify-between items-center w-full">
                          <h3 className="text-lg font-semibold text-[#4285F4]">{component.name}</h3>
                          <span className="font-bold text-[#4285F4]">{component.score}/100</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="bg-white p-4 rounded-b-lg border border-[#e8f0fe]">
                        <Progress value={component.score} className="h-2 mb-2" />
                        <p className="text-sm text-black mb-4">{component.rationale}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="font-semibold text-[#4285F4] mb-2">Strengths</h4>
                            {component.strengths.length > 0 ? (
                              <ul className="list-disc pl-5 space-y-1">
                                {component.strengths.map((strength, i) => (
                                  <li key={i} className="text-sm">
                                    {strength}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">No strengths data available</p>
                            )}
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#4285F4] mb-2">Weaknesses</h4>
                            {component.weaknesses.length > 0 ? (
                              <ul className="list-disc pl-5 space-y-1">
                                {component.weaknesses.map((weakness, i) => (
                                  <li key={i} className="text-sm">
                                    {weakness}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-gray-500">No weaknesses data available</p>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {summaries[0] && (
                  <div className="mt-6">
                    <h2 className="text-xl font-bold mb-2 text-[#4285F4]">Detailed Summary</h2>
                    <p className="bg-white p-4 rounded-lg text-black border border-[#e8f0fe]">{summaries[0]}</p>
                  </div>
                )}

                {actionableItemsArray[0]?.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-xl font-bold mb-2 text-[#4285F4]">Specific Actionable Items</h2>
                    <ul className="bg-white p-4 rounded-lg text-black border border-[#e8f0fe] space-y-2">
                      {actionableItemsArray[0].map((item, index) => (
                        <li key={index} className="mb-2 flex items-start">
                          <CheckCircle2 className="h-5 w-5 text-[#4285F4] mr-2 mt-0.5" />
                          <span>
                            <span className="font-semibold text-[#4285F4]">{item.category}:</span>{" "}
                            <span className="text-black font-normal">{item.action}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {activeUrlCount === 2 && (componentsArray[0]?.length > 0 || componentsArray[1]?.length > 0) && (
              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Overall Scores Comparison */}
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-[#4285F4]">Website 1 Score</h2>
                    <p className="text-4xl font-bold text-[#4285F4] mt-2">{overallScores[0] ?? "N/A"}</p>
                    <p className="text-sm text-gray-500 mt-1">{urls[0]}</p>
                  </div>
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-[#4285F4]">Website 2 Score</h2>
                    <p className="text-4xl font-bold text-[#4285F4] mt-2">{overallScores[1] ?? "N/A"}</p>
                    <p className="text-sm text-gray-500 mt-1">{urls[1]}</p>
                  </div>
                </div>

                {/* Component Comparison */}
                <h2 className="text-2xl font-bold text-[#4285F4] mt-8 mb-4">Component Comparison</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-[#e8f0fe]">
                        <th className="p-3 text-left">Component</th>
                        <th className="p-3 text-center">Website 1 Score</th>
                        <th className="p-3 text-center">Website 2 Score</th>
                        <th className="p-3 text-center">Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {componentNames.map((name) => {
                        const comp1 = componentsArray[0]?.find((c) => c.name === name)
                        const comp2 = componentsArray[1]?.find((c) => c.name === name)
                        const score1 = comp1?.score
                        const score2 = comp2?.score
                        const diff = score1 !== undefined && score2 !== undefined ? score1 - score2 : null

                        return (
                          <tr key={name} className="border-b border-gray-200">
                            <td className="p-3 font-medium">{name}</td>
                            <td className="p-3 text-center">{score1 ?? "N/A"}</td>
                            <td className="p-3 text-center">{score2 ?? "N/A"}</td>
                            <td
                              className={`p-3 text-center font-bold ${
                                diff !== null
                                  ? diff > 0
                                    ? "text-green-600"
                                    : diff < 0
                                      ? "text-red-600"
                                      : "text-gray-500"
                                  : ""
                              }`}
                            >
                              {diff !== null ? (diff > 0 ? "+" : "") + diff : "N/A"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Detailed Component Comparison */}
                <h2 className="text-2xl font-bold text-[#4285F4] mt-8 mb-4">Detailed Component Analysis</h2>
                <Accordion type="multiple" className="w-full">
                  {componentNames.map((name, idx) => {
                    const comp1 = componentsArray[0]?.find((c) => c.name === name)
                    const comp2 = componentsArray[1]?.find((c) => c.name === name)

                    return (
                      <AccordionItem key={name} value={`comp-${idx}`}>
                        <AccordionTrigger className="bg-[#e8f0fe] p-4 rounded-t-lg">
                          <div className="flex justify-between items-center w-full">
                            <h3 className="text-lg font-semibold text-[#4285F4]">{name}</h3>
                            <div className="flex space-x-4">
                              <span className="font-bold text-[#4285F4]">Site 1: {comp1?.score ?? "N/A"}</span>
                              <span className="font-bold text-[#4285F4]">Site 2: {comp2?.score ?? "N/A"}</span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="bg-white p-4 rounded-b-lg border border-[#e8f0fe]">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Website 1 */}
                            <div className="border p-4 rounded-lg">
                              <h4 className="font-bold text-[#4285F4] mb-2">Website 1</h4>
                              {comp1 ? (
                                <>
                                  <Progress value={comp1.score} className="h-2 mb-2" />
                                  <p className="text-sm text-black mb-4">{comp1.rationale}</p>
                                  <div className="space-y-4">
                                    <div>
                                      <h5 className="font-semibold text-[#4285F4] mb-2">Strengths</h5>
                                      {comp1.strengths.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1">
                                          {comp1.strengths.map((strength, i) => (
                                            <li key={i} className="text-sm">
                                              {strength}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-sm text-gray-500">No strengths data available</p>
                                      )}
                                    </div>
                                    <div>
                                      <h5 className="font-semibold text-[#4285F4] mb-2">Weaknesses</h5>
                                      {comp1.weaknesses.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1">
                                          {comp1.weaknesses.map((weakness, i) => (
                                            <li key={i} className="text-sm">
                                              {weakness}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-sm text-gray-500">No weaknesses data available</p>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-gray-500">No data available</p>
                              )}
                            </div>

                            {/* Website 2 */}
                            <div className="border p-4 rounded-lg">
                              <h4 className="font-bold text-[#4285F4] mb-2">Website 2</h4>
                              {comp2 ? (
                                <>
                                  <Progress value={comp2.score} className="h-2 mb-2" />
                                  <p className="text-sm text-black mb-4">{comp2.rationale}</p>
                                  <div className="space-y-4">
                                    <div>
                                      <h5 className="font-semibold text-[#4285F4] mb-2">Strengths</h5>
                                      {comp2.strengths.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1">
                                          {comp2.strengths.map((strength, i) => (
                                            <li key={i} className="text-sm">
                                              {strength}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-sm text-gray-500">No strengths data available</p>
                                      )}
                                    </div>
                                    <div>
                                      <h5 className="font-semibold text-[#4285F4] mb-2">Weaknesses</h5>
                                      {comp2.weaknesses.length > 0 ? (
                                        <ul className="list-disc pl-5 space-y-1">
                                          {comp2.weaknesses.map((weakness, i) => (
                                            <li key={i} className="text-sm">
                                              {weakness}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p className="text-sm text-gray-500">No weaknesses data available</p>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-gray-500">No data available</p>
                              )}
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>

                {/* Summaries Comparison */}
                {(summaries[0] || summaries[1]) && (
                  <div className="mt-6">
                    <h2 className="text-2xl font-bold mb-4 text-[#4285F4]">Detailed Summaries</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded-lg text-black border border-[#e8f0fe]">
                        <h3 className="font-bold text-[#4285F4] mb-2">Website 1</h3>
                        {summaries[0] ? summaries[0] : "No summary available"}
                      </div>
                      <div className="bg-white p-4 rounded-lg text-black border border-[#e8f0fe]">
                        <h3 className="font-bold text-[#4285F4] mb-2">Website 2</h3>
                        {summaries[1] ? summaries[1] : "No summary available"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Actionable Items Comparison */}
                {(actionableItemsArray[0]?.length > 0 || actionableItemsArray[1]?.length > 0) && (
                  <div className="mt-6">
                    <h2 className="text-2xl font-bold mb-4 text-[#4285F4]">Specific Actionable Items</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded-lg text-black border border-[#e8f0fe]">
                        <h3 className="font-bold text-[#4285F4] mb-2">Website 1</h3>
                        {actionableItemsArray[0]?.length > 0 ? (
                          <ul className="space-y-2">
                            {actionableItemsArray[0].map((item, index) => (
                              <li key={index} className="mb-2 flex items-start">
                                <CheckCircle2 className="h-5 w-5 text-[#4285F4] mr-2 mt-0.5" />
                                <span>
                                  <span className="font-semibold text-[#4285F4]">{item.category}:</span>{" "}
                                  <span className="text-black font-normal">{item.action}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">No actionable items available</p>
                        )}
                      </div>
                      <div className="bg-white p-4 rounded-lg text-black border border-[#e8f0fe]">
                        <h3 className="font-bold text-[#4285F4] mb-2">Website 2</h3>
                        {actionableItemsArray[1]?.length > 0 ? (
                          <ul className="space-y-2">
                            {actionableItemsArray[1].map((item, index) => (
                              <li key={index} className="mb-2 flex items-start">
                                <CheckCircle2 className="h-5 w-5 text-[#4285F4] mr-2 mt-0.5" />
                                <span>
                                  <span className="font-semibold text-[#4285F4]">{item.category}:</span>{" "}
                                  <span className="text-black font-normal">{item.action}</span>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500">No actionable items available</p>
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
"use client"

import { useState } from "react"
import { analyzeWebsite } from "../actions/ai-agent"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
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
  const [url, setUrl] = useState("")
  const [overallScore, setOverallScore] = useState(0)
  const [components, setComponents] = useState<AnalysisComponent[]>([])
  const [summary, setSummary] = useState("")
  const [actionableItems, setActionableItems] = useState<ActionableItem[]>([])
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [analysisAttempts, setAnalysisAttempts] = useState(0)

  const handleAnalysis = async () => {
    if (!url) {
      setError("Please enter a website URL")
      return
    }

    setIsLoading(true)
    setError("")
    setOverallScore(0)
    setComponents([])
    setSummary("")
    setActionableItems([])

    try {
      console.log("Starting analysis for URL:", url)
      const result = await analyzeWebsite(url)
      console.log("Analysis result received:", result)

      if (result.startsWith("An error occurred")) {
        setError(result)
      } else if (!result || result.trim() === "") {
        setError("The analysis returned no results. Please try again.")
      } else {
        const componentResults: AnalysisComponent[] = []
        componentNames.forEach((name) => {
          const componentMatch = result.match(
            new RegExp(`${name}: (\\d+)/100\nRationale: ([\\s\\S]*?)(?=\nStrengths:)`),
          )
          const strengthsMatch = result.match(new RegExp(`${name}: \\d+/100[\\s\\S]*?Strengths:\n((?:• .*\n){3})`))
          const weaknessesMatch = result.match(new RegExp(`${name}: \\d+/100[\\s\\S]*?Weaknesses:\n((?:• .*\n){3})`))
          if (componentMatch && strengthsMatch && weaknessesMatch) {
            componentResults.push({
              name,
              score: Number.parseInt(componentMatch[1]),
              rationale: componentMatch[2].trim(),
              strengths: strengthsMatch[1]
                .split("\n")
                .map((s) => s.trim())
                .filter((s) => s.startsWith("•"))
                .map((s) => s.substring(1).trim()),
              weaknesses: weaknessesMatch[1]
                .split("\n")
                .map((s) => s.trim())
                .filter((s) => s.startsWith("•"))
                .map((s) => s.substring(1).trim()),
            })
          }
        })

        if (componentResults.length === 0) {
          setError("Unable to parse the analysis results. Please try again.")
        } else {
          setComponents(componentResults)

          // Calculate the overall score as the average of component scores
          const totalScore = componentResults.reduce((sum, component) => sum + component.score, 0)
          const calculatedOverallScore = Math.round(totalScore / componentResults.length)
          setOverallScore(calculatedOverallScore)

          const summaryMatch = result.match(/Detailed Summary:\n([\s\S]*?)(?=\n\nSpecific Actionable Items:)/)
          if (summaryMatch) {
            setSummary(summaryMatch[1].trim())
          }

          const actionableItemsMatch = result.match(/Specific Actionable Items:\n([\s\S]*?)$/)
          if (actionableItemsMatch) {
            const items = actionableItemsMatch[1]
              .split("\n")
              .map((item) => item.trim())
              .filter((item) => item.startsWith("•"))
              .map((item) => {
                const [category, action] = item
                  .substring(1)
                  .split(":")
                  .map((s) => s.trim())
                return { category, action }
              })
            setActionableItems(items)
          }
        }
      }
    } catch (error) {
      console.error("Error during analysis:", error)
      setError(
        `An unexpected error occurred while analyzing the website: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#e8f0fe]">
      <div className="container mx-auto p-4">
        <Card className="bg-white shadow-lg">
          <CardHeader className="bg-[#4285F4]">
            <CardTitle className="text-2xl font-bold text-white">Website Analyzer</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter website URL (e.g., https://example.com)"
                className="flex-grow"
              />
              <Button
                onClick={() => {
                  setAnalysisAttempts((prev) => prev + 1)
                  handleAnalysis()
                }}
                disabled={isLoading}
                className="whitespace-nowrap bg-[#4285F4] hover:bg-[#3367D6] text-white"
              >
                {isLoading ? "Analyzing..." : `Analyze Website (Attempt ${analysisAttempts + 1})`}
              </Button>
            </div>

            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  {error}
                  {error === "The analysis returned no results. Please try again." && (
                    <p className="mt-2">
                      Sometimes the analysis may fail due to temporary issues. Please try clicking the "Analyze Website"
                      button again.
                    </p>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {isLoading && (
              <Alert className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Analyzing</AlertTitle>
                <AlertDescription>Please wait while we analyze the website...</AlertDescription>
              </Alert>
            )}

            {components.length > 0 && (
              <div className="mt-6 space-y-6">
                <div className="text-center">
                  <h2 className="text-3xl font-bold text-[#4285F4]">Overall Score</h2>
                  <p className="text-5xl font-bold text-[#4285F4] mt-2">{overallScore}</p>
                </div>

                <Accordion type="multiple" className="w-full">
                  {components.map((component, index) => (
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
                            <ul className="list-disc pl-5 space-y-1">
                              {component.strengths.map((strength, i) => (
                                <li key={i} className="text-sm">
                                  {strength}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#4285F4] mb-2">Weaknesses</h4>
                            <ul className="list-disc pl-5 space-y-1">
                              {component.weaknesses.map((weakness, i) => (
                                <li key={i} className="text-sm">
                                  {weakness}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>

                {summary && (
                  <div className="mt-6">
                    <h2 className="text-xl font-bold mb-2 text-[#4285F4]">Detailed Summary</h2>
                    <p className="bg-white p-4 rounded-lg text-black border border-[#e8f0fe]">{summary}</p>
                  </div>
                )}

                {actionableItems.length > 0 && (
                  <div className="mt-6">
                    <h2 className="text-xl font-bold mb-2 text-[#4285F4]">Specific Actionable Items</h2>
                    <ul className="bg-white p-4 rounded-lg text-black border border-[#e8f0fe] space-y-2">
                      {actionableItems.map((item, index) => (
                        <li key={index} className="mb-2">
                          <span className="font-semibold text-[#4285F4]">{item.category}:</span>{" "}
                          <span className="text-black font-normal">{item.action}</span>
                        </li>
                      ))}
                    </ul>
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


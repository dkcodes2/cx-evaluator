import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ExternalLink, CheckCircle, XCircle, Lightbulb } from "lucide-react"
import { CircularProgress } from "@/components/ui/circular-progress"

interface Recommendation {
  suggestion: string
  reasoning: string
  referenceWebsite: {
    name: string
    url: string
    description: string
  }
}

interface PageAnalysisProps {
  pageUrl: string
  pageType: string
  score: number
  scoreReasoning: string
  strengths: string[]
  weaknesses: string[]
  recommendations: Recommendation[]
}

export function PageAnalysis({
  pageUrl,
  pageType,
  score,
  scoreReasoning,
  strengths,
  weaknesses,
  recommendations,
}: PageAnalysisProps) {
  // Make sure we have at least some data to display
  const hasValidData =
    score > 0 ||
    scoreReasoning !== "This page type was not found in the analysis." ||
    (strengths.length > 0 && strengths[0] !== "No data available for this page type") ||
    (weaknesses.length > 0 && weaknesses[0] !== "No data available for this page type")

  return (
    <Card className="w-full">
      <CardHeader className="bg-[#f5f9ff] border-b">
        <div className="flex justify-between items-center">
          <div>
            <Badge variant="outline" className="mb-2">
              {pageType}
            </Badge>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              {pageUrl}
              {pageUrl && pageUrl !== "Not found" && (
                <a
                  href={pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </CardTitle>
          </div>
          <div className="text-center">
            <CircularProgress value={score} size={60} strokeWidth={6} className="mb-2" />
            <p className="text-sm font-medium">Score</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        {!hasValidData ? (
          <div className="text-center p-4">
            <p className="text-gray-500">No analysis data available for this page type.</p>
            {pageUrl === "Not found" && (
              <p className="text-gray-500 mt-2">This page type was not found on the website.</p>
            )}
          </div>
        ) : (
          <Tabs defaultValue="overview">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="strengths">Strengths</TabsTrigger>
              <TabsTrigger value="weaknesses">Weaknesses</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-medium mb-2">Score Reasoning</h3>
                {scoreReasoning && scoreReasoning !== "No data available for this page type" ? (
                  <div className="space-y-2">
                    {scoreReasoning.split("\n").map((paragraph, idx) => (
                      <p key={idx} className="text-gray-700">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">-</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="strengths">
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-medium mb-4">Strengths</h3>
                {strengths.length > 0 && strengths[0] !== "No data available for this page type" ? (
                  <ul className="space-y-2">
                    {strengths.map((strength, index) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">-</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="weaknesses">
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-medium mb-4">Weaknesses</h3>
                {weaknesses.length > 0 && weaknesses[0] !== "No data available for this page type" ? (
                  <ul className="space-y-2">
                    {weaknesses.map((weakness, index) => (
                      <li key={index} className="flex items-start">
                        <XCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">-</p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="recommendations">
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-medium mb-4">Recommendations</h3>
                {recommendations.length > 0 &&
                recommendations[0].suggestion !== "No recommendations provided" &&
                recommendations[0].suggestion !== "Try analyzing the website again" ? (
                  <ul className="space-y-6">
                    {recommendations.map((rec, index) => (
                      <li key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
                        <div className="flex items-start mb-2">
                          <Lightbulb className="h-5 w-5 text-yellow-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="font-medium">{rec.suggestion}</span>
                        </div>
                        {rec.reasoning && <p className="text-gray-700 mb-2">{rec.reasoning}</p>}
                        {rec.referenceWebsite && rec.referenceWebsite.name && (
                          <div className="bg-gray-100 p-3 rounded-lg">
                            <p className="font-medium mb-1">Reference: {rec.referenceWebsite.name}</p>
                            {rec.referenceWebsite.url && (
                              <a
                                href={rec.referenceWebsite.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 flex items-center"
                              >
                                {rec.referenceWebsite.url}
                                <ExternalLink className="h-4 w-4 ml-1" />
                              </a>
                            )}
                            {rec.referenceWebsite.description && (
                              <p className="text-sm text-gray-600 mt-1">{rec.referenceWebsite.description}</p>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">-</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}


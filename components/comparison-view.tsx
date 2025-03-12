import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ArrowDown, ArrowUp, Minus } from "lucide-react"

interface ComparisonViewProps {
  componentName: string
  site1Score: number
  site2Score: number
  site1Name: string
  site2Name: string
  description?: string
}

export function ComparisonView({
  componentName,
  site1Score,
  site2Score,
  site1Name,
  site2Name,
  description,
}: ComparisonViewProps) {
  const difference = site1Score - site2Score

  const getProgressColor = (score: number) => {
    if (score >= 90) return "bg-green-500"
    if (score >= 70) return "bg-yellow-500"
    if (score >= 50) return "bg-orange-500"
    return "bg-red-500"
  }

  return (
    <div className="space-y-4 bg-white p-5 rounded-lg border shadow-sm">
      <div className="flex justify-between items-center">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <h3 className="text-lg font-semibold text-gray-800 cursor-help">{componentName}</h3>
            </TooltipTrigger>
            {description && (
              <TooltipContent className="max-w-xs">
                <p>{description}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
        
        <div className="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100">
          {difference !== 0 && (
            difference > 0 ? (
              <ArrowUp className="h-4 w-4 text-green-600" />
            ) : (
              <ArrowDown className="h-4 w-4 text-red-600" />
            )
          ) : (
            <Minus className="h-4 w-4 text-gray-500" />
          )}
          <span className={
            difference > 0 
              ? "text-green-600" 
              : difference < 0 
                ? "text-red-600" 
                : "text-gray-600"
          }>
            {difference > 0
              ? `${site1Name} leads by ${difference}`
              : difference < 0
                ? `${site2Name} leads by ${Math.abs(difference)}`
                : "Equal scores"}
          </span>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">{site1Name}</span>
            <span className={`text-sm font-bold ${
              site1Score >= 90 ? "text-green-600" : 
              site1Score >= 70 ? "text-yellow-600" : 
              site1Score >= 50 ? "text-orange-600" : 
              "text-red-600"
            }`}>{site1Score}/100</span>
          </div>
          <Progress 
            value={site1Score} 
            className="h-3 rounded-full" 
            indicatorClassName={`${getProgressColor(site1Score)} rounded-full`}
          />
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">{site2Name}</span>
            <span className={`text-sm font-bold ${
              site2Score >= 90 ? "text-green-600" : 
              site2Score >= 70 ? "text-yellow-600" : 
              site2Score >= 50 ? "text-orange-600" : 
              "text-red-600"
            }`}>{site2Score}/100</span>
          </div>
          <Progress 
            value={site2Score} 
            className="h-3 rounded-full" 
            indicatorClassName={`${getProgressColor(site2Score)} rounded-full`}
          />
        </div>
      </div>
    </div>
  )
}


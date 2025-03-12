import { Progress } from "@/components/ui/progress"

interface ComparisonViewProps {
  componentName: string
  site1Score: number
  site2Score: number
  site1Name: string
  site2Name: string
}

export function ComparisonView({ componentName, site1Score, site2Score, site1Name, site2Name }: ComparisonViewProps) {
  const difference = site1Score - site2Score

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{componentName}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">{site1Name}</span>
            <span className="text-sm font-bold">{site1Score}/100</span>
          </div>
          <Progress value={site1Score} className="h-2" />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">{site2Name}</span>
            <span className="text-sm font-bold">{site2Score}/100</span>
          </div>
          <Progress value={site2Score} className="h-2" />
        </div>
      </div>
      <div className="flex justify-center">
        <div
          className={`px-3 py-1 rounded-full text-sm font-medium ${
            difference > 0
              ? "bg-green-100 text-green-800"
              : difference < 0
                ? "bg-red-100 text-red-800"
                : "bg-gray-100 text-gray-800"
          }`}
        >
          {difference > 0
            ? `${site1Name} leads by ${difference}`
            : difference < 0
              ? `${site2Name} leads by ${Math.abs(difference)}`
              : "Equal scores"}
        </div>
      </div>
    </div>
  )
}
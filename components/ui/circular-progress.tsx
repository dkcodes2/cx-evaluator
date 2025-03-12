import * as React from "react"

interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
}

export const CircularProgress = React.forwardRef<HTMLDivElement, CircularProgressProps>(
  ({ value, size = 120, strokeWidth = 10, className = "" }, ref) => {
    const radius = (size - strokeWidth) / 2
    const circumference = radius * 2 * Math.PI
    const offset = circumference - (value / 100) * circumference

    const getColor = (value: number) => {
      if (value >= 90) return "text-green-500"
      if (value >= 50) return "text-yellow-500"
      return "text-red-500"
    }

    return (
      <div ref={ref} className={`relative inline-flex items-center justify-center ${className}`}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            className="text-gray-200"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          <circle
            className={getColor(value)}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <span className="absolute text-2xl font-bold">{Math.round(value)}</span>
      </div>
    )
  },
)

CircularProgress.displayName = "CircularProgress"


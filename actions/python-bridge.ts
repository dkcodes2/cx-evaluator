"use server"

import { spawn } from "child_process"
import path from "path"

// Helper function to execute Python script
async function executePythonScript(data: any): Promise<string> {
  return new Promise((resolve, reject) => {
    // Get the absolute path to the Python script
    const scriptPath = path.join(process.cwd(), "python", "ai_processor.py")

    // Spawn Python process
    const pythonProcess = spawn("python", [scriptPath])

    let result = ""
    let errorOutput = ""

    // Collect data from stdout
    pythonProcess.stdout.on("data", (data) => {
      result += data.toString()
    })

    // Collect error data from stderr
    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString()
    })

    // Handle process completion
    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error(`Python process exited with code ${code}`)
        console.error(`Error output: ${errorOutput}`)
        reject(new Error(`Python process failed with code ${code}: ${errorOutput}`))
      } else {
        resolve(result)
      }
    })

    // Send data to the Python script
    pythonProcess.stdin.write(JSON.stringify(data))
    pythonProcess.stdin.end()
  })
}

// Function to call Python for website analysis
export async function callPythonAnalyzeWebsite(contentForAnalysis: string): Promise<string> {
  try {
    const data = {
      command: "analyze_website",
      content: contentForAnalysis,
    }

    return await executePythonScript(data)
  } catch (error) {
    console.error("Error calling Python for website analysis:", error)
    return JSON.stringify({
      error: "PYTHON_EXECUTION_ERROR",
      message: "Failed to execute Python script for website analysis",
      details: error instanceof Error ? error.message : String(error),
    })
  }
}

// Function to call Python for page analysis
export async function callPythonGeneratePageAnalysis(
  url: string,
  actualPageUrls: Record<string, string | null>,
): Promise<string> {
  try {
    const data = {
      command: "generate_page_analysis",
      url,
      actualPageUrls,
    }

    return await executePythonScript(data)
  } catch (error) {
    console.error("Error calling Python for page analysis:", error)
    return JSON.stringify({
      error: "PYTHON_EXECUTION_ERROR",
      message: "Failed to execute Python script for page analysis",
      details: error instanceof Error ? error.message : String(error),
    })
  }
}


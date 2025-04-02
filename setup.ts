import { spawn } from "child_process"
import path from "path"
import fs from "fs"

async function setupPythonEnvironment() {
  console.log("Setting up Python environment...")

  const pythonDir = path.join(process.cwd(), "python")

  // Check if python directory exists
  if (!fs.existsSync(pythonDir)) {
    console.log("Creating python directory...")
    fs.mkdirSync(pythonDir)
  }

  // Check if requirements.txt exists
  const requirementsPath = path.join(pythonDir, "requirements.txt")
  if (!fs.existsSync(requirementsPath)) {
    console.error("requirements.txt not found in python directory!")
    process.exit(1)
  }

  // Install Python dependencies
  console.log("Installing Python dependencies...")
  const pipProcess = spawn("pip", ["install", "-r", requirementsPath])

  pipProcess.stdout.on("data", (data) => {
    console.log(data.toString())
  })

  pipProcess.stderr.on("data", (data) => {
    console.error(data.toString())
  })

  return new Promise<void>((resolve, reject) => {
    pipProcess.on("close", (code) => {
      if (code === 0) {
        console.log("Python dependencies installed successfully!")
        resolve()
      } else {
        console.error(`Failed to install Python dependencies. Exit code: ${code}`)
        reject(new Error(`pip install failed with code ${code}`))
      }
    })
  })
}

// Run the setup
setupPythonEnvironment()
  .then(() => {
    console.log("Setup completed successfully!")
  })
  .catch((error) => {
    console.error("Setup failed:", error)
    process.exit(1)
  })


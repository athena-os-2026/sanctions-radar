import { writeFile, mkdir, readFile } from "fs/promises"

const API_URL = "https://cpw-tracker.p.rapidapi.com/"
const API_KEY = process.env.RAPIDAPI_KEY

if (!API_KEY) {
  console.error("Error: RAPIDAPI_KEY environment variable is required")
  process.exit(1)
}

/**
 * Get start and end dates for data fetch (last 7 days)
 */
function getDateRange() {
  const now = new Date()
  const endTime = now
  const startTime = new Date(now)
  startTime.setDate(startTime.getDate() - 7)
  return {
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString()
  }
}

/**
 * Fetch data from the CPW API for multiple query configurations
 */
async function fetchData() {
  const { startTime, endTime } = getDateRange()
  
  const queries = [
    { entities: "cryptocurrency exchanges", topic: "sanctions" },
    { entities: "cryptocurrency services", topic: "regulatory enforcement" },
    { entities: "DeFi protocols", topic: "sanctions evasion" },
    { entities: "cryptocurrency mixers", topic: "money laundering" },
  ]

  console.log(`Fetching data for period: ${startTime} to ${endTime}`)
  
  const allResults = []

  for (const query of queries) {
    try {
      console.log(`Querying: ${query.entities} + ${query.topic}`)
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-rapidapi-host": "cpw-tracker.p.rapidapi.com",
          "x-rapidapi-key": API_KEY,
        },
        body: JSON.stringify({
          entities: query.entities,
          topic: query.topic,
          startTime,
          endTime
        }),
      })

      if (!response.ok) {
        console.warn(`API request failed for ${query.topic}: ${response.status}`)
        continue
      }

      const data = await response.json()
      const results = Array.isArray(data) ? data : []
      
      // Tag results with their query category
      results.forEach(r => {
        r._category = query.topic
        r._entities = query.entities
      })
      
      allResults.push(...results)
      console.log(`  Found ${results.length} results`)
    } catch (err) {
      console.warn(`Error fetching ${query.topic}: ${err.message}`)
    }
  }

  return allResults
}

/**
 * Save data to JSON file
 */
async function saveData(data) {
  const sorted = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  
  // Deduplicate by URL
  const seen = new Set()
  const unique = sorted.filter(item => {
    const key = item.url || JSON.stringify(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  await mkdir("data", { recursive: true })
  await writeFile("data/events.json", JSON.stringify(unique, null, 2))

  console.log(`Saved ${unique.length} unique items to data/events.json`)
}

async function updateData() {
  try {
    const data = await fetchData()
    await saveData(data)
    console.log("Update completed successfully")
  } catch (error) {
    console.error("Update failed:", error.message)
    process.exit(1)
  }
}

updateData()

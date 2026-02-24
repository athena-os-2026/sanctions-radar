import { writeFile, mkdir, readFile } from "fs/promises"

const API_URL = "https://cpw-tracker.p.rapidapi.com/"
const API_KEY = process.env.RAPIDAPI_KEY

if (!API_KEY) {
  console.error("Error: RAPIDAPI_KEY environment variable is required")
  process.exit(1)
}

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
 * Expanded threat monitoring across 8 crypto threat categories
 */
async function fetchData() {
  const { startTime, endTime } = getDateRange()
  
  const queries = [
    // Sanctions & Regulatory
    { entities: "cryptocurrency exchanges", topic: "sanctions", category: "sanctions", severity: "critical" },
    { entities: "cryptocurrency services", topic: "regulatory enforcement", category: "regulatory", severity: "high" },
    { entities: "DeFi protocols", topic: "sanctions evasion", category: "sanctions-evasion", severity: "critical" },
    { entities: "cryptocurrency mixers", topic: "money laundering", category: "money-laundering", severity: "critical" },
    // Cyber Threats
    { entities: "cryptocurrency exchanges", topic: "cyberattack", category: "cyberattack", severity: "critical" },
    { entities: "DeFi protocols", topic: "exploit", category: "exploit", severity: "critical" },
    { entities: "cryptocurrency projects", topic: "rug pull", category: "rug-pull", severity: "high" },
    // Market Manipulation
    { entities: "cryptocurrency exchanges", topic: "wash trading", category: "wash-trading", severity: "high" },
    { entities: "cryptocurrency markets", topic: "market manipulation", category: "market-manipulation", severity: "high" },
    // Fraud & Scams
    { entities: "cryptocurrency", topic: "fraud", category: "fraud", severity: "high" },
    { entities: "cryptocurrency", topic: "phishing attack", category: "phishing", severity: "medium" },
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
      
      results.forEach(r => {
        r._category = query.category
        r._severity = query.severity
        r._entities = query.entities
        r._topic = query.topic
      })
      
      allResults.push(...results)
      console.log(`  Found ${results.length} results`)
    } catch (err) {
      console.warn(`Error fetching ${query.topic}: ${err.message}`)
    }
  }

  return allResults
}

async function saveData(data) {
  const sorted = data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  
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

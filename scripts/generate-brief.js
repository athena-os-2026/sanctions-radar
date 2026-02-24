import { readFile, writeFile, mkdir } from "fs/promises"

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

/**
 * Generate an AI-powered intelligence brief from event data using GitHub Models
 */
async function generateBrief() {
  let events = []
  
  try {
    const raw = await readFile("data/events.json", "utf-8")
    events = JSON.parse(raw)
  } catch {
    console.log("No event data found, generating placeholder brief")
  }

  const dateStr = new Date().toISOString().split("T")[0]
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]

  // Build event summary for the AI
  let eventSummary = "No events detected this period."
  if (events.length > 0) {
    const byCategory = {}
    events.forEach(e => {
      const cat = e._category || "general"
      if (!byCategory[cat]) byCategory[cat] = []
      byCategory[cat].push(e)
    })
    
    eventSummary = Object.entries(byCategory).map(([cat, items]) => {
      const summaries = items.slice(0, 5).map(i => {
        const title = i.title || i.text || "Untitled"
        const source = i.source || "Unknown"
        const ts = i.timestamp ? new Date(i.timestamp).toLocaleDateString() : ""
        return `  - [${source}] ${title} (${ts})`
      }).join("\n")
      return `${cat} (${items.length} signals):\n${summaries}`
    }).join("\n\n")
  }

  const prompt = `You are a crypto compliance intelligence analyst. Generate a concise weekly intelligence brief about cryptocurrency sanctions enforcement and regulatory compliance risks.

Period: ${weekAgo} to ${dateStr}

Detected signals:
${eventSummary}

Write a professional intelligence brief in HTML format (just the content, no html/head/body tags) with these sections:
1. Executive Summary (2-3 sentences)
2. Key Developments (bullet points of most significant events)
3. Regulatory Landscape (which jurisdictions are active)
4. Risk Assessment (HIGH/MEDIUM/LOW with brief explanation)
5. Recommended Actions for compliance teams

Use <h3> for section headers. Keep it concise and actionable. If no events were detected, provide general market intelligence about the current crypto sanctions landscape based on your training data.`

  let briefHtml = ""

  if (GITHUB_TOKEN) {
    try {
      console.log("Generating AI brief via GitHub Models...")
      const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GITHUB_TOKEN}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a cryptocurrency compliance intelligence analyst. Output clean HTML content only." },
            { role: "user", content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      })

      if (response.ok) {
        const data = await response.json()
        briefHtml = data.choices?.[0]?.message?.content || ""
        // Strip markdown code fences if present
        briefHtml = briefHtml.replace(/```html?\n?/g, "").replace(/```\n?/g, "").trim()
        console.log("AI brief generated successfully")
      } else {
        console.warn(`GitHub Models API returned ${response.status}`)
      }
    } catch (err) {
      console.warn("AI generation failed:", err.message)
    }
  }

  if (!briefHtml) {
    briefHtml = generateFallbackBrief(events, weekAgo, dateStr)
  }

  // Generate the full page
  const html = buildPage(briefHtml, events, weekAgo, dateStr)
  
  await writeFile("index.html", html)
  console.log("Generated index.html")

  // Also save the brief data
  await mkdir("data", { recursive: true })
  await writeFile("data/latest-brief.json", JSON.stringify({
    generated: new Date().toISOString(),
    period: { start: weekAgo, end: dateStr },
    eventCount: events.length,
    briefHtml
  }, null, 2))
}

function generateFallbackBrief(events, weekAgo, dateStr) {
  const count = events.length
  return `
    <h3>Executive Summary</h3>
    <p>During the period ${weekAgo} to ${dateStr}, Sanctions Radar detected <strong>${count}</strong> signals 
    related to cryptocurrency sanctions enforcement and regulatory compliance across monitored entities. 
    ${count > 0 ? "Several developments warrant attention from compliance teams." : "The monitoring period was relatively quiet with no major enforcement actions detected."}</p>
    
    <h3>Key Developments</h3>
    ${count > 0 ? `<ul>${events.slice(0, 8).map(e => `<li><strong>${e._category || "General"}</strong>: ${e.title || e.text || "Signal detected"} <span class="source">(${e.source || "CPW"})</span></li>`).join("")}</ul>` : "<p>No significant developments detected during this period. Continue standard monitoring procedures.</p>"}
    
    <h3>Regulatory Landscape</h3>
    <p>Active monitoring continues across OFAC (US), EU sanctions frameworks, and FATF guidance implementation. 
    Cryptocurrency mixers and privacy protocols remain under heightened scrutiny.</p>
    
    <h3>Risk Assessment</h3>
    <p class="risk-badge risk-${count > 10 ? "high" : count > 3 ? "medium" : "low"}">${count > 10 ? "HIGH" : count > 3 ? "MEDIUM" : "LOW"}</p>
    <p>${count > 10 ? "Elevated enforcement activity detected. Immediate review recommended." : count > 3 ? "Moderate activity detected. Standard review procedures apply." : "Low activity period. Maintain baseline monitoring."}</p>
    
    <h3>Recommended Actions</h3>
    <ul>
      <li>Review counterparty screening lists for recent additions</li>
      <li>Verify transaction monitoring rules cover flagged entity types</li>
      <li>Update internal sanctions lists with any newly designated entities</li>
      <li>Brief compliance team on emerging regulatory trends</li>
    </ul>`
}

function buildPage(briefHtml, events, weekAgo, dateStr) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sanctions Radar - Crypto Compliance Intelligence</title>
  <style>
    :root {
      --bg: #0a0e17;
      --surface: #131a2b;
      --border: #1e2a42;
      --text: #c8d6e5;
      --heading: #f0f4f8;
      --accent: #4fc3f7;
      --accent2: #7c4dff;
      --danger: #ff5252;
      --warning: #ffa726;
      --success: #66bb6a;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
      min-height: 100vh;
    }
    .container { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; }
    
    header {
      text-align: center;
      padding: 3rem 0 2rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
    }
    .logo {
      font-size: 2.5rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }
    .subtitle {
      color: var(--text);
      font-size: 1rem;
      margin-top: 0.5rem;
      opacity: 0.7;
    }
    .period {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.4rem 1rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.85rem;
      color: var(--accent);
    }
    .stats {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 1.5rem;
      flex-wrap: wrap;
    }
    .stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.5rem;
      text-align: center;
      min-width: 140px;
    }
    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: var(--accent);
    }
    .stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.6;
    }

    .brief {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 2rem;
      margin: 2rem 0;
    }
    .brief h3 {
      color: var(--heading);
      font-size: 1.15rem;
      margin: 1.5rem 0 0.75rem;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--border);
    }
    .brief h3:first-child { margin-top: 0; }
    .brief ul { padding-left: 1.5rem; }
    .brief li { margin: 0.4rem 0; }
    .brief strong { color: var(--heading); }
    .brief .source { color: var(--accent); font-size: 0.85rem; }
    
    .risk-badge {
      display: inline-block;
      padding: 0.3rem 1rem;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.9rem;
      letter-spacing: 0.05em;
    }
    .risk-high { background: rgba(255,82,82,0.15); color: var(--danger); border: 1px solid var(--danger); }
    .risk-medium { background: rgba(255,167,38,0.15); color: var(--warning); border: 1px solid var(--warning); }
    .risk-low { background: rgba(102,187,106,0.15); color: var(--success); border: 1px solid var(--success); }

    .events-section {
      margin: 2rem 0;
    }
    .events-section h2 {
      color: var(--heading);
      font-size: 1.3rem;
      margin-bottom: 1rem;
    }
    .event-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1rem 1.25rem;
      margin-bottom: 0.75rem;
      transition: border-color 0.2s;
    }
    .event-card:hover { border-color: var(--accent); }
    .event-title { color: var(--heading); font-weight: 600; }
    .event-title a { color: var(--accent); text-decoration: none; }
    .event-title a:hover { text-decoration: underline; }
    .event-meta {
      font-size: 0.8rem;
      opacity: 0.6;
      margin-top: 0.3rem;
    }
    .event-tag {
      display: inline-block;
      padding: 0.15rem 0.5rem;
      background: rgba(79,195,247,0.1);
      color: var(--accent);
      border-radius: 4px;
      font-size: 0.75rem;
      margin-right: 0.5rem;
    }

    footer {
      text-align: center;
      padding: 2rem 0;
      border-top: 1px solid var(--border);
      margin-top: 3rem;
      font-size: 0.85rem;
      opacity: 0.5;
    }
    footer a { color: var(--accent); text-decoration: none; }

    @media (max-width: 600px) {
      .container { padding: 1rem; }
      .logo { font-size: 1.8rem; }
      .stats { flex-direction: column; align-items: center; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">Sanctions Radar</div>
      <div class="subtitle">AI-Powered Crypto Compliance Intelligence</div>
      <div class="period">${weekAgo} &mdash; ${dateStr}</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value">${events.length}</div>
          <div class="stat-label">Signals Detected</div>
        </div>
        <div class="stat">
          <div class="stat-value">4</div>
          <div class="stat-label">Categories Tracked</div>
        </div>
        <div class="stat">
          <div class="stat-value">${new Set(events.map(e => e.source).filter(Boolean)).size || "N/A"}</div>
          <div class="stat-label">Sources</div>
        </div>
      </div>
    </header>

    <section class="brief">
      ${briefHtml}
    </section>

    <section class="events-section" id="signals">
      <h2>Raw Signal Feed</h2>
      <div id="events-list">
        ${events.length > 0 ? events.slice(0, 20).map(e => `
          <div class="event-card">
            <div class="event-title">${e.url ? `<a href="${e.url}" target="_blank" rel="noopener">${e.title || e.text || "Signal"}</a>` : (e.title || e.text || "Signal detected")}</div>
            <div class="event-meta">
              <span class="event-tag">${e._category || "general"}</span>
              ${e.source ? `<span>${e.source}</span> &middot;` : ""}
              ${e.timestamp ? `<span>${new Date(e.timestamp).toLocaleDateString()}</span>` : ""}
            </div>
          </div>
        `).join("") : '<p style="opacity:0.5">No signals detected this period. Data updates weekly.</p>'}
      </div>
    </section>

    <footer>
      <p>Powered by <a href="https://rapidapi.com/cpwatch/api/cpw-tracker">CPW API</a> &middot; 
      AI analysis via <a href="https://docs.github.com/en/github-models">GitHub Models</a></p>
      <p style="margin-top:0.5rem">Built for <a href="https://github.com/1712n/dn-institute">DN Institute</a> Challenge Program</p>
    </footer>
  </div>
</body>
</html>`
}

generateBrief()

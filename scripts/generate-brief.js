import { readFile, writeFile, mkdir } from "fs/promises"

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const THREAT_CATEGORIES = {
  "sanctions": { label: "Sanctions", icon: "⚖️", color: "#ff5252" },
  "regulatory": { label: "Regulatory", icon: "📋", color: "#ffa726" },
  "sanctions-evasion": { label: "Sanctions Evasion", icon: "🕵️", color: "#ff5252" },
  "money-laundering": { label: "Money Laundering", icon: "💰", color: "#ff5252" },
  "cyberattack": { label: "Cyberattack", icon: "🔓", color: "#e040fb" },
  "exploit": { label: "DeFi Exploit", icon: "💥", color: "#e040fb" },
  "rug-pull": { label: "Rug Pull", icon: "🏃", color: "#ffa726" },
  "wash-trading": { label: "Wash Trading", icon: "🔄", color: "#ffa726" },
  "market-manipulation": { label: "Market Manipulation", icon: "📊", color: "#ffa726" },
  "fraud": { label: "Fraud", icon: "🚨", color: "#ff5252" },
  "phishing": { label: "Phishing", icon: "🎣", color: "#4fc3f7" },
}

async function callGitHubModel(model, messages, temperature = 0.3, maxTokens = 2000) {
  if (!GITHUB_TOKEN) return null
  try {
    const response = await fetch("https://models.inference.ai.azure.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GITHUB_TOKEN}`
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens })
    })
    if (!response.ok) {
      console.warn(`Model ${model} returned ${response.status}`)
      return null
    }
    const data = await response.json()
    return data.choices?.[0]?.message?.content || null
  } catch (err) {
    console.warn(`Model ${model} failed: ${err.message}`)
    return null
  }
}

/**
 * AI Pass 1: Entity extraction and threat classification
 */
async function extractEntities(events) {
  if (events.length === 0) return { entities: [], threats: [] }
  
  const eventText = events.slice(0, 30).map(e => {
    return `[${e._category}] ${e.title || e.text || "Signal"} (${e.source || "unknown"})`
  }).join("\n")

  const prompt = `Analyze these crypto threat signals and extract structured data.

Signals:
${eventText}

Return ONLY valid JSON (no markdown fences) with this structure:
{
  "entities": [{"name": "Entity Name", "type": "exchange|protocol|mixer|person|organization|token", "risk": "critical|high|medium|low", "mentions": 1}],
  "threats": [{"type": "category", "severity": "critical|high|medium|low", "summary": "brief description", "affected_entities": ["name1"]}],
  "trend": "escalating|stable|declining",
  "top_risk": "One sentence about the biggest risk this week"
}`

  const result = await callGitHubModel("gpt-4o-mini", [
    { role: "system", content: "You are a crypto threat intelligence analyst. Output only valid JSON." },
    { role: "user", content: prompt }
  ], 0.2, 1500)

  if (result) {
    try {
      const cleaned = result.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim()
      return JSON.parse(cleaned)
    } catch { console.warn("Entity extraction JSON parse failed") }
  }
  return { entities: [], threats: [], trend: "stable", top_risk: "Insufficient data for analysis" }
}

/**
 * AI Pass 2: Generate the main intelligence brief
 */
async function generateMainBrief(events, entityData, weekAgo, dateStr) {
  const byCategory = {}
  events.forEach(e => {
    const cat = e._category || "general"
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(e)
  })
  
  let eventSummary = "No events detected this period."
  if (events.length > 0) {
    eventSummary = Object.entries(byCategory).map(([cat, items]) => {
      const info = THREAT_CATEGORIES[cat] || { label: cat, icon: "📌" }
      const summaries = items.slice(0, 5).map(i => {
        return `  - [${i.source || "Unknown"}] ${i.title || i.text || "Signal"}`
      }).join("\n")
      return `${info.icon} ${info.label} (${items.length} signals):\n${summaries}`
    }).join("\n\n")
  }

  const entityContext = entityData.entities?.length > 0
    ? `\nKey entities identified: ${entityData.entities.map(e => `${e.name} (${e.type}, risk: ${e.risk})`).join(", ")}`
    : ""
  
  const trendContext = entityData.trend ? `\nOverall trend: ${entityData.trend}` : ""

  const prompt = `You are an elite crypto threat intelligence analyst. Generate a comprehensive weekly intelligence brief.

Period: ${weekAgo} to ${dateStr}
Total signals: ${events.length} across ${Object.keys(byCategory).length} threat categories
${entityContext}
${trendContext}

Detected signals by category:
${eventSummary}

Write a professional intelligence brief in HTML (content only, no html/head/body tags) with these sections:

1. **Executive Summary** — 3-4 sentences covering the week's threat landscape. Include overall risk posture.
2. **Critical Threats** — The most urgent items requiring immediate attention. Use severity badges.
3. **Sanctions & Regulatory** — OFAC, EU, FATF developments affecting crypto.
4. **Cyber Threats & Exploits** — Hacks, exploits, vulnerabilities targeting crypto infrastructure.
5. **Market Integrity** — Wash trading, manipulation, rug pulls, fraud schemes.
6. **Entity Watchlist** — Table of entities mentioned with risk levels.
7. **Trend Analysis** — Is the threat landscape escalating, stable, or declining? Week-over-week comparison.
8. **Risk Matrix** — Overall risk score (1-10) with breakdown by category.
9. **Recommended Actions** — Prioritized, specific steps for compliance teams.

Use <h3> for headers. Use CSS classes: risk-critical, risk-high, risk-medium, risk-low for severity badges.
For the entity table, use a simple HTML table with class="entity-table".
For the risk matrix, use class="risk-matrix".
Keep it concise, data-driven, and actionable. If data is sparse, supplement with general intelligence about current crypto threat landscape.`

  const result = await callGitHubModel("gpt-4o-mini", [
    { role: "system", content: "You are a cryptocurrency threat intelligence analyst producing professional briefs for compliance teams. Output clean HTML content only. No markdown fences." },
    { role: "user", content: prompt }
  ], 0.3, 3000)

  if (result) {
    return result.replace(/```html?\n?/g, "").replace(/```\n?/g, "").trim()
  }
  return null
}

/**
 * AI Pass 3: Generate social media content (Twitter/X thread)
 */
async function generateSocialContent(events, entityData, weekAgo, dateStr) {
  const prompt = `Generate a Twitter/X thread (5-7 tweets) summarizing this week's crypto threat intelligence.

Period: ${weekAgo} to ${dateStr}
Signals: ${events.length}
Top risk: ${entityData.top_risk || "See analysis"}
Trend: ${entityData.trend || "stable"}
Key entities: ${(entityData.entities || []).slice(0, 5).map(e => e.name).join(", ") || "None flagged"}
Categories active: ${[...new Set(events.map(e => e._category))].join(", ") || "None"}

Return ONLY valid JSON array of tweet strings. Each tweet must be under 280 chars. Use emojis.
Include relevant hashtags: #CryptoCompliance #Web3Security #DeFi
First tweet should be attention-grabbing with the risk level.
Last tweet should link to the full report.`

  const result = await callGitHubModel("gpt-4o-mini", [
    { role: "system", content: "You create engaging crypto security Twitter threads. Output only a JSON array of strings." },
    { role: "user", content: prompt }
  ], 0.5, 1000)

  if (result) {
    try {
      const cleaned = result.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim()
      return JSON.parse(cleaned)
    } catch { console.warn("Social content JSON parse failed") }
  }
  return [
    `🚨 Weekly CryptoThreat Radar Brief (${weekAgo} → ${dateStr})\n\n${events.length} threat signals detected across the crypto ecosystem.\n\nFull report: https://athena-os-2026.github.io/sanctions-radar/\n\n#CryptoCompliance #Web3Security`
  ]
}

function generateFallbackBrief(events, weekAgo, dateStr) {
  const count = events.length
  const byCategory = {}
  events.forEach(e => {
    const cat = e._category || "general"
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(e)
  })

  const riskLevel = count > 15 ? "critical" : count > 8 ? "high" : count > 3 ? "medium" : "low"
  const riskScore = count > 15 ? 8 : count > 8 ? 6 : count > 3 ? 4 : 2

  return `
    <h3>Executive Summary</h3>
    <p>During ${weekAgo} to ${dateStr}, CryptoThreat Radar detected <strong>${count}</strong> signals 
    across <strong>${Object.keys(byCategory).length}</strong> threat categories covering the cryptocurrency ecosystem.
    Overall threat posture: <span class="risk-badge risk-${riskLevel}">${riskLevel.toUpperCase()}</span></p>
    
    <h3>Critical Threats</h3>
    ${count > 0 ? `<ul>${events.filter(e => e._severity === "critical").slice(0, 5).map(e => 
      `<li><span class="risk-badge risk-critical">CRITICAL</span> ${e.title || e.text || "Signal detected"} <span class="source">(${e.source || "CPW"})</span></li>`
    ).join("") || "<li>No critical threats detected this period</li>"}</ul>` : "<p>No critical threats detected.</p>"}

    <h3>Sanctions &amp; Regulatory</h3>
    <p>Active monitoring across OFAC (US), EU sanctions, and FATF guidance. ${byCategory["sanctions"]?.length || 0} sanctions signals, ${byCategory["regulatory"]?.length || 0} regulatory signals detected.</p>

    <h3>Cyber Threats &amp; Exploits</h3>
    <p>${byCategory["cyberattack"]?.length || 0} cyberattack signals, ${byCategory["exploit"]?.length || 0} exploit signals detected.</p>

    <h3>Market Integrity</h3>
    <p>${byCategory["wash-trading"]?.length || 0} wash trading signals, ${byCategory["rug-pull"]?.length || 0} rug pull signals, ${byCategory["market-manipulation"]?.length || 0} manipulation signals detected.</p>

    <h3>Risk Matrix</h3>
    <div class="risk-matrix">
      <div class="risk-score">${riskScore}/10</div>
      <p>Overall threat level: <span class="risk-badge risk-${riskLevel}">${riskLevel.toUpperCase()}</span></p>
    </div>

    <h3>Recommended Actions</h3>
    <ul>
      <li>Review and update sanctions screening lists</li>
      <li>Verify transaction monitoring covers all flagged entity types</li>
      <li>Brief compliance team on emerging threats</li>
      <li>Update risk assessments for DeFi protocol exposure</li>
    </ul>`
}

function buildPage(briefHtml, events, weekAgo, dateStr, entityData, socialContent) {
  const byCategory = {}
  events.forEach(e => {
    const cat = e._category || "general"
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat].push(e)
  })

  const categoryStats = Object.entries(byCategory).map(([cat, items]) => {
    const info = THREAT_CATEGORIES[cat] || { label: cat, icon: "📌", color: "#4fc3f7" }
    return { cat, count: items.length, ...info }
  }).sort((a, b) => b.count - a.count)

  const criticalCount = events.filter(e => e._severity === "critical").length
  const highCount = events.filter(e => e._severity === "high").length
  const uniqueSources = new Set(events.map(e => e.source).filter(Boolean)).size

  // Social share text for meta tags
  const socialText = socialContent?.[0] || `CryptoThreat Radar: ${events.length} signals detected this week`
  const socialDescription = `Weekly crypto threat intelligence brief covering ${Object.keys(byCategory).length} threat categories. ${events.length} signals detected from ${weekAgo} to ${dateStr}.`

  // Twitter thread HTML
  const twitterThreadHtml = (socialContent || []).map((tweet, i) => 
    `<div class="tweet-card">
      <div class="tweet-header">
        <span class="tweet-avatar">🛡️</span>
        <span class="tweet-author">CryptoThreat Radar</span>
        <span class="tweet-handle">@CryptoThreatRadar</span>
        <span class="tweet-number">${i + 1}/${socialContent.length}</span>
      </div>
      <div class="tweet-body">${tweet.replace(/\n/g, "<br>")}</div>
      <div class="tweet-actions">
        <button class="tweet-copy-btn" onclick="copyTweet(this)" data-tweet="${tweet.replace(/"/g, '&quot;').replace(/\n/g, '\\n')}">📋 Copy</button>
      </div>
    </div>`
  ).join("")

  // Category filter buttons
  const filterButtons = categoryStats.map(c => 
    `<button class="filter-btn" data-category="${c.cat}" style="--cat-color: ${c.color}">${c.icon} ${c.label} <span class="filter-count">${c.count}</span></button>`
  ).join("")

  // Entity watchlist from AI
  const entityRows = (entityData?.entities || []).slice(0, 15).map(e => 
    `<tr>
      <td>${e.name}</td>
      <td><span class="entity-type">${e.type || "unknown"}</span></td>
      <td><span class="risk-badge risk-${e.risk}">${(e.risk || "unknown").toUpperCase()}</span></td>
      <td>${e.mentions || 1}</td>
    </tr>`
  ).join("")

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CryptoThreat Radar — AI-Powered Crypto Threat Intelligence</title>
  
  <!-- Social Media Meta Tags -->
  <meta property="og:title" content="CryptoThreat Radar — Weekly Crypto Threat Intelligence Brief">
  <meta property="og:description" content="${socialDescription}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://athena-os-2026.github.io/sanctions-radar/">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="CryptoThreat Radar — Weekly Brief">
  <meta name="twitter:description" content="${socialDescription}">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg: #06080f;
      --surface: #0d1117;
      --surface2: #161b22;
      --border: #21262d;
      --border-hover: #388bfd;
      --text: #c9d1d9;
      --text-muted: #8b949e;
      --heading: #f0f6fc;
      --accent: #58a6ff;
      --accent2: #bc8cff;
      --danger: #f85149;
      --warning: #d29922;
      --success: #3fb950;
      --critical: #f85149;
      --info: #58a6ff;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.7;
    }
    .container { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }
    
    /* Navigation */
    .nav {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(6,8,15,0.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      padding: 0.75rem 1.5rem;
    }
    .nav-inner {
      max-width: 1000px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-brand { font-weight: 800; font-size: 1.1rem; color: var(--accent); }
    .nav-links { display: flex; gap: 1.5rem; }
    .nav-links a { color: var(--text-muted); text-decoration: none; font-size: 0.85rem; transition: color 0.2s; }
    .nav-links a:hover { color: var(--accent); }

    /* Header */
    header {
      text-align: center;
      padding: 4rem 0 3rem;
      border-bottom: 1px solid var(--border);
      margin-bottom: 2rem;
      position: relative;
      overflow: hidden;
    }
    header::before {
      content: '';
      position: absolute;
      top: -50%;
      left: -50%;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle at 50% 80%, rgba(88,166,255,0.06) 0%, transparent 50%);
      pointer-events: none;
    }
    .logo {
      font-size: 3rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.03em;
    }
    .subtitle { color: var(--text-muted); font-size: 1.05rem; margin-top: 0.5rem; }
    .period {
      display: inline-block;
      margin-top: 1rem;
      padding: 0.4rem 1.2rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 20px;
      font-size: 0.85rem;
      font-family: 'JetBrains Mono', monospace;
      color: var(--accent);
    }
    
    /* Stats Grid */
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-top: 2rem;
    }
    .stat {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      text-align: center;
      transition: border-color 0.2s;
    }
    .stat:hover { border-color: var(--border-hover); }
    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
    }
    .stat-value.critical { color: var(--danger); }
    .stat-value.warning { color: var(--warning); }
    .stat-value.accent { color: var(--accent); }
    .stat-value.success { color: var(--success); }
    .stat-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 0;
      margin: 2rem 0 0;
      border-bottom: 1px solid var(--border);
    }
    .tab {
      padding: 0.75rem 1.5rem;
      background: none;
      border: none;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 0.9rem;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
    }
    .tab:hover { color: var(--text); }
    .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
    .tab-content { display: none; }
    .tab-content.active { display: block; }

    /* Brief Section */
    .brief {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      margin: 1.5rem 0;
    }
    .brief h3 {
      color: var(--heading);
      font-size: 1.1rem;
      margin: 2rem 0 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .brief h3:first-child { margin-top: 0; }
    .brief ul { padding-left: 1.5rem; }
    .brief li { margin: 0.5rem 0; }
    .brief strong { color: var(--heading); }
    .brief .source { color: var(--accent); font-size: 0.85rem; }
    .brief table.entity-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 0.9rem;
    }
    .brief table.entity-table th {
      text-align: left;
      padding: 0.5rem 0.75rem;
      border-bottom: 2px solid var(--border);
      color: var(--text-muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .brief table.entity-table td {
      padding: 0.5rem 0.75rem;
      border-bottom: 1px solid var(--border);
    }
    
    .risk-badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-weight: 600;
      font-size: 0.75rem;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .risk-critical { background: rgba(248,81,73,0.15); color: var(--danger); border: 1px solid rgba(248,81,73,0.3); }
    .risk-high { background: rgba(210,153,34,0.15); color: var(--warning); border: 1px solid rgba(210,153,34,0.3); }
    .risk-medium { background: rgba(88,166,255,0.15); color: var(--info); border: 1px solid rgba(88,166,255,0.3); }
    .risk-low { background: rgba(63,185,80,0.15); color: var(--success); border: 1px solid rgba(63,185,80,0.3); }

    .risk-matrix {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1rem;
      background: var(--surface2);
      border-radius: 8px;
      margin: 0.5rem 0;
    }
    .risk-score {
      font-size: 2.5rem;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: var(--warning);
    }

    /* Category Threat Map */
    .threat-map {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 0.75rem;
      margin: 1.5rem 0;
    }
    .threat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      text-align: center;
      transition: all 0.2s;
      cursor: default;
    }
    .threat-card:hover { border-color: var(--border-hover); transform: translateY(-2px); }
    .threat-card .tc-icon { font-size: 1.5rem; }
    .threat-card .tc-label { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }
    .threat-card .tc-count { font-size: 1.4rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; }

    /* Signal Feed */
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin: 1rem 0;
    }
    .filter-btn {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.35rem 0.75rem;
      color: var(--text-muted);
      font-family: inherit;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .filter-btn:hover, .filter-btn.active {
      border-color: var(--cat-color, var(--accent));
      color: var(--cat-color, var(--accent));
      background: rgba(88,166,255,0.05);
    }
    .filter-count {
      background: var(--surface2);
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-size: 0.7rem;
      margin-left: 0.25rem;
    }

    .event-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: 0.5rem;
      transition: border-color 0.2s;
      border-left: 3px solid transparent;
    }
    .event-card:hover { border-color: var(--border-hover); }
    .event-card[data-severity="critical"] { border-left-color: var(--danger); }
    .event-card[data-severity="high"] { border-left-color: var(--warning); }
    .event-card[data-severity="medium"] { border-left-color: var(--info); }
    .event-title { color: var(--heading); font-weight: 600; font-size: 0.95rem; }
    .event-title a { color: var(--accent); text-decoration: none; }
    .event-title a:hover { text-decoration: underline; }
    .event-meta { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.3rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .event-tag {
      display: inline-block;
      padding: 0.1rem 0.5rem;
      background: var(--surface2);
      border-radius: 4px;
      font-size: 0.7rem;
    }

    /* Social Media Section */
    .social-section {
      margin: 2rem 0;
    }
    .social-section h2 {
      color: var(--heading);
      font-size: 1.2rem;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .tweet-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1rem 1.25rem;
      margin-bottom: 0.75rem;
    }
    .tweet-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }
    .tweet-avatar { font-size: 1.2rem; }
    .tweet-author { font-weight: 600; color: var(--heading); font-size: 0.9rem; }
    .tweet-handle { color: var(--text-muted); font-size: 0.85rem; }
    .tweet-number { margin-left: auto; color: var(--text-muted); font-size: 0.8rem; font-family: 'JetBrains Mono', monospace; }
    .tweet-body { font-size: 0.95rem; line-height: 1.5; white-space: pre-wrap; }
    .tweet-actions { margin-top: 0.5rem; }
    .tweet-copy-btn {
      background: none;
      border: 1px solid var(--border);
      color: var(--text-muted);
      padding: 0.3rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.2s;
    }
    .tweet-copy-btn:hover { border-color: var(--accent); color: var(--accent); }

    .entity-type {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: var(--text-muted);
      background: var(--surface2);
      padding: 0.1rem 0.4rem;
      border-radius: 3px;
    }

    /* Share Bar */
    .share-bar {
      display: flex;
      gap: 0.75rem;
      margin: 1.5rem 0;
      flex-wrap: wrap;
    }
    .share-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }
    .share-btn:hover { opacity: 0.8; }
    .share-twitter { background: #1d9bf0; color: white; }
    .share-linkedin { background: #0a66c2; color: white; }
    .share-telegram { background: #26a5e4; color: white; }
    .share-copy { background: var(--surface2); color: var(--text); border: 1px solid var(--border); cursor: pointer; font-family: inherit; }

    footer {
      text-align: center;
      padding: 2rem 0;
      border-top: 1px solid var(--border);
      margin-top: 3rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
    footer a { color: var(--accent); text-decoration: none; }

    @media (max-width: 600px) {
      .container { padding: 1rem; }
      .logo { font-size: 2rem; }
      .stats { grid-template-columns: repeat(2, 1fr); }
      .threat-map { grid-template-columns: repeat(2, 1fr); }
      .nav-links { display: none; }
    }
  </style>
</head>
<body>
  <nav class="nav">
    <div class="nav-inner">
      <div class="nav-brand">🛡️ CryptoThreat Radar</div>
      <div class="nav-links">
        <a href="#brief">Intelligence Brief</a>
        <a href="#threats">Threat Map</a>
        <a href="#signals">Signal Feed</a>
        <a href="#social">Social</a>
        <a href="#entities">Entities</a>
      </div>
    </div>
  </nav>

  <div class="container">
    <header>
      <div class="logo">CryptoThreat Radar</div>
      <div class="subtitle">AI-Powered Crypto Threat Intelligence Platform</div>
      <div class="period">${weekAgo} → ${dateStr}</div>
      <div class="stats">
        <div class="stat">
          <div class="stat-value accent">${events.length}</div>
          <div class="stat-label">Total Signals</div>
        </div>
        <div class="stat">
          <div class="stat-value critical">${criticalCount}</div>
          <div class="stat-label">Critical</div>
        </div>
        <div class="stat">
          <div class="stat-value warning">${highCount}</div>
          <div class="stat-label">High Severity</div>
        </div>
        <div class="stat">
          <div class="stat-value accent">${categoryStats.length}</div>
          <div class="stat-label">Threat Categories</div>
        </div>
        <div class="stat">
          <div class="stat-value success">${uniqueSources || "N/A"}</div>
          <div class="stat-label">Sources</div>
        </div>
        <div class="stat">
          <div class="stat-value accent">${(entityData?.entities || []).length}</div>
          <div class="stat-label">Entities Tracked</div>
        </div>
      </div>
    </header>

    <!-- Share Bar -->
    <div class="share-bar">
      <a class="share-btn share-twitter" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(`🛡️ Weekly CryptoThreat Radar Brief\n\n${events.length} threat signals detected across ${categoryStats.length} categories\n\nFull report:`)}&url=${encodeURIComponent("https://athena-os-2026.github.io/sanctions-radar/")}" target="_blank" rel="noopener">𝕏 Share on Twitter</a>
      <a class="share-btn share-linkedin" href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://athena-os-2026.github.io/sanctions-radar/")}" target="_blank" rel="noopener">in Share on LinkedIn</a>
      <a class="share-btn share-telegram" href="https://t.me/share/url?url=${encodeURIComponent("https://athena-os-2026.github.io/sanctions-radar/")}&text=${encodeURIComponent("CryptoThreat Radar - Weekly Crypto Threat Intelligence Brief")}" target="_blank" rel="noopener">✈ Telegram</a>
      <button class="share-btn share-copy" onclick="navigator.clipboard.writeText(window.location.href);this.textContent='✓ Copied!'">📋 Copy Link</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" onclick="switchTab('brief')">📊 Intelligence Brief</button>
      <button class="tab" onclick="switchTab('signals')">📡 Signal Feed</button>
      <button class="tab" onclick="switchTab('social')">🐦 Social Media</button>
      <button class="tab" onclick="switchTab('entities')">🏢 Entity Watchlist</button>
    </div>

    <!-- Tab: Intelligence Brief -->
    <div id="tab-brief" class="tab-content active">
      <section id="threats">
        <h2 style="color: var(--heading); font-size: 1.2rem; margin: 1.5rem 0 1rem;">Threat Category Map</h2>
        <div class="threat-map">
          ${categoryStats.map(c => `
            <div class="threat-card">
              <div class="tc-icon">${c.icon}</div>
              <div class="tc-count" style="color: ${c.color}">${c.count}</div>
              <div class="tc-label">${c.label}</div>
            </div>
          `).join("")}
          ${categoryStats.length === 0 ? '<div class="threat-card"><div class="tc-icon">📭</div><div class="tc-count" style="color: var(--text-muted)">0</div><div class="tc-label">No signals yet</div></div>' : ''}
        </div>
      </section>

      <section id="brief" class="brief">
        ${briefHtml}
      </section>
    </div>

    <!-- Tab: Signal Feed -->
    <div id="tab-signals" class="tab-content">
      <section class="events-section" id="signals">
        <div class="filter-bar">
          <button class="filter-btn active" data-category="all" onclick="filterSignals('all')">All <span class="filter-count">${events.length}</span></button>
          ${filterButtons}
        </div>
        <div id="events-list">
          ${events.length > 0 ? events.slice(0, 50).map(e => `
            <div class="event-card" data-category="${e._category || 'general'}" data-severity="${e._severity || 'low'}">
              <div class="event-title">${e.url ? `<a href="${e.url}" target="_blank" rel="noopener">${e.title || e.text || "Signal"}</a>` : (e.title || e.text || "Signal detected")}</div>
              <div class="event-meta">
                <span class="risk-badge risk-${e._severity || 'low'}">${(e._severity || 'low').toUpperCase()}</span>
                <span class="event-tag">${THREAT_CATEGORIES[e._category]?.icon || "📌"} ${THREAT_CATEGORIES[e._category]?.label || e._category || "General"}</span>
                ${e.source ? `<span>${e.source}</span>` : ""}
                ${e.timestamp ? `<span>${new Date(e.timestamp).toLocaleDateString()}</span>` : ""}
              </div>
            </div>
          `).join("") : '<p style="color: var(--text-muted); padding: 2rem; text-align: center;">No signals detected this period. Data updates weekly.</p>'}
        </div>
      </section>
    </div>

    <!-- Tab: Social Media -->
    <div id="tab-social" class="tab-content">
      <section class="social-section" id="social">
        <h2>🐦 Social Media Ready Thread</h2>
        <p style="color: var(--text-muted); margin-bottom: 1rem;">AI-generated Twitter/X thread ready to post. Click copy on each tweet to share individually.</p>
        ${twitterThreadHtml || '<p style="color: var(--text-muted)">Social content generation requires GitHub Token.</p>'}
      </section>
    </div>

    <!-- Tab: Entity Watchlist -->
    <div id="tab-entities" class="tab-content">
      <section id="entities">
        <h2 style="color: var(--heading); font-size: 1.2rem; margin: 1.5rem 0 1rem;">🏢 AI-Extracted Entity Watchlist</h2>
        <p style="color: var(--text-muted); margin-bottom: 1rem;">Entities automatically identified and risk-scored by AI analysis of threat signals.</p>
        ${entityRows ? `
        <table class="entity-table" style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left; padding:0.5rem 0.75rem; border-bottom:2px solid var(--border); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em;">Entity</th>
              <th style="text-align:left; padding:0.5rem 0.75rem; border-bottom:2px solid var(--border); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em;">Type</th>
              <th style="text-align:left; padding:0.5rem 0.75rem; border-bottom:2px solid var(--border); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em;">Risk</th>
              <th style="text-align:left; padding:0.5rem 0.75rem; border-bottom:2px solid var(--border); color:var(--text-muted); font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em;">Mentions</th>
            </tr>
          </thead>
          <tbody>${entityRows}</tbody>
        </table>` : '<p style="color: var(--text-muted)">No entities extracted. Entity extraction requires AI analysis via GitHub Models.</p>'}
        
        ${entityData?.trend ? `<div style="margin-top: 1.5rem; padding: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px;">
          <strong style="color: var(--heading);">Trend Analysis:</strong> 
          <span style="color: ${entityData.trend === 'escalating' ? 'var(--danger)' : entityData.trend === 'declining' ? 'var(--success)' : 'var(--warning)'}">
            ${entityData.trend === 'escalating' ? '📈 Escalating' : entityData.trend === 'declining' ? '📉 Declining' : '➡️ Stable'}
          </span>
          ${entityData.top_risk ? `<p style="margin-top: 0.5rem; color: var(--text-muted);">${entityData.top_risk}</p>` : ''}
        </div>` : ''}
      </section>
    </div>

    <footer>
      <p>Powered by <a href="https://rapidapi.com/cpwatch/api/cpw-tracker">CPW API</a> · 
      Multi-model AI analysis via <a href="https://docs.github.com/en/github-models">GitHub Models</a> · 
      Updated weekly</p>
      <p style="margin-top:0.5rem">Built for <a href="https://github.com/1712n/dn-institute">DN Institute</a> Challenge Program · 
      <a href="https://github.com/athena-os-2026/sanctions-radar">Source Code</a></p>
    </footer>
  </div>

  <script>
    function switchTab(name) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
      document.querySelector('[onclick="switchTab(\\'' + name + '\\')"]').classList.add('active');
      document.getElementById('tab-' + name).classList.add('active');
    }

    function filterSignals(category) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.closest('.filter-btn').classList.add('active');
      document.querySelectorAll('.event-card').forEach(card => {
        card.style.display = (category === 'all' || card.dataset.category === category) ? '' : 'none';
      });
    }

    function copyTweet(btn) {
      const text = btn.dataset.tweet.replace(/\\\\n/g, '\\n');
      navigator.clipboard.writeText(text);
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = '📋 Copy', 2000);
    }

    // Bind filter buttons
    document.querySelectorAll('.filter-btn[data-category]:not([data-category="all"])').forEach(btn => {
      btn.addEventListener('click', () => filterSignals(btn.dataset.category));
    });
  </script>
</body>
</html>`
}

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

  // AI Pass 1: Entity extraction & threat classification
  console.log("AI Pass 1: Entity extraction & threat classification...")
  const entityData = await extractEntities(events)
  console.log(`  Extracted ${entityData.entities?.length || 0} entities, trend: ${entityData.trend}`)

  // AI Pass 2: Main intelligence brief
  console.log("AI Pass 2: Generating intelligence brief...")
  let briefHtml = await generateMainBrief(events, entityData, weekAgo, dateStr)
  if (!briefHtml) {
    console.log("  Falling back to template brief")
    briefHtml = generateFallbackBrief(events, weekAgo, dateStr)
  }

  // AI Pass 3: Social media content
  console.log("AI Pass 3: Generating social media content...")
  const socialContent = await generateSocialContent(events, entityData, weekAgo, dateStr)
  console.log(`  Generated ${socialContent.length} tweets`)

  // Build the full page
  const html = buildPage(briefHtml, events, weekAgo, dateStr, entityData, socialContent)
  
  await writeFile("index.html", html)
  console.log("Generated index.html")

  // Save structured data
  await mkdir("data", { recursive: true })
  await writeFile("data/latest-brief.json", JSON.stringify({
    generated: new Date().toISOString(),
    period: { start: weekAgo, end: dateStr },
    eventCount: events.length,
    threatCategories: [...new Set(events.map(e => e._category))],
    entities: entityData.entities || [],
    trend: entityData.trend,
    topRisk: entityData.top_risk,
    socialThread: socialContent,
    briefHtml
  }, null, 2))

  console.log("All passes complete. Brief generated successfully.")
}

generateBrief()

# 🛡️ CryptoThreat Radar

**AI-Powered Crypto Threat Intelligence Platform**

CryptoThreat Radar goes far beyond basic sanctions monitoring. It's a comprehensive crypto threat intelligence platform that uses **multi-pass AI analysis** to detect, classify, and assess threats across the entire cryptocurrency ecosystem — from sanctions enforcement to DeFi exploits, rug pulls, and market manipulation.

**🌐 Live Dashboard**: [https://athena-os-2026.github.io/sanctions-radar/](https://athena-os-2026.github.io/sanctions-radar/)

## What Makes It Different

| Feature | Basic Template | CryptoThreat Radar |
|---------|---------------|-------------------|
| Threat categories | 1 | **11** (sanctions, exploits, rug pulls, wash trading, phishing, etc.) |
| AI analysis | Simple summary | **3-pass multi-model** (entity extraction → brief generation → social content) |
| Risk scoring | None | **Per-entity and overall risk matrix** |
| Entity tracking | None | **AI-extracted entity watchlist with risk levels** |
| Social media | None | **Twitter/X-ready thread generator + share buttons + OG meta tags** |
| Trend analysis | None | **Escalating/stable/declining with week-over-week comparison** |
| UI | Basic list | **Interactive dashboard with tabs, filters, threat map** |
| Signal filtering | None | **Category-based filtering with severity indicators** |

## 🔍 11 Threat Categories Monitored

| Category | What It Tracks |
|----------|---------------|
| ⚖️ Sanctions | OFAC designations, sanctions enforcement on crypto entities |
| 📋 Regulatory | Enforcement actions, compliance requirements |
| 🕵️ Sanctions Evasion | DeFi protocols used to evade sanctions |
| 💰 Money Laundering | Mixer services, layering through crypto |
| 🔓 Cyberattack | Exchange hacks, infrastructure attacks |
| 💥 DeFi Exploit | Smart contract exploits, flash loan attacks |
| 🏃 Rug Pull | Exit scams, abandoned projects |
| 🔄 Wash Trading | Volume manipulation, fake trading |
| 📊 Market Manipulation | Pump and dump, spoofing |
| 🚨 Fraud | Crypto fraud schemes |
| 🎣 Phishing | Social engineering attacks targeting crypto users |

## 🤖 3-Pass AI Analysis Pipeline

CryptoThreat Radar uses **three separate AI inference passes** via GitHub Models to provide comprehensive analysis:

### Pass 1: Entity Extraction & Threat Classification
- Extracts named entities (exchanges, protocols, tokens, people)
- Classifies threats by type and severity
- Identifies trend direction (escalating/stable/declining)

### Pass 2: Intelligence Brief Generation
- Produces a structured intelligence brief with 9 sections
- Includes risk matrix with numerical scoring (1-10)
- Entity watchlist with risk levels
- Actionable recommendations for compliance teams

### Pass 3: Social Media Content Generation
- Generates a ready-to-post Twitter/X thread (5-7 tweets)
- Each tweet stays under 280 characters
- Includes relevant hashtags and engagement hooks
- One-click copy buttons for each tweet

## 📱 Social Media Integration

- **Twitter/X Thread Generator**: AI creates a ready-to-post thread summarizing the week's threats
- **One-Click Sharing**: Share buttons for Twitter/X, LinkedIn, and Telegram
- **Open Graph Meta Tags**: Rich previews when sharing the dashboard URL
- **Copy-to-Clipboard**: Copy individual tweets or the dashboard URL

## Architecture

```
CPW API ──► api-call.js ──► data/events.json ──► generate-brief.js ──► index.html
              (11 queries)                          │
                                              GitHub Models
                                           ┌────────┼────────┐
                                      Pass 1    Pass 2    Pass 3
                                     Entities   Brief    Social
                                     + Risks   + Risk    Tweets
                                              Matrix
```

## Setup

1. **Fork/clone this repository**
2. **Subscribe to CPW API**: [CPW API](https://rapidapi.com/CPWatch/api/cpw-tracker) Basic plan (100 free requests/month)
3. **Add secrets** in Settings > Secrets > Actions:
   - `RAPIDAPI_KEY` - Your RapidAPI key
4. **Enable GitHub Pages**: Settings > Pages > Source: GitHub Actions
5. **Run the workflow**: Actions > Deploy CryptoThreat Radar > Run workflow

## Built With

- [CPW API](https://rapidapi.com/cpwatch/api/cpw-tracker) - Threat signal detection across 11 categories
- [GitHub Models](https://docs.github.com/en/github-models) - 3-pass AI analysis pipeline (GPT-4o-mini)
- [GitHub Pages](https://pages.github.com/) - Static dashboard hosting
- [GitHub Actions](https://github.com/features/actions) - Automated weekly intelligence cycle

## License

Built for the [DN Institute Challenge Program](https://github.com/1712n/dn-institute#-challenge-program) using the [Product Development Kit](https://github.com/1712n/product-kit-template) template.

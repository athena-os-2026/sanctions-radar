# Sanctions Radar

**AI-Powered Crypto Compliance Intelligence Brief**

Sanctions Radar monitors cryptocurrency entities for sanctions enforcement signals, regulatory actions, and compliance risks. It generates a weekly AI-powered intelligence brief designed for compliance teams and risk analysts.

**Live Dashboard**: [View Latest Brief](https://athena-os-2026.github.io/sanctions-radar/)

## What It Does

- **Monitors 4 threat categories**: Sanctions enforcement, regulatory actions, sanctions evasion via DeFi, and money laundering through mixers
- **Aggregates signals** from the CPW API across multiple entity types
- **Generates AI analysis** using GitHub Models (GPT-4o-mini) to produce actionable intelligence briefs
- **Deploys automatically** to GitHub Pages on a weekly schedule
- **Assigns risk levels** (HIGH/MEDIUM/LOW) based on signal volume and severity

## How It's Different

Unlike generic crypto monitoring tools, Sanctions Radar focuses specifically on the **compliance and sanctions enforcement** niche:

- Tracks **cryptocurrency exchanges**, **DeFi protocols**, **mixer services**, and **cryptocurrency services**
- Monitors for **sanctions**, **regulatory enforcement**, **sanctions evasion**, and **money laundering** signals
- Produces **structured intelligence briefs** with executive summaries, risk assessments, and actionable recommendations
- Designed for **compliance officers** and **risk management teams**

## Architecture

```
CPW API ──► api-call.js ──► data/events.json ──► generate-brief.js ──► index.html
                                                       │
                                                 GitHub Models
                                                 (AI Analysis)
```

1. `scripts/api-call.js` - Fetches data from CPW API across 4 monitoring categories
2. `scripts/generate-brief.js` - Processes events and generates AI-powered intelligence briefs via GitHub Models
3. GitHub Actions runs weekly, updates data, generates brief, and deploys to Pages

## Setup

1. **Fork/clone this repository**
2. **Subscribe to CPW API**: Go to [CPW API](https://rapidapi.com/CPWatch/api/cpw-tracker) and subscribe to the Basic plan
3. **Add secrets** in Settings > Secrets > Actions:
   - `RAPIDAPI_KEY` - Your RapidAPI key for CPW Tracker
4. **Enable GitHub Pages**: Settings > Pages > Source: GitHub Actions
5. **Run the workflow**: Actions > Deploy Sanctions Radar > Run workflow

## Customization

Edit `scripts/api-call.js` to change monitored entities and topics:

```javascript
const queries = [
  { entities: "cryptocurrency exchanges", topic: "sanctions" },
  { entities: "cryptocurrency services", topic: "regulatory enforcement" },
  // Add your own categories...
]
```

Edit the AI prompt in `scripts/generate-brief.js` to change the analysis style.

## Built With

- [CPW API](https://rapidapi.com/cpwatch/api/cpw-tracker) - Catastrophic event signal tracking
- [GitHub Models](https://docs.github.com/en/github-models) - AI-powered analysis
- [GitHub Pages](https://pages.github.com/) - Static site hosting
- [GitHub Actions](https://github.com/features/actions) - Automated weekly updates

## License

Built for the [DN Institute Challenge Program](https://github.com/1712n/dn-institute#-challenge-program) using the [Product Development Kit](https://github.com/1712n/product-kit-template) template.

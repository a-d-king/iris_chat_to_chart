# Chat → Chart: AI-Powered Business Intelligence

Transform natural language into intelligent business charts using AI and automated data discovery.

## 🛠️ Tech Stack

**Backend (NestJS)**
- **NestJS** - Node.js framework
- **OpenAI GPT-4** - Natural language processing  
- **TypeScript** - Type safety

**Frontend (Next.js)**
- **Next.js** - React framework
- **ag-charts-react** - Chart rendering
- **TypeScript** - Type safety

## ✨ Key Features

- **Natural Language to Charts** - "Show me sales trends" → Line chart
- **Intelligent Data Discovery** - Automatically finds 99+ metrics in complex business data
- **6 Chart Types** - Line, bar, stacked-bar, heatmap, waterfall
- **Smart AI Context** - GPT-4 receives data analysis for optimal chart selection
- **Complete Audit Trail** - Every chart generation logged for compliance

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key

### 1. Clone & Setup
```bash
git clone <your-repo-url>
cd iris_chat_to_chart

# Backend setup
cd server
npm install

# Frontend setup  
cd ../web
npm install
```

### 2. Environment Variables
Create `server/.env`:
```
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Start Services
```bash
# Terminal 1: Backend (http://localhost:4000)
cd server
npm run dev

# Terminal 2: Frontend (http://localhost:3000)  
cd web
npm run dev
```

Visit `http://localhost:3000` and start asking for charts!

## 💬 Usage Examples

| **Query** | **Result** |
|-----------|------------|
| "Show me sales trends" | Line chart with time series data |
| "Compare revenue by channel" | Bar chart grouped by sales connector |
| "June performance breakdown" | Filtered data for June 2025 |
| "Account cash details" | Bar chart of account-level metrics |

## 📡 API Endpoints

### Generate Chart
```bash
POST http://localhost:4000/chat
Content-Type: application/json

{
  "prompt": "Show me revenue trends by sales channel"
}
```

**Response:**
```json
{
  "chartType": "line",
  "metric": "dataBySalesConnectors.grossSales",
  "dateRange": "2025-06",
  "data": [
    {"date": "2025-06-01", "value": 87589.85},
    {"date": "2025-06-02", "value": 79724.74}
  ],
  "requestId": "1703123456789-abc123def",
  "originalPrompt": "Show me revenue trends by sales channel"
}
```

### Audit Statistics
```bash
GET http://localhost:4000/audit/stats
```

## 📁 Project Structure

```
├── server/                    # NestJS Backend
│   ├── src/
│   │   ├── app.controller.ts  # Main API endpoints
│   │   ├── data-analysis.service.ts  # Metric discovery engine
│   │   ├── metrics.service.ts # Data processing & slicing
│   │   ├── openai.service.ts  # GPT-4 integration
│   │   └── audit.service.ts   # Request logging
│   ├── sample-june-metrics.json  # Sample business data
│   └── audit-logs/           # Generated audit logs
├── web/                      # Next.js Frontend  
│   ├── components/
│   │   ├── ChatBox.tsx       # User input
│   │   └── ChartView.tsx     # Chart rendering
│   └── pages/index.tsx       # Main application
```

## 🔧 Configuration

### Data Source
Edit `server/src/config.ts`:
```typescript
dataSource: {
    primaryFile: 'sample-june-metrics.json',
    fallbackFile: 'metrics.json'
},
audit: {
    enabled: true,
    retentionDays: 30
}
```

### Supported Data Types
- **Scalar** - Single values (`totalRevenue: 150000`)
- **Time Series** - Date/value arrays (`sales: [{date: "2025-06-01", value: 1000}]`)
- **Grouped Series** - Multi-category data over time
- **Dynamic Objects** - Account-level data (`cashDetails: {"account_123": {...}}`)
- **Embedded Metrics** - Complex nested structures

## 🎨 Customization

### Add Your Logo
1. Place logo in `web/public/logo.png`
2. Update `web/pages/index.tsx` logo placeholder
3. Recommended: 64x64px PNG with transparent background

## 🔍 How It Works

1. **Data Analysis** - System discovers metrics in your business data
2. **AI Context** - GPT-4 receives data structure and recommendations  
3. **Smart Selection** - AI chooses optimal chart type based on user intent
4. **Data Processing** - Metrics service transforms raw data to chart format
5. **Audit Logging** - Complete request/response logged for compliance

## 📈 Production Deployment

### Backend
```bash
cd server
npm run build
npm start
```

### Frontend
```bash
cd web
npm run build
npm start
```

**Environment Variables for Production:**
- Set `OPENAI_API_KEY` in your production environment
- Configure proper file permissions for audit directory
- Set up monitoring for audit log storage

## 📄 License

MIT License - see LICENSE file for details.
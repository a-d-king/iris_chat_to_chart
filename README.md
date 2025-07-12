# Chat → Chart MVP

A full-stack application that transforms natural language into beautiful charts powered by AI. Built with NestJS, Next.js, OpenAI, and ag-charts-react.

## 🚀 Features

- **Natural Language Processing**: Type requests like "Show me revenue trends for 2023" 
- **AI-Powered Chart Generation**: Uses OpenAI GPT-4 to interpret requests and generate chart specifications
- **Multiple Chart Types**: Supports line, bar, stacked-bar, heatmap, and waterfall charts
- **Real-time Data**: Loads and processes metrics from your data files
- **Modern UI**: Clean, responsive interface built with React and Next.js

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key (optional - app works with mock data for testing)

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd chat-to-chart
```

### 2. Set up the backend (NestJS)
```bash
cd server
npm install
```

### 3. Set up the frontend (Next.js)
```bash
cd ../web
npm install
```

### 4. Configure Environment Variables (Optional)
For real AI-powered chart generation, create a `.env` file in the `server` directory:
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

**Note:** The app works without an API key using mock data for testing! If you don't have an OpenAI API key, you can skip this step and the app will use intelligent mock responses.

### 5. Prepare your data
The application comes with sample data in `server/metrics.json`. You can replace this with your own data following the same structure:

```json
{
  "metricNameSeries": {
    "dates": ["2023-01", "2023-02", "2023-03"],
    "values": [
      {
        "label": "Series Name",
        "values": [100, 120, 140]
      }
    ]
  },
  "metricNameByDimension": {
    "dates": ["2023-01", "2023-02", "2023-03"],
    "values": [
      {
        "label": "Category 1",
        "values": [50, 60, 70]
      },
      {
        "label": "Category 2",
        "values": [50, 60, 70]
      }
    ]
  }
}
```

## 🏃‍♂️ Running the Application

### Start the backend server
```bash
cd server
npm run dev
```
The server will start on `http://localhost:4000`

### Start the frontend application
```bash
cd web
npm run dev
```
The frontend will start on `http://localhost:3000`

## 💡 Usage

1. **Open your browser** to `http://localhost:3000`
2. **Type a natural language request** for a chart, such as:
   - "Show me revenue trends for 2023"
   - "Display user counts by region as a bar chart"
   - "Create a stacked bar chart of sales by country"
   - "Show conversion rates over time"
3. **Click "Ask"** or press Enter
4. **View your generated chart** with the data from your metrics file

### 🎭 Demo Mode (No API Key Required)

If you don't have an OpenAI API key, the app automatically runs in **Demo Mode** with intelligent mock responses:

- **Smart keyword detection**: The app analyzes your prompt and generates appropriate chart specs
- **All chart types supported**: Test line, bar, stacked-bar, heatmap, and waterfall charts
- **Dynamic responses**: Different prompts generate different chart configurations
- **Visual indicator**: A banner shows when you're in demo mode

**Demo Mode Examples:**
- "Show me revenue trends" → Line chart with revenue data
- "Display users by country as a bar chart" → Bar chart with users grouped by country
- "Create a stacked bar chart of sales by region" → Stacked bar chart with regional sales data

## 🏗️ Project Structure

```
├── server/                 # NestJS Backend
│   ├── src/
│   │   ├── main.ts        # Application bootstrap
│   │   ├── app.controller.ts  # Main API controller
│   │   ├── chat.dto.ts    # Data validation schemas
│   │   ├── openai.service.ts  # OpenAI integration
│   │   └── metrics.service.ts # Data loading service
│   ├── metrics.json       # Sample data file
│   ├── package.json
│   └── tsconfig.json
├── web/                   # Next.js Frontend
│   ├── components/
│   │   ├── ChatBox.tsx    # User input component
│   │   └── ChartView.tsx  # Chart rendering component
│   ├── pages/
│   │   └── index.tsx      # Main page
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.mjs
└── README.md
```

## 🔧 Customization

### Adding New Metrics
1. Add your data to `server/metrics.json` following the existing structure
2. Update the `MetricsService.slice()` method in `server/src/metrics.service.ts` if needed
3. The AI will automatically understand new metrics based on their names

### Modifying Chart Types
1. Update the `FUNCTION_SCHEMA` in `server/src/openai.service.ts` to add new chart types
2. Update the validation in `server/src/chat.dto.ts`
3. Update the chart rendering logic in `web/components/ChartView.tsx`

### Styling
- Modify the inline styles in the React components
- Add CSS modules or styled-components for more advanced styling

## 📊 Supported Chart Types

- **Line Chart**: Perfect for time series data and trends
- **Bar Chart**: Great for comparing categories
- **Stacked Bar Chart**: Shows composition within categories
- **Heatmap**: Visualizes data density and patterns
- **Waterfall Chart**: Shows cumulative effects

## 🤖 AI Prompts

The application works best with prompts that include:
- **Metric name**: "revenue", "users", "sales", etc.
- **Time range**: "2023", "2023-01", "last quarter"
- **Chart type** (optional): "line chart", "bar chart", "stacked"
- **Grouping** (optional): "by region", "by country", "by category"

### Example Prompts:
- "Show me revenue trends for 2023"
- "Create a bar chart of users by country"
- "Display sales data as a stacked bar chart by region"
- "Show conversion rates over time as a line chart"

## 🔍 Troubleshooting

### Common Issues:

1. **"Error: Could not process your request"**
   - Check that your OpenAI API key is set correctly
   - Verify the server is running on port 4000
   - Check the browser console for detailed error messages

2. **"Failed to load metrics data"**
   - Ensure `metrics.json` exists in the server directory
   - Verify the JSON format is valid
   - Check server logs for detailed error messages

3. **Charts not rendering**
   - Verify that your data follows the expected structure
   - Check that the chart type is supported
   - Look for console errors in the browser

### Debug Mode:
- Check server logs in the terminal where you started the backend
- Open browser developer tools (F12) to see frontend errors
- Verify API calls in the Network tab

## 🚀 Production Deployment

### Backend:
```bash
cd server
npm run build
npm start
```

### Frontend:
```bash
cd web
npm run build
npm start
```

Configure environment variables for production and update the API URL in the frontend components.

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📧 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

Built with ❤️ using NestJS, Next.js, OpenAI, and ag-charts-react 
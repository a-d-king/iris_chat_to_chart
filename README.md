# Chat → Chart: AI-Powered Business Intelligence Platform

A sophisticated full-stack application that transforms natural language into intelligent business charts using advanced AI and automated data discovery. Built with NestJS, Next.js, OpenAI GPT-4, and ag-charts-react.

## 🚀 Key Features

### 🤖 Intelligent Data Discovery
- **5x Enhanced Metric Detection**: Automatically discovers 99+ metrics from complex business data (vs. 15-20 in basic systems)
- **6 Metric Types**: Supports scalar, time series, grouped series, arrays, dynamic key objects, and embedded metrics
- **Recursive Analysis**: Explores nested data structures up to 5 levels deep
- **Smart Value Classification**: Automatically identifies currency, percentage, count, and generic value types

### 📊 Advanced Chart Generation
- **5 Chart Types**: Line, bar, stacked-bar, heatmap, and waterfall charts
- **Context-Aware AI**: GPT-4 receives comprehensive data analysis for optimal chart selection
- **Intelligent Recommendations**: AI suggests best chart types based on data characteristics
- **Complex Data Support**: Handles account-level breakdowns, sales channel analysis, and embedded metrics

### 🔍 Comprehensive Audit System
- **Complete Request Logging**: Every chart generation is audited with full context
- **Daily Summaries**: Consolidated logs for compliance and analytics
- **Usage Statistics**: Built-in analytics for monitoring patterns and performance
- **Automatic Cleanup**: Configurable retention policy for audit logs

### 🎯 Business Intelligence Capabilities
- **Account-Level Analytics**: Individual account breakdowns (e.g., cash details by account ID)
- **Sales Channel Analysis**: Performance metrics by connector/channel
- **Multi-Metric Containers**: Discover and visualize related metrics together
- **Complex Nested Structures**: Support for deeply nested business data

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key

## 🛠️ Installation

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd iris_chat_to_chart
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

### 4. Configure Environment Variables
Create a `.env` file in the `server` directory:
```bash
OPENAI_API_KEY=your_openai_api_key_here
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

## 💡 Usage Examples

The enhanced system understands complex business queries and automatically discovers the best metrics:

### Time Series Analysis
- **"Show me sales trends over time"** → Line chart with daily sales data
- **"Revenue performance in June"** → Bar chart filtered to June 2025

### Comparative Analysis  
- **"Compare performance by sales channel"** → Stacked bar chart showing channel breakdown
- **"Account performance comparison"** → Bar chart comparing individual accounts

### Complex Metrics Discovery
- **"Show cash details breakdown"** → Discovers and charts account-level cash metrics
- **"Sales connector performance"** → Analyzes embedded metrics in sales data
- **"Monthly revenue by region"** → Multi-dimensional analysis with grouping

### Advanced Visualizations
- **"Waterfall chart of changes"** → Shows cumulative effects over time
- **"Heatmap of regional performance"** → Intensity patterns across dimensions

## 🎨 Adding Your Logo

To add your Iris Finance logo to the application:

1. **Place your logo file** in the `web/public/` directory (e.g., `web/public/iris-finance-logo.png`)

2. **Update the logo placeholder** in `web/pages/index.tsx`:
   
   Replace this placeholder div:
   ```jsx
   <div style={{
       width: 64,
       height: 64,
       backgroundColor: '#7c3aed',
       // ... other styles
   }}>
       IF
   </div>
   ```
   
   With your actual logo:
   ```jsx
   <img 
       src="/iris-finance-logo.png" 
       alt="Iris Finance" 
       style={{
           width: 64, 
           height: 64, 
           margin: '0 auto 16px auto', 
           display: 'block',
           borderRadius: 12
       }} 
   />
   ```

3. **Recommended logo specifications:**
   - **Size**: 64x64 pixels (or higher resolution with same aspect ratio)
   - **Format**: PNG with transparent background for best results
   - **Style**: Should work well with the purple color scheme (#7c3aed)

## 🏗️ Enhanced Project Structure

```
├── server/                          # NestJS Backend
│   ├── src/
│   │   ├── main.ts                  # Application bootstrap
│   │   ├── app.controller.ts        # Main API controller with audit integration
│   │   ├── data-analysis.service.ts # Advanced metric discovery (21KB, 597 lines)
│   │   ├── metrics.service.ts       # Enhanced data slicing (10KB, 313 lines)
│   │   ├── openai.service.ts        # Context-aware AI prompting
│   │   ├── audit.service.ts         # Comprehensive audit logging
│   │   ├── config.ts                # Application configuration
│   │   └── chat.dto.ts              # Data validation schemas
│   ├── sample-june-metrics.json     # Rich sample data (46KB, 1902 lines)
│   ├── audit-logs/                  # Audit logs directory
│   ├── AUDIT_README.md              # Audit system documentation
│   ├── package.json
│   └── tsconfig.json
├── web/                             # Next.js Frontend
│   ├── components/
│   │   ├── ChatBox.tsx              # Enhanced user input component
│   │   └── ChartView.tsx            # Advanced chart rendering
│   ├── pages/
│   │   └── index.tsx                # Main application page
│   ├── package.json
│   ├── tsconfig.json
│   └── next.config.mjs
└── README.md
```

## 🔧 Advanced Configuration

### Data Analysis Settings
The system automatically discovers metrics but can be configured in `config.ts`:

```typescript
dataSource: {
    primaryFile: 'sample-june-metrics.json',
    fallbackFile: 'metrics.json'
},
audit: {
    enabled: true,
    retentionDays: 30,
    directory: 'audit-logs'
}
```

### Metric Types Supported
1. **Scalar**: Single numeric values (totals, summaries)
2. **Time Series**: Date/value arrays showing trends
3. **Grouped Series**: Multi-category data over time
4. **Dynamic Key Objects**: Account-level data with ID-based keys
5. **Embedded Metrics**: Container objects with multiple sub-metrics
6. **Arrays**: General numeric collections

### Chart Type Intelligence
The AI automatically selects optimal chart types based on:
- **Data structure** (time series vs. categorical)
- **User intent** (trends vs. comparisons vs. composition)
- **Metric characteristics** (currency, percentages, counts)
- **Temporal aspects** (time-based vs. snapshot analysis)

## 📊 API Endpoints

### Chart Generation
```
POST /chat
Content-Type: application/json

{
  "prompt": "Show me revenue trends by sales channel"
}
```

**Response includes:**
- Chart specification (type, metric, date range)
- Processed data ready for visualization
- Request ID for audit tracking
- Data analysis summary (total metrics, suggestions)

### Audit Statistics
```
GET /audit/stats
```

**Returns:**
- Total requests processed
- Today's activity
- Chart type breakdown
- Average response times
- Usage patterns

## 🔍 Sample Data Structure

The system works with complex business data like:

```json
{
  "totalGrossSales": 3347321.04,
  "sales": [
    {"date": "2025-06-01", "value": 87589.85},
    {"date": "2025-06-02", "value": 79724.74}
  ],
  "dataBySalesConnectors": [
    {
      "connector": "Shopify",
      "grossSales": 45230.12,
      "netSales": 42180.45,
      "orders": 156
    }
  ],
  "cashDetails": {
    "account_12345": {
      "name": "Primary Operating",
      "current": 125000.50,
      "available": 120000.00
    }
  }
}
```

**Discovered Metrics Examples:**
- `totalGrossSales` → Scalar currency metric
- `sales` → Time series showing daily trends  
- `dataBySalesConnectors` → Embedded metrics container
- `dataBySalesConnectors.grossSales` → Grouped series by connector
- `cashDetails` → Dynamic key object for accounts
- `cashDetails.current` → Account-level cash analysis

## 🚀 Performance & Scalability

### Intelligent Caching
- **Lazy Loading**: Data loaded and analyzed on first request
- **Analysis Caching**: Metric discovery results cached in memory
- **Depth Limiting**: Recursive analysis limited to 5 levels

### Audit Efficiency
- **Background Logging**: Non-blocking audit operations
- **Daily Summaries**: Lightweight overview files
- **Automatic Cleanup**: Configurable retention policies

## 🔍 Troubleshooting

### Enhanced Debugging
1. **Data Analysis Issues**: Check console for metric discovery details
2. **Chart Generation Errors**: Review audit logs for full request context
3. **Performance Problems**: Monitor audit statistics for patterns

### Common Solutions
- **"Metric not found"**: The enhanced system discovers metrics automatically
- **"No data returned"**: Check date range format (YYYY or YYYY-MM)
- **"Chart not rendering"**: Verify data structure in audit logs

## 🎯 Business Use Cases

### Financial Analysis
- Revenue trends and forecasting
- Account-level cash flow analysis
- Expense category breakdowns
- Profit margin analysis by channel

### Sales Performance
- Channel performance comparison
- Regional sales analysis
- Order volume trends
- Conversion rate tracking

### Operational Metrics
- Customer acquisition analysis
- Product performance metrics
- Geographic performance patterns
- Time-based operational efficiency

## 🔒 Security & Compliance

### Audit Trail
- **Complete Request Logging**: Every chart request is permanently logged
- **Data Context**: Full data used for each chart is recorded
- **User Activity Tracking**: Detailed prompt and response logging
- **Compliance Ready**: Built-in audit features for regulatory requirements

### Data Privacy
- Audit logs excluded from version control
- Configurable data retention policies
- Secure file system permissions

## 🚀 Production Deployment

### Backend Production Build
```bash
cd server
npm run build
npm start
```

### Frontend Production Build
```bash
cd web
npm run build
npm start
```

### Environment Configuration
- Set `OPENAI_API_KEY` in production environment
- Configure `config.ts` for production data sources
- Set up proper file permissions for audit directory
- Configure monitoring for audit log storage

## 📈 Advanced Features

### AI-Powered Insights
- **Context-Aware Prompting**: GPT-4 receives full data analysis
- **Smart Chart Selection**: AI chooses optimal visualization types
- **Natural Language Processing**: Handles complex business queries
- **Intelligent Fallbacks**: Graceful handling of ambiguous requests

### Business Intelligence
- **Multi-Dimensional Analysis**: Support for complex data relationships
- **Account-Level Insights**: Individual entity performance tracking
- **Channel Attribution**: Sales performance by connector/source
- **Temporal Analysis**: Time-based pattern recognition

## 📝 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/enhancement`)
3. Test with the enhanced sample data
4. Ensure audit logging works correctly
5. Commit your changes (`git commit -m 'Add enhancement'`)
6. Push to the branch (`git push origin feature/enhancement`)
7. Open a Pull Request

## 📧 Support

For support with the enhanced features:
- Check audit logs for detailed request information
- Review data analysis output for metric discovery
- Monitor audit statistics for usage patterns
- Open issues in the GitHub repository

---

**Built with ❤️ using NestJS, Next.js, OpenAI GPT-4, and ag-charts-react**

*Transform your business data into actionable insights with AI-powered chart generation*
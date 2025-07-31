# Chat → Chart: AI-Powered Business Intelligence

Transform natural language into intelligent business charts using AI and automated data discovery.

## 🛠️ Tech Stack

**Backend (NestJS)**
- **NestJS** - Node.js framework for scalable server-side applications
- **OpenAI GPT-4** - Natural language processing and chart specification generation
- **TypeScript** - Type safety and enhanced developer experience

**Frontend (Next.js)**
- **Next.js** - React framework for server-side rendering and static generation
- **ag-charts-react** - Professional chart rendering with interactive features
- **ag-grid-react** - Interactive data tables with advanced functionality
- **ag-grid-community** - Grid functionality with sorting, filtering & pagination
- **TypeScript** - Type safety across the frontend stack

## ✨ Key Features

- **Natural Language to Charts** - "Show me sales trends" → Professional line chart
- **Interactive Data Tables** - View chart data in sortable, filterable tables with pagination
- **Intelligent Data Discovery** - Automatically discovers 99+ metrics in complex business data
- **5 Chart Types** - Line, bar, stacked-bar, heatmap, waterfall charts
- **Smart AI Context** - GPT-4 receives comprehensive data analysis for optimal chart selection
- **Complete Audit Trail** - Every chart generation logged for compliance and debugging
- **Advanced Dashboard Generation** - Create multi-chart dashboards with contextual insights
- **Real-time Performance Analytics** - Monitor and analyze chart generation statistics

## 🏗️ Service Architecture

The application follows a modular service-oriented architecture with six core services that work together to transform natural language into intelligent visualizations.

### **AppController** - API Gateway & Orchestration
**Purpose**: Central controller that orchestrates all chart generation and dashboard creation workflows.

**Key Responsibilities**:
- Handles three main API endpoints: `/chat`, `/dashboard`, and `/dashboard/enhanced`
- Coordinates between OpenAI, data analysis, metrics processing, and audit services
- Implements comprehensive error handling with user-friendly error messages
- Manages request/response flow and performance timing

**API Endpoints**:
- **POST `/chat`** - Single chart generation from natural language
- **POST `/dashboard`** - Multi-chart dashboard generation
- **POST `/dashboard/enhanced`** - Advanced dashboard with rich context and requirements
- **GET `/audit/stats`** - Audit statistics for monitoring and analysis

**Error Handling**: Sophisticated error categorization and user-friendly messaging for different failure scenarios.

### **OpenAiService** - AI Integration & Natural Language Processing
**Purpose**: Bridges natural language requests with structured chart specifications using GPT-4.

**Core Functionality**:
- **Intelligent Prompt Engineering**: Comprehensive system prompts that guide GPT-4 in optimal chart selection
- **Tool Schema Definition**: Structured JSON schema for consistent chart specification output
- **Context-Aware Processing**: Leverages data analysis results to inform chart type recommendations
- **Chart Type Selection Logic**: Built-in guidelines for matching user intent with appropriate visualizations

**Chart Type Intelligence**:
- **Line Charts**: Time series trends, growth patterns, temporal analysis
- **Bar Charts**: Categorical comparisons, discrete value analysis
- **Stacked Bar Charts**: Composition analysis, part-to-whole relationships
- **Heatmaps**: Pattern analysis, correlation visualization, intensity mapping
- **Waterfall Charts**: Sequential impact analysis, cumulative changes

**Advanced Features**:
- Zero-temperature responses for deterministic outputs
- Comprehensive metric context injection
- Intent-based chart type selection
- Date range optimization based on analysis type

### **DataAnalysisService** - Intelligent Metric Discovery Engine
**Purpose**: Automatically discovers, categorizes, and analyzes metrics in complex business datasets.

**Advanced Metric Discovery**:
- **Recursive Analysis**: Deep traversal of nested data structures up to 10 levels
- **Dynamic Type Detection**: Identifies scalar, time series, grouped series, arrays, and dynamic key objects
- **Value Type Classification**: Automatically categorizes as currency, percentage, count, or generic
- **Embedded Metrics Extraction**: Discovers metrics within complex nested structures

**Metric Types Supported**:
- **Scalar**: Single numerical values (totals, aggregates)
- **Time Series**: Date/value pairs showing trends over time
- **Grouped Series**: Multi-category data with time dimensions
- **Dynamic Key Objects**: Account-level data with variable keys
- **Embedded Metrics**: Complex nested structures with multiple sub-metrics
- **Arrays**: Simple collections of values

**Intelligence Features**:
- **Chart Recommendation Engine**: Suggests optimal chart types based on data characteristics
- **Flexible Metric Matching**: Partial and fuzzy matching for user queries
- **Context Generation**: Creates rich descriptions for AI model context
- **Confidence Scoring**: Rates chart type suggestions with confidence levels

### **MetricsService** - Data Processing & Transformation Engine
**Purpose**: Processes raw business data and transforms it into chart-ready formats with intelligent filtering.

**Data Processing Capabilities**:
- **Smart Caching**: Efficient data loading and caching for improved performance
- **Flexible Date Filtering**: Supports YYYY and YYYY-MM date range formats
- **Multiple Data Structure Handling**: Processes all metric types discovered by DataAnalysisService
- **Intelligent Path Resolution**: Handles nested metric paths with dot notation

**Specialized Processing Methods**:
- **Time Series Processing**: Converts date/value arrays to chart format with date filtering
- **Grouped Series Processing**: Handles multi-category time-based data with proper grouping
- **Nested Grouped Series**: Processes complex nested paths like `dataBySalesConnectors.grossSales`
- **Dynamic Object Processing**: Extracts metrics from account-level data structures
- **Embedded Metrics Processing**: Handles arrays of objects with multiple numeric properties

**Output Format Standardization**:
All processed data follows a consistent format:
```typescript
{
  dates: string[],        // X-axis labels (dates, categories, etc.)
  values: [{
    label: string,        // Series name
    values: number[]      // Y-axis values
  }]
}
```

### **AuditService** - Compliance & Analytics Engine
**Purpose**: Comprehensive logging and monitoring system for chart generation activities.

**Audit Capabilities**:
- **Complete Request Logging**: Captures user prompts, chart specs, data used, and metadata
- **Performance Tracking**: Records response times and metrics processing statistics
- **Daily Summary Generation**: Creates aggregated logs for efficient querying
- **Statistical Analysis**: Provides chart type breakdowns and usage analytics

**Compliance Features**:
- **Unique Request IDs**: Generates traceable identifiers for every chart request
- **Timestamped Entries**: ISO format timestamps for precise audit trails
- **Data Source Tracking**: Records which data files were used for each chart
- **Error Logging**: Captures and logs failures for debugging and analysis

**Storage & Management**:
- **File-based Logging**: Saves individual chart generation logs as JSON files
- **Directory Management**: Automatically creates and manages audit log directories
- **Efficient Statistics**: Optimized statistical queries with sampling for large datasets
- **Data Retention**: Configurable retention policies for audit data

### **DashboardService** - Multi-Chart Dashboard Generation
**Purpose**: Orchestrates the creation of comprehensive dashboards with multiple related visualizations.

**Dashboard Generation Modes**:
- **Standard Dashboard**: Basic multi-chart generation from simple prompts
- **Enhanced Dashboard**: Context-aware generation with rich requirements and structured inputs
- **Caching System**: Prevents duplicate dashboard generation with 5-minute cache duration

**Intelligent Chart Selection**:
- **Related Metrics Discovery**: Identifies metrics related to user prompts using keyword analysis
- **Context-Aware Generation**: Adapts chart generation based on audience and analysis type
- **Duplicate Prevention**: Automatically detects and prevents duplicate chart specifications
- **Performance Optimization**: Parallel chart data fetching for improved performance

**Advanced Features**:
- **Layout Management**: Configurable grid, stacked, or tabbed layouts
- **Insight Generation**: AI-powered insights based on dashboard content and context
- **Requirements Processing**: Handles complex dashboard requirements with structured filtering
- **Cache Management**: Intelligent caching with automatic cleanup and expiration

**Dashboard Contexts**:
- **Executive**: High-level KPIs and summary metrics
- **Analyst**: Detailed metrics for deep-dive analysis
- **Operational**: Real-time and actionable metrics
- **Custom**: Flexible context-based generation

## 📡 API Endpoints

### Generate Single Chart
Transform natural language into a single chart with comprehensive data analysis.

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
  "data": {
    "dates": ["2025-06-01", "2025-06-02", "2025-06-03"],
    "values": [{
      "label": "Gross Sales Trends",
      "values": [87589.85, 79724.74, 84655.08]
    }]
  },
  "requestId": "1703123456789-abc123def",
  "originalPrompt": "Show me revenue trends by sales channel",
  "dataAnalysis": {
    "totalMetrics": 99,
    "suggestedChartTypes": ["line", "bar"]
  }
}
```

### Generate Multi-Chart Dashboard
Create comprehensive dashboards with multiple related visualizations.

```bash
POST http://localhost:4000/dashboard
Content-Type: application/json

{
  "prompt": "Sales performance overview",
  "maxCharts": 5,
  "dateRange": "2025-06",
  "generateInsights": true
}
```

### Enhanced Dashboard Generation
Advanced dashboard creation with rich context and structured requirements.

```bash
POST http://localhost:4000/dashboard/enhanced
Content-Type: application/json

{
  "prompt": "Executive sales dashboard",
  "requirements": {
    "intent": "Monthly sales performance review",
    "analysisType": "performance",
    "dataScope": {
      "metrics": ["totalGrossSales", "dataBySalesConnectors"],
      "timeRange": { "type": "relative", "period": "last30days" }
    },
    "visualization": {
      "layout": "grid",
      "maxCharts": 4,
      "preferredChartTypes": ["line", "bar"]
    },
    "context": {
      "audience": "executive",
      "purpose": "reporting"
    }
  },
  "generateInsights": true
}
```

### Audit Statistics
Monitor chart generation performance and usage analytics.

```bash
GET http://localhost:4000/audit/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalRequests": 247,
    "todayRequests": 12,
    "chartTypeBreakdown": {
      "line": 89,
      "bar": 76,
      "stacked-bar": 45,
      "heatmap": 23,
      "waterfall": 14
    },
    "averageResponseTime": 1247
  }
}
```

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
OPENAI_API_KEY=openai_api_key_here
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

| **Query** | **Result** | **Service Flow** |
|-----------|------------|------------------|
| "Show me sales trends" | Line chart with time series data | DataAnalysis → OpenAI → Metrics → Audit |
| "Compare revenue by channel" | Bar chart grouped by sales connector | DataAnalysis → OpenAI → Metrics → Audit |
| "June performance breakdown" | Filtered data for June 2025 | DataAnalysis → OpenAI → Metrics → Audit |
| "Sales dashboard" | Multi-chart dashboard | Dashboard → (Multiple chart generations) → Audit |

## 📁 Project Structure

```
├── server/                              # NestJS Backend
│   ├── src/
│   │   ├── app.controller.ts           # 🎯 Main API endpoints & orchestration
│   │   ├── openai.service.ts           # 🤖 GPT-4 integration & NLP processing
│   │   ├── data-analysis.service.ts    # 🔍 Intelligent metric discovery engine
│   │   ├── metrics.service.ts          # 📊 Data processing & transformation
│   │   ├── dashboard.service.ts        # 📈 Multi-chart dashboard generation
│   │   ├── audit.service.ts            # 📋 Compliance & audit logging
│   │   ├── chat.dto.ts                 # 📝 Data transfer objects & validation
│   │   └── main.ts                     # 🚀 Application entry point
│   ├── sample-june-metrics.json        # 📁 Sample business data
│   └── audit-logs/                     # 📂 Generated audit logs
├── web/                                # Next.js Frontend  
│   ├── components/
│   │   ├── ChatBox.tsx                 # 💬 User input interface
│   │   ├── ChartView.tsx               # 📊 Chart rendering & data tables
│   │   ├── DashboardView.tsx           # 📈 Multi-chart dashboard display
│   │   └── DashboardBuilder.tsx        # 🔧 Dashboard configuration interface
│   └── pages/index.tsx                 # 🏠 Main application page
```

## 🔧 Configuration

### Data Source Configuration
The data source file is configured in `server/src/app.controller.ts`:
```typescript
export const DATA_SOURCE_FILE = 'sample-june-metrics.json';
```

### Supported Data Types & Structures
The system intelligently processes various data formats:

- **Scalar Values** - Single metrics (`totalRevenue: 150000`)
- **Time Series** - Date/value arrays (`sales: [{date: "2025-06-01", value: 1000}]`)
- **Grouped Series** - Multi-category data over time with dates/values structure
- **Dynamic Objects** - Account-level data (`cashDetails: {"account_123": {...}}`)
- **Embedded Metrics** - Complex nested structures with multiple sub-metrics
- **Arrays** - Simple collections of numerical values

## 🔍 How It Works - Complete Data Flow

### Single Chart Generation
1. **Request Processing** - AppController receives natural language prompt
2. **Data Analysis** - DataAnalysisService discovers and categorizes all available metrics
3. **AI Processing** - OpenAiService sends context-rich prompt to GPT-4 for chart specification
4. **Data Transformation** - MetricsService processes raw data into chart-ready format
5. **Audit Logging** - AuditService logs complete request/response for compliance
6. **Response** - Structured chart data returned to frontend for rendering

### Dashboard Generation
1. **Requirements Analysis** - DashboardService analyzes prompt and requirements
2. **Metric Discovery** - Identifies related metrics using intelligent keyword matching
3. **Parallel Processing** - Generates multiple chart specifications concurrently
4. **Data Fetching** - Parallel data processing for all dashboard charts
5. **Layout Management** - Organizes charts in optimal grid/stacked/tabbed layouts
6. **Insight Generation** - AI-powered insights based on dashboard content
7. **Caching** - Results cached to prevent duplicate generation

### Intelligent Metric Discovery Process
1. **Recursive Traversal** - Deep analysis of nested data structures
2. **Type Classification** - Automatic categorization of metric types
3. **Value Analysis** - Detection of currency, percentage, count, and generic values
4. **Recommendation Engine** - Chart type suggestions based on data characteristics
5. **Context Generation** - Rich descriptions for AI model optimization

## 📈 Production Deployment

### Backend Deployment
```bash
cd server
npm run build
npm start
```

### Frontend Deployment
```bash
cd web
npm run build
npm start
```

### Production Environment Variables
**Required**:
- `OPENAI_API_KEY` - Your OpenAI API key for GPT-4 access

**Optional Production Settings**:
- Configure proper file permissions for audit directory
- Set up monitoring for audit log storage and rotation
- Implement database storage for audit logs (current: file-based)
- Configure load balancing for high-traffic scenarios

### Performance Considerations
- **Caching**: Data and dashboard results are cached for improved performance
- **Parallel Processing**: Multiple charts processed concurrently in dashboards
- **Optimized Queries**: Statistical analysis uses sampling for large datasets
- **Memory Management**: Efficient data structure processing with depth limits

### Monitoring & Analytics
- **Audit Statistics**: Real-time monitoring of chart generation performance
- **Usage Analytics**: Chart type breakdowns and user interaction patterns
- **Performance Metrics**: Response time tracking and optimization insights
- **Error Tracking**: Comprehensive error logging for debugging and improvement
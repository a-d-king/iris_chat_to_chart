# Iris Finance Chat → Chart Data Flow Documentation

This document provides a comprehensive technical walkthrough of how user requests transform into interactive charts and dashboards, covering every component, service, and data transformation step in the Iris Finance Chat → Chart AI Platform.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture Components](#architecture-components)
- [Single Chart Flow (POST /v1/chat)](#single-chart-flow-post-v1chat)
- [Dashboard Flow (POST /v1/dashboard)](#dashboard-flow-post-v1dashboard)
- [Data Transformation Pipeline](#data-transformation-pipeline)
- [AI Reasoning Pipeline](#ai-reasoning-pipeline)
- [Error Handling & Recovery](#error-handling--recovery)
- [Observability & Tracing](#observability--tracing)
- [Performance Optimization](#performance-optimization)

---

## Overview

The Iris Finance Chat → Chart platform transforms natural language queries into sophisticated business visualizations through a multi-stage pipeline involving:

1. **Request Processing & Validation**
2. **Data Discovery & Analysis**
3. **Advanced AI Reasoning**
4. **Chart Specification Generation**
5. **Data Transformation & Slicing**
6. **Response Assembly & Audit**

Each stage involves multiple services working in coordination, with comprehensive error handling, caching, and observability throughout the process.

---

## Architecture Components

### Frontend Layer (Next.js)
- **`pages/index.tsx`**: Main application orchestrator
- **`components/ChatBox.tsx`**: User interface and API communication
- **`components/DateRangeSelector.tsx`**: Date range input processing
- **`components/ChartView.tsx`**: AG Charts visualization rendering
- **`components/DashboardView.tsx`**: Multi-chart dashboard layout
- **`components/FeedbackWidget.tsx`**: User feedback collection

### API Layer (NestJS)
- **`AppController`**: Main API endpoints with validation and tracing
- **Versioned routing**: All endpoints under `/v1/*` namespace
- **Swagger documentation**: Interactive API docs at `/docs`

### Core Services
- **`OpenAiService`**: GPT-4 integration with function calling
- **`MetricsService`**: Data management and transformation
- **`DataAnalysisService`**: Metric discovery and quality assessment
- **`ReasoningService`**: Advanced decision-making algorithms
- **`DashboardService`**: Multi-chart orchestration
- **`AuditService`**: Comprehensive logging and compliance

### Reasoning Engine
- **`IntentAnalyzerService`**: Natural language understanding
- **`ChartRankerService`**: Systematic chart type evaluation
- **`ChartDataSlicerService`**: Data transformation strategies

### External Integrations
- **`IrisApiService`**: Iris Finance API integration
- **Langfuse**: Observability and performance monitoring
- **OpenAI GPT-4**: AI reasoning and decision making

### Workflow Orchestration
- **LangGraph**: Dashboard generation workflow management
- **State management**: Comprehensive workflow state tracking
- **Error recovery**: Graceful handling of workflow failures

---

## Single Chart Flow (POST /v1/chat)

### Request Entry Point

**Endpoint**: `POST /v1/chat`

**Example Request**:
```json
{
  "prompt": "Show revenue trends for Q4 2025",
  "dateRange": "2025-10,2025-12"
}
```

### Step 1: Request Validation & Processing

**Location**: `AppController.chat()` - `app.controller.ts:37-170`

```typescript
// 1.1 Validate request using ChatDto
const validatedRequest = await ValidationPipe.transform(body);
// Result: { prompt: "Show revenue trends for Q4 2025", dateRange: "2025-10,2025-12" }

// 1.2 Initialize tracing
const trace = startTrace('endpoint.chat', { body });
const startTime = Date.now();

// 1.3 Determine effective date range
const effectiveDateRange = body.dateRange || undefined;
```

### Step 2: Data Loading & Analysis

**Location**: `MetricsService.getDataAnalysis()` - `metrics.service.ts:60-76`

#### 2.1 Cache Check & Data Loading
```typescript
// Cache key generation based on date range
const cacheKey = effectiveDateRange || 'default';

if (!this.cache.has(cacheKey)) {
  // Load data from Iris Finance API
  const rawData = await this.irisApiService.fetchMetrics(effectiveDateRange);
  
  // Analyze data structure and discover metrics
  const analysis = await this.dataAnalysisService.analyzeData(rawData);
  
  // Cache results for future requests
  this.cache.set(cacheKey, { rawData, analysis });
}
```

#### 2.2 Iris Finance API Integration

**Location**: `IrisApiService.fetchMetrics()` - `iris-api.service.ts:45-109`

```typescript
// 2.2.1 Date Range Processing
const { startDate, endDate } = this.parseDateRange("2025-10,2025-12");
// Result:
// startDate: "2025-10-01T00:00:00.000Z"
// endDate: "2025-12-31T23:59:59.999Z"

// 2.2.2 API Payload Construction
const payload = {
  filters: {
    startDate: "2025-10-01T00:00:00.000Z",
    endDate: "2025-12-31T23:59:59.999Z",
    isCashRefundSelected: false,
    salesChannels: {
      DTC: {
        channels: {
          "Amazon Seller Partner": { stores: { US: { subchannels: ["amazon"] }}},
          Shopify: { stores: { yoprettyboy: { subchannels: ["buy button", "point of sale"] }}}
        }
      },
      Wholesale: { channels: {} }
    }
  }
};

// 2.2.3 HTTP Request with Authentication
const response = await this.httpService.post(
  this.IRIS_API_URL,
  payload,
  { headers: this.buildIrisHeaders() }
).toPromise();
```

#### 2.3 Data Structure Analysis

**Location**: `DataAnalysisService.analyzeData()` - `data-analysis.service.ts:44-54`

```typescript
// 2.3.1 Recursive Metric Extraction
const metrics = this.extractMetricsRecursively(rawData);

// Example discovered metrics:
const discoveredMetrics = [
  {
    name: "totalGrossSales",
    type: "scalar",
    description: "Total gross sales",
    hasTimeData: false,
    hasGrouping: false,
    valueType: "currency",
    chartRecommendations: ["bar"]
  },
  {
    name: "salesTrends",
    type: "groupedSeries", 
    description: "Sales trends by channel over time",
    hasTimeData: true,
    hasGrouping: true,
    groupingDimensions: ["Shopify", "Amazon"],
    valueType: "currency",
    chartRecommendations: ["line", "bar", "stacked-bar"]
  },
  {
    name: "dataBySalesChannels",
    type: "embeddedMetrics",
    description: "Sales channels with multiple metrics",
    hasTimeData: false,
    hasGrouping: true,
    groupingDimensions: ["Shopify", "Amazon"],
    valueType: "generic",
    embeddedMetrics: ["grossSales", "netSales", "orders"],
    chartRecommendations: ["bar", "stacked-bar"]
  }
];

// 2.3.2 Chart Type Recommendations
const suggestions = this.generateChartSuggestions(metrics);
// Result:
const chartSuggestions = [
  {
    chartType: "line",
    confidence: 0.92,
    reason: "Multiple time-series metrics with consistent value types",
    bestForMetrics: ["salesTrends"]
  },
  {
    chartType: "stacked-bar", 
    confidence: 0.85,
    reason: "Categorical data with composition analysis potential",
    bestForMetrics: ["dataBySalesChannels"]
  }
];

// 2.3.3 Context Generation
const dataContext = this.generateDataContext(metrics, rawData);
// Result: Compact description for AI prompt context
```

### Step 3: AI-Powered Chart Generation

**Location**: `OpenAiService.prompt()` - `openai.service.ts:55-66`

#### 3.1 Reasoning Phase

```typescript
// 3.1.1 Generate AI Reasoning
const reasoningResponse = await this.generateReasoning(prompt, dataAnalysis);
```

**GPT-4 Reasoning Output:**
```text
STEP 1 - ANALYZE USER INTENT:
User wants to see "revenue trends for Q4 2025" - this indicates:
- Temporal analysis (trends over time)
- Specific time period (Q4 = Oct-Dec 2025) 
- Financial metric focus (revenue)

STEP 2 - EVALUATE AVAILABLE DATA:
Found "salesTrends" metric with temporal data covering Q4 2025:
- Type: groupedSeries with time dimension
- Value type: currency (matches revenue intent)
- Grouping: By sales channels (Shopify, Amazon)
- Time coverage: Includes Q4 2025 data

STEP 3 - CHART VISUALIZATION PRINCIPLES:
- Line charts: Best for temporal trends ✓
- Bar charts: Good for period comparisons ✓ 
- Stacked-bar: Useful for channel composition ✓
Since user specifically asked for "trends", line chart is optimal.

STEP 4 - MATCH DATA TO VISUALIZATION:
salesTrends has perfect data structure:
- Time series: dates array with values
- Multiple series: One per sales channel
- Consistent currency formatting

STEP 5 - FINAL DECISION:
Recommend line chart with salesTrends metric for Q4 2025 trend analysis.
Confidence: High (0.88) - perfect data-intent alignment.
```

#### 3.2 Decision Phase

```typescript
// 3.2.1 Make Structured Decision
const chartSpec = await this.makeReasonedDecision(prompt, dataAnalysis, reasoning);
```

**GPT-4 Function Call:**
```json
{
  "chartType": "line",
  "metric": "salesTrends", 
  "dateRange": "2025-10,2025-12"
}
```

#### 3.3 Reasoning Summary Generation

```typescript
// 3.3.1 Generate Condensed Summary
const reasoningSummary = this.generateReasoningSummary(reasoning, chartSpec);
```

**Final Reasoning Summary:**
```json
{
  "intent": "temporal_trend",
  "rationale_points": [
    "Time series data available for Q4 2025",
    "Revenue trends explicitly requested", 
    "Multi-channel data enables comparison"
  ],
  "confidence": 0.88,
  "decisions": [
    {
      "name": "chart_type",
      "choice": "line", 
      "why": "optimal for temporal trend visualization"
    },
    {
      "name": "metric_selection",
      "choice": "salesTrends",
      "why": "best match for revenue trends with time dimension"
    }
  ]
}
```

### Step 4: Data Transformation & Slicing

**Location**: `MetricsService.slice()` - `metrics.service.ts:77-137`

#### 4.1 Strategy Selection

```typescript
// 4.1.1 Determine metric type and select strategy
const metricInfo = this.findMetricInfo("salesTrends", analysis);
// Result: { type: "groupedSeries", ... }

const strategy = this.chartDataSlicerService.getStrategy("groupedSeries");
// Uses GroupedSeriesSlicingStrategy
```

#### 4.2 Data Slicing Process

**Location**: `GroupedSeriesSlicingStrategy.slice()` - `chart-data-slicer.service.ts:142-185`

```typescript
// 4.2.1 Input Raw Data
const rawSalesTrends = {
  salesTrends: {
    dates: ["2025-10-01", "2025-11-01", "2025-12-01"],
    values: [
      {
        label: "Shopify",
        values: [45000, 52000, 58000]
      },
      {
        label: "Amazon", 
        values: [28000, 31000, 35000]
      }
    ]
  }
};

// 4.2.2 Date Range Filtering
const filteredData = DateFilterUtil.filterByDateRange(
  rawSalesTrends.salesTrends,
  "2025-10,2025-12"
);

// 4.2.3 Chart Data Transformation
const chartData = {
  dates: ["2025-10-01", "2025-11-01", "2025-12-01"],
  values: [
    {
      label: "Shopify",
      values: [45000, 52000, 58000]
    },
    {
      label: "Amazon",
      values: [28000, 31000, 35000] 
    }
  ]
};
```

### Step 5: Response Assembly & Audit

#### 5.1 Response Construction

```typescript
// 5.1.1 Combine all components
const response = {
  chartType: "line",
  metric: "salesTrends",
  groupBy: undefined,
  dateRange: "2025-10,2025-12",
  data: chartData,
  requestId: "1703123456789-abc123",
  originalPrompt: "Show revenue trends for Q4 2025",
  reasoning_summary: reasoningSummary,
  dataAnalysis: {
    totalMetrics: 45,
    suggestedChartTypes: ["line", "bar"]
  }
};
```

#### 5.2 Audit Logging

**Location**: `AuditService.logChartGeneration()` - `audit.service.ts:45-95`

```typescript
// 5.2.1 Generate audit record
const auditRecord = {
  timestamp: "2025-08-25T14:30:00.000Z",
  requestId: "1703123456789-abc123",
  userPrompt: "Show revenue trends for Q4 2025",
  chartSpec: {
    chartType: "line",
    metric: "salesTrends", 
    dateRange: "2025-10,2025-12"
  },
  dataUsed: chartData,
  dataAnalysis: analysis,
  reasoning: {
    aiReasoning: "...", // Full GPT-4 reasoning text
    reasoning_summary: reasoningSummary
  },
  metadata: {
    dataSource: "Iris Finance API",
    responseTimeMs: 847,
    metricsCount: 45,
    cacheHit: true,
    qualityIssues: []
  }
};

// 5.2.2 Write to audit log file
await fs.writeFile(
  `audit-logs/chart-${requestId}.json`,
  JSON.stringify(auditRecord, null, 2)
);
```

#### 5.3 Tracing & Monitoring

```typescript
// 5.3.1 Complete Langfuse trace
trace.end({
  output: {
    chartType: response.chartType,
    metric: response.metric,
    responseTimeMs: Date.now() - startTime
  }
});
```

---

## Dashboard Flow (POST /v1/dashboard)

### Request Entry Point

**Endpoint**: `POST /v1/dashboard`

**Example Request**:
```json
{
  "prompt": "Executive sales overview for Q4 2025",
  "maxCharts": 5,
  "dateRange": "2025-10,2025-12",
  "generateInsights": true
}
```

### Step 1: Dashboard Service Orchestration

**Location**: `DashboardService.generateDashboard()` - `dashboard.service.ts:31-44`

```typescript
// 1.1 Initialize LangGraph workflow
const result = await runDashboardGraph(request, {
  metricsService: this.metricsService,
  identifyRelatedMetrics: this.identifyRelatedMetrics.bind(this),
  generateChartSpecs: this.generateChartSpecs.bind(this),
  generateInsights: this.generateInsights.bind(this),
  // ... other service bindings
});
```

### Step 2: LangGraph Workflow Execution

**Location**: `dashboard.graph.ts` - Complete workflow orchestration

#### 2.1 Workflow State Initialization

```typescript
// 2.1.1 Initial state
const initialState = {
  request: {
    prompt: "Executive sales overview for Q4 2025", 
    maxCharts: 5,
    dateRange: "2025-10,2025-12",
    generateInsights: true
  },
  dashboardId: undefined,
  dataAnalysis: undefined,
  selectedMetrics: [],
  chartSpecs: [],
  charts: [],
  insights: [],
  metadata: {},
  startTime: Date.now()
};
```

#### 2.2 Node 1: Data Analysis

```typescript
// 2.2.1 Load and analyze all available metrics
const dataAnalysis = await state.metricsService.getDataAnalysis(
  state.request.dateRange
);

// 2.2.2 Update workflow state
return {
  ...state,
  dataAnalysis,
  dashboardId: `dashboard_${Date.now()}_${generateId()}`
};
```

#### 2.3 Node 2: Metric Selection & Ranking

```typescript
// 2.3.1 Advanced reasoning for metric selection
const selectedMetrics = await state.identifyRelatedMetrics(
  state.request.prompt,
  state.dataAnalysis.availableMetrics.filter(m => 
    m.type !== 'scalar' && m.hasTimeData || m.hasGrouping
  ),
  state.request.maxCharts
);
```

**Location**: `DashboardService.identifyRelatedMetrics()` - `dashboard.service.ts:46-72`

```typescript
// 2.3.2 Use ReasoningService for intelligent selection
const analysis = this.reasoningService.analyzeAndRankMetrics(
  prompt,
  visualizableMetrics,
  maxCharts
);
```

**Location**: `ReasoningService.analyzeAndRankMetrics()` - `reasoning.service.ts:477-524`

```typescript
// 2.3.3 Intent Analysis
const intentAnalysis = await this.intentAnalyzer.performIntentAnalysis(prompt);
// Result:
{
  primaryIntent: { type: "performance_overview", confidence: 0.85 },
  secondaryIntents: [
    { type: "categorical_comparison", confidence: 0.72 },
    { type: "temporal_trend", confidence: 0.68 }
  ],
  temporalSignals: [
    { type: "quarterly", confidence: 0.9, keyword: "Q4" }
  ],
  explicitMetrics: ["sales", "executive", "overview"]
}

// 2.3.4 Metric Relevance Scoring
const scoredMetrics = await this.scoreMetricsForRelevance(
  intentAnalysis,
  metrics
);

// Example scored metrics:
[
  {
    metric: "salesTrends",
    score: 4.5,  // High relevance
    reasons: [
      "Exact match: sales/sales",
      "Perfect for temporal analysis", 
      "Executive-level overview metric"
    ]
  },
  {
    metric: "dataBySalesChannels", 
    score: 4.2,
    reasons: [
      "Partial match: sales/sales",
      "Ideal for categorical comparison",
      "Core business performance metric"
    ]
  },
  {
    metric: "revenueByProduct",
    score: 3.8,
    reasons: [
      "Revenue closely related to sales",
      "Product breakdown supports executive overview"
    ]
  }
]

// 2.3.5 Diversity Selection & Quality Assessment  
const finalSelection = this.selectDiverseMetrics(
  scoredMetrics,
  maxCharts
);
```

#### 2.4 Node 3: Chart Specification Generation

```typescript
// 2.4.1 Generate specs for each selected metric
const chartSpecs = await state.generateChartSpecs(
  state.selectedMetrics,
  state.request.prompt,
  state.dataAnalysis,
  state.request.dateRange
);
```

**Location**: `DashboardService.generateChartSpecs()` - `dashboard.service.ts:74-91`

```typescript
// 2.4.2 Process each metric in parallel
const specs = await Promise.all(
  selectedMetrics.map(async (metric) => {
    // Build contextual prompt for this metric
    const metricPrompt = this.buildContextualMetricPrompt(
      metric,
      originalPrompt,
      dataAnalysis
    );
    
    // Generate chart spec using AI
    const spec = await this.openAiService.prompt(metricPrompt, dataAnalysis);
    
    // Generate chart title
    const title = this.generateChartTitle(spec.metric, spec.chartType);
    
    return {
      ...spec,
      title,
      dateRange: requestDateRange || spec.dateRange
    };
  })
);

// 2.4.3 Remove duplicates
return this.deduplicateChartSpecs(specs);
```

#### 2.5 Node 4: Data Fetching & Transformation

```typescript
// 2.5.1 Process each chart spec to get data
const chartsWithData = await Promise.all(
  state.chartSpecs.map(async (spec, index) => {
    try {
      const data = await state.metricsService.slice(
        spec.metric,
        spec.dateRange,
        spec.groupBy
      );
      
      return {
        id: `chart_${Date.now()}_${generateId()}`,
        title: spec.title,
        chartType: spec.chartType,
        metric: spec.metric, 
        dateRange: spec.dateRange,
        row: index,
        col: 0,
        span: 4,  // Full width
        data
      };
    } catch (error) {
      console.error(`Failed to process chart ${spec.metric}:`, error);
      return null;
    }
  })
);

// Filter out failed charts
const charts = chartsWithData.filter(chart => chart !== null);
```

#### 2.6 Node 5: Insight Generation

```typescript
// 2.6.1 Generate AI-powered insights if requested
let insights = [];

if (state.request.generateInsights) {
  insights = await state.generateInsights(
    state.request.prompt,
    state.charts,
    state.dataAnalysis
  );
}
```

**Location**: `DashboardService.generateInsights()` - `dashboard.service.ts:116-141`

```typescript
// 2.6.2 Multiple insight generation strategies

// AI Contextual Insights
const aiInsights = await this.generateAIContextualInsights(
  prompt,
  charts,
  dataAnalysis
);

// Domain-specific Financial Insights
const domainInsights = this.generateFinancialDomainInsights(charts);

// Chart Composition Insights
const compositionInsights = this.generateSmartCompositionInsights(charts);

// 2.6.3 Prioritize and combine insights
const allInsights = [
  ...aiInsights,
  ...domainInsights, 
  ...compositionInsights
];

const prioritizedInsights = this.prioritizeInsights(allInsights, prompt);

// Return top 3 most relevant insights
return prioritizedInsights.slice(0, 3);
```

#### 2.7 Node 6: Finalization

```typescript
// 2.7.1 Assemble final response
const responseTimeMs = Date.now() - state.startTime;

return {
  ...state,
  metadata: {
    totalCharts: state.charts.length,
    responseTimeMs,
    suggestedInsights: state.insights
  }
};
```

### Step 3: Response & Audit

#### 3.1 Dashboard Response Assembly

```typescript
// 3.1.1 Complete dashboard structure
const dashboardResponse = {
  dashboardId: "dashboard_1703123456789_xyz",
  charts: [
    {
      id: "chart_1703123456789_abc123",
      title: "Sales Trends Overview",
      chartType: "line",
      metric: "salesTrends",
      dateRange: "2025-10,2025-12", 
      row: 0,
      col: 0,
      span: 4,
      data: {
        dates: ["2025-10-01", "2025-11-01", "2025-12-01"],
        values: [
          { label: "Shopify", values: [45000, 52000, 58000] },
          { label: "Amazon", values: [28000, 31000, 35000] }
        ]
      }
    },
    {
      id: "chart_1703123456790_def456",
      title: "Sales Channel Breakdown", 
      chartType: "stacked-bar",
      metric: "dataBySalesChannels",
      dateRange: "2025-10,2025-12",
      row: 1,
      col: 0,
      span: 4,
      data: {
        dates: ["Shopify", "Amazon"],
        values: [
          { label: "grossSales", values: [155000, 94000] },
          { label: "netSales", values: [148000, 89000] },
          { label: "orders", values: [1250, 680] }
        ]
      }
    }
  ],
  metadata: {
    totalCharts: 2,
    responseTimeMs: 1847,
    suggestedInsights: [
      "Cross-channel performance analysis shows strong Q4 growth across all channels",
      "Shopify maintains market leadership with 65% higher revenue than Amazon", 
      "Order value trends indicate improved customer acquisition and retention"
    ]
  }
};
```

#### 3.2 Comprehensive Audit Logging

```typescript
// 3.2.1 Dashboard audit record
const dashboardAudit = {
  timestamp: "2025-08-25T14:45:00.000Z", 
  requestId: "dashboard_1703123456789_xyz",
  userPrompt: "Executive sales overview for Q4 2025",
  chartSpec: {
    chartType: "dashboard",
    metric: "multiple",
    dateRange: "2025-10,2025-12"
  },
  dataUsed: dashboardResponse.charts,
  dataAnalysis: dataAnalysis,
  workflow: {
    steps: [
      { step: "data_analysis", duration: 245 },
      { step: "metric_selection", duration: 180 },
      { step: "spec_generation", duration: 890 }, 
      { step: "data_fetching", duration: 320 },
      { step: "insight_generation", duration: 212 }
    ],
    totalSteps: 5
  },
  metadata: {
    dataSource: "Iris Finance API",
    responseTimeMs: 1847,
    metricsCount: 2,
    cacheHits: 1,
    qualityIssues: [],
    insightsGenerated: true
  }
};
```

---

## Data Transformation Pipeline

### Metric Type Detection & Processing

The system handles six distinct metric types, each with specialized processing:

#### 1. Scalar Metrics
**Type**: Single numerical values  
**Strategy**: `ScalarSlicingStrategy`
**Example**: `totalGrossSales: 125000`

```typescript
// Processing
const chartData = {
  dates: ["Total"],
  values: [{ label: "Total Gross Sales", values: [125000] }]
};
```

#### 2. Time Series Metrics
**Type**: Temporal data with date/value pairs  
**Strategy**: `TimeSeriesSlicingStrategy`
**Example**: `{ dates: [...], values: [...] }`

```typescript
// Date filtering and transformation
const filteredData = DateFilterUtil.filterByDateRange(rawData, dateRange);
const chartData = {
  dates: filteredData.dates,
  values: [{ label: metricName, values: filteredData.values }]
};
```

#### 3. Grouped Series Metrics
**Type**: Multi-dimensional time series  
**Strategy**: `GroupedSeriesSlicingStrategy`
**Example**: Multiple series over time with grouping

```typescript
// Multi-series processing with date filtering
const chartData = {
  dates: rawData.dates,
  values: rawData.values.map(series => ({
    label: series.label,
    values: DateFilterUtil.filterByDateRange(series.values, dateRange)
  }))
};
```

#### 4. Embedded Metrics
**Type**: Objects containing multiple related metrics  
**Strategy**: `EmbeddedMetricsSlicingStrategy`
**Example**: Sales channels with grossSales, netSales, orders

```typescript
// Extract numeric metrics from objects
const categories = data.map(item => item.connector);
const numericKeys = Object.keys(data[0]).filter(key => 
  typeof data[0][key] === 'number'
);

const chartData = {
  dates: categories,
  values: numericKeys.map(key => ({
    label: key,
    values: data.map(item => item[key])
  }))
};
```

#### 5. Dynamic Key Objects
**Type**: Objects with variable key structures  
**Strategy**: `DynamicKeyObjectSlicingStrategy`
**Example**: `{ "category1": value1, "category2": value2, ... }`

```typescript
// Process variable key structures
const keys = Object.keys(rawData).filter(key => 
  typeof rawData[key] === 'number'
);

const chartData = {
  dates: keys,
  values: [{ 
    label: metricName, 
    values: keys.map(key => rawData[key])
  }]
};
```

#### 6. Array Metrics
**Type**: List-based data structures  
**Strategy**: `ArraySlicingStrategy`
**Example**: `[item1, item2, item3, ...]`

```typescript
// Array processing with categorization
const chartData = {
  dates: rawData.map((_, index) => `Item ${index + 1}`),
  values: [{ 
    label: metricName, 
    values: rawData.filter(value => typeof value === 'number')
  }]
};
```

---

## AI Reasoning Pipeline

### Intent Analysis Process

**Location**: `IntentAnalyzerService.performIntentAnalysis()`

#### Step 1: Keyword Extraction & Analysis
```typescript
// Extract meaningful keywords from user prompt
const keywords = this.analyzeKeywords(prompt);
// Result: ["executive", "sales", "overview", "Q4", "2025"]

// Identify explicit metrics mentioned
const explicitMetrics = this.identifyExplicitMetrics(keywords);
// Result: ["sales"]
```

#### Step 2: Temporal Signal Detection
```typescript
// Detect time-related patterns
const temporalSignals = this.detectTemporalSignals(prompt);
// Result: [
//   { type: "quarterly", confidence: 0.9, keyword: "Q4" },
//   { type: "yearly", confidence: 0.7, keyword: "2025" }
// ]
```

#### Step 3: Intent Classification
```typescript
// Categorize user intent across multiple dimensions
const primaryIntent = this.categorizeIntent(prompt, keywords);
// Result: { type: "performance_overview", confidence: 0.85 }

const secondaryIntents = this.identifySecondaryIntents(prompt, keywords);
// Result: [
//   { type: "categorical_comparison", confidence: 0.72 },
//   { type: "temporal_trend", confidence: 0.68 }
// ]
```

#### Step 4: Confidence Calculation
```typescript
// Multi-factor confidence assessment
const confidence = this.calculateConfidence({
  keywordMatches: 0.8,
  temporalClarity: 0.9, 
  intentSpecificity: 0.85,
  contextualRelevance: 0.75
});
// Result: 0.825 (weighted average)
```

### Chart Ranking Process

**Location**: `ChartRankerService.generateTopKCharts()`

#### Step 1: Data Compatibility Assessment
```typescript
// Evaluate each chart type against available data
const compatibilityScores = this.evaluateDataCompatibility(
  availableMetrics,
  ['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall']
);

// Example scoring:
{
  'line': {
    score: 0.92,
    reasons: ['Temporal data available', 'Multiple series supported']
  },
  'stacked-bar': {
    score: 0.85, 
    reasons: ['Categorical grouping present', 'Composition analysis possible']
  },
  'bar': {
    score: 0.78,
    reasons: ['Simple categorical comparison', 'Clear value representation']
  }
}
```

#### Step 2: Intent Alignment Scoring  
```typescript
// Match chart types to user intent
const intentAlignment = this.scoreIntentAlignment(
  intentAnalysis,
  chartTypes
);

// Results based on "performance overview" intent:
{
  'line': 0.88,      // Excellent for performance trends
  'stacked-bar': 0.82, // Good for performance breakdown
  'bar': 0.75       // Acceptable for performance comparison
}
```

#### Step 3: Visual Effectiveness Rating
```typescript
// Assess clarity and interpretability
const visualEffectiveness = this.evaluateVisualEffectiveness(
  chartTypes,
  dataCharacteristics
);

// Scoring based on data complexity and user needs
{
  'line': 0.90,      // Clear trend visualization
  'stacked-bar': 0.85, // Good composition clarity  
  'bar': 0.88       // Excellent comparison clarity
}
```

#### Step 4: Final Ranking & Selection
```typescript
// Weighted combination of all factors
const finalScores = chartTypes.map(type => ({
  chartType: type,
  score: (
    compatibilityScores[type] * 0.4 +
    intentAlignment[type] * 0.35 + 
    visualEffectiveness[type] * 0.25
  ),
  confidence: this.calculateConfidenceLevel(score),
  reasoning: this.generateReasoning(type, scores)
}));

// Sort and return top K recommendations
return finalScores
  .sort((a, b) => b.score - a.score)
  .slice(0, k)
  .map(result => ({
    ...result,
    confidenceLabel: this.getConfidenceLabel(result.confidence)
    // Labels: "Excellent", "Good", "Acceptable", "Poor", "Unsuitable"
  }));
```

---

## Error Handling & Recovery

### Error Categories & Processing

#### 1. API Connection Errors
```typescript
// OpenAI API failures
if (error.message.includes('OpenAI') || error.message.includes('tool call')) {
  throw new Error(
    'I had trouble understanding your request. Please try rephrasing it more clearly.'
  );
}

// Iris Finance API failures  
if (error.message.includes('Failed to fetch metrics')) {
  // Log detailed error for debugging
  console.error('Iris API Error:', {
    status: error.response?.status,
    data: error.response?.data,
    timestamp: new Date().toISOString()
  });
  
  throw new Error(
    'Unable to fetch data from Iris Finance. Please try again or contact support.'
  );
}
```

#### 2. Validation Errors
```typescript
// Date range validation
if (errorMessage.includes('Date range')) {
  throw new Error(
    'Invalid date range format. Please use YYYY or YYYY-MM format (e.g., "2025" or "2025-06").'
  );
}

// Metric validation
if (errorMessage.includes('not found in dataset')) {
  const availableMetrics = errorMessage.split('Available metrics:')[1];
  throw new Error(
    `I couldn't find the requested metric in the data. ${
      availableMetrics ? 'Available metrics: ' + availableMetrics : ''
    }`
  );
}
```

#### 3. Processing Errors
```typescript
// Unsupported metric types
if (errorMessage.includes('Unsupported metric type')) {
  throw new Error(
    'This metric type is not yet supported for visualization. Please try a different metric.'
  );
}

// Generic processing failures
throw new Error(
  'Something went wrong while generating your chart. Please try again or contact support.'
);
```

### Recovery Strategies

#### 1. AI Service Fallbacks
```typescript
// Primary AI call with fallback
try {
  const response = await this.openai.chat.completions.create(primaryPrompt);
  return response;
} catch (error) {
  console.warn('Primary AI call failed, trying fallback approach');
  
  // Simplified prompt for fallback
  const fallbackPrompt = this.generateSimplifiedPrompt(originalPrompt);
  return await this.openai.chat.completions.create(fallbackPrompt);
}
```

#### 2. Dashboard Workflow Recovery
```typescript
// LangGraph workflow with error recovery
const workflow = createWorkflow({
  nodes: {
    dataAnalysis: {
      func: async (state) => { /* ... */ },
      onError: async (state, error) => {
        console.error('Data analysis failed:', error);
        // Return minimal viable state
        return {
          ...state,
          dataAnalysis: { availableMetrics: [], suggestedChartTypes: [] }
        };
      }
    }
  }
});
```

#### 3. Cache Invalidation & Retry
```typescript
// Smart cache recovery
if (error.message.includes('cache')) {
  console.log('Invalidating cache and retrying...');
  this.cache.delete(cacheKey);
  
  // Retry with fresh data
  return await this.getDataAnalysis(dateRange);
}
```

---

## Observability & Tracing

### Langfuse Integration

#### 1. Endpoint Tracing
```typescript
// Complete request lifecycle tracing
const trace = startTrace('endpoint.chat', {
  input: { prompt, dateRange },
  metadata: { userId: 'system', version: '1.0' }
});

try {
  // Process request...
  const result = await processRequest(prompt, dateRange);
  
  // Success trace completion
  trace.end({
    output: {
      chartType: result.chartType,
      metric: result.metric,
      responseTimeMs: Date.now() - startTime
    },
    level: 'DEFAULT'
  });
  
} catch (error) {
  // Error trace completion
  trace.end({
    level: 'ERROR',
    statusMessage: error.message,
    metadata: {
      errorType: error.constructor.name,
      stackTrace: error.stack
    }
  });
}
```

#### 2. AI Interaction Tracing
```typescript
// OpenAI API call tracing
const aiTrace = startTrace('openai.generateReasoning', {
  input: { prompt: contextualPrompt, model: 'gpt-4' },
  metadata: { 
    promptLength: contextualPrompt.length,
    temperature: 0.1
  }
});

const response = await this.openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: contextualPrompt }],
  temperature: 0.1
});

aiTrace.end({
  output: {
    reasoning: response.choices[0].message.content,
    tokensUsed: response.usage.total_tokens,
    confidence: extractConfidence(response.choices[0].message.content)
  }
});
```

#### 3. Workflow Step Tracing
```typescript
// LangGraph node execution tracing
const nodeTrace = startTrace('workflow.metricSelection', {
  input: {
    prompt: state.request.prompt,
    availableMetrics: state.dataAnalysis.availableMetrics.length
  }
});

const selectedMetrics = await identifyRelatedMetrics(
  state.request.prompt,
  state.dataAnalysis.availableMetrics,
  state.request.maxCharts
);

nodeTrace.end({
  output: {
    selectedCount: selectedMetrics.length,
    metrics: selectedMetrics.map(m => m.name),
    selectionTime: Date.now() - nodeStartTime
  }
});
```

### Performance Monitoring

#### 1. Response Time Tracking
```typescript
// Comprehensive timing collection
const timings = {
  requestStart: Date.now(),
  dataAnalysisStart: 0,
  dataAnalysisEnd: 0,
  aiReasoningStart: 0, 
  aiReasoningEnd: 0,
  dataSlicingStart: 0,
  dataSlicingEnd: 0,
  requestEnd: 0
};

// Track each major phase
timings.dataAnalysisStart = Date.now();
const analysis = await getDataAnalysis(dateRange);
timings.dataAnalysisEnd = Date.now();

// Calculate phase durations
const performance = {
  dataAnalysisMs: timings.dataAnalysisEnd - timings.dataAnalysisStart,
  aiReasoningMs: timings.aiReasoningEnd - timings.aiReasoningStart,
  dataSlicingMs: timings.dataSlicingEnd - timings.dataSlicingStart,
  totalMs: timings.requestEnd - timings.requestStart
};
```

#### 2. Cache Performance Monitoring
```typescript
// Cache hit/miss ratio tracking
const cacheStats = {
  hits: 0,
  misses: 0,
  totalRequests: 0,
  
  recordHit() {
    this.hits++;
    this.totalRequests++;
  },
  
  recordMiss() {
    this.misses++;
    this.totalRequests++;
  },
  
  getHitRatio() {
    return this.totalRequests > 0 ? this.hits / this.totalRequests : 0;
  }
};
```

### Quality Metrics

#### 1. AI Confidence Tracking
```typescript
// Track AI decision confidence over time
const confidenceMetrics = {
  intentAnalysis: extractConfidence(intentAnalysis),
  chartRanking: extractConfidence(chartRanking),
  overallDecision: extractConfidence(finalDecision),
  
  // Track confidence trends
  recordConfidence(type, value) {
    this.confidenceHistory = this.confidenceHistory || {};
    this.confidenceHistory[type] = this.confidenceHistory[type] || [];
    this.confidenceHistory[type].push({
      value,
      timestamp: Date.now()
    });
  }
};
```

#### 2. Data Quality Assessment
```typescript
// Monitor data quality issues
const qualityAssessment = {
  unknownCategories: 0,
  typeInconsistencies: 0, 
  missingTemporalData: 0,
  excessiveCategorization: 0,
  
  // Generate quality report
  generateReport() {
    const totalIssues = this.unknownCategories + this.typeInconsistencies + 
                       this.missingTemporalData + this.excessiveCategorization;
    
    return {
      totalIssues,
      severity: totalIssues > 5 ? 'high' : totalIssues > 2 ? 'medium' : 'low',
      recommendations: this.generateRecommendations()
    };
  }
};
```

---

## Performance Optimization

### Caching Strategies

#### 1. Data Analysis Caching
```typescript
// Intelligent cache key generation
const generateCacheKey = (dateRange, filters = {}) => {
  const normalized = normalizeFilters(filters);
  return `analysis_${dateRange}_${JSON.stringify(normalized)}`;
};

// Cache with TTL and size limits
class DataAnalysisCache {
  private cache = new Map();
  private readonly maxSize = 100;
  private readonly ttl = 30 * 60 * 1000; // 30 minutes
  
  set(key, value) {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }
}
```

#### 2. AI Response Caching
```typescript
// Cache AI responses for identical prompts
class AIResponseCache {
  private cache = new Map();
  
  // Generate semantic hash of prompt + context
  private generatePromptHash(prompt, context) {
    const normalized = {
      prompt: prompt.toLowerCase().trim(),
      metricsCount: context.availableMetrics.length,
      suggestedTypes: context.suggestedChartTypes.sort()
    };
    return crypto.createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex')
      .substring(0, 16);
  }
  
  get(prompt, context) {
    const hash = this.generatePromptHash(prompt, context);
    return this.cache.get(hash);
  }
  
  set(prompt, context, response) {
    const hash = this.generatePromptHash(prompt, context);
    this.cache.set(hash, {
      response,
      timestamp: Date.now(),
      usageCount: 0
    });
  }
}
```

### Request Optimization

#### 1. Parallel Processing
```typescript
// Dashboard chart generation with parallel execution
const generateChartsInParallel = async (chartSpecs) => {
  const chartPromises = chartSpecs.map(async (spec, index) => {
    try {
      // Each chart processes independently
      const data = await metricsService.slice(
        spec.metric,
        spec.dateRange,
        spec.groupBy
      );
      
      return {
        ...spec,
        id: generateChartId(index),
        data,
        processingTime: Date.now() - chartStartTime
      };
    } catch (error) {
      console.error(`Chart ${spec.metric} failed:`, error);
      return null; // Failed charts are filtered out
    }
  });
  
  // Wait for all charts to complete or fail
  const results = await Promise.allSettled(chartPromises);
  
  // Return successful charts
  return results
    .filter(result => result.status === 'fulfilled' && result.value !== null)
    .map(result => result.value);
};
```

#### 2. Request Batching
```typescript
// Batch multiple API requests for efficiency
class RequestBatcher {
  private pending = new Map();
  private batchSize = 5;
  private batchTimeout = 100; // ms
  
  async batchRequest(key, requestFn) {
    return new Promise((resolve, reject) => {
      // Add to pending batch
      if (!this.pending.has(key)) {
        this.pending.set(key, {
          requests: [],
          timeout: setTimeout(() => this.executeBatch(key), this.batchTimeout)
        });
      }
      
      const batch = this.pending.get(key);
      batch.requests.push({ resolve, reject, requestFn });
      
      // Execute immediately if batch is full
      if (batch.requests.length >= this.batchSize) {
        clearTimeout(batch.timeout);
        this.executeBatch(key);
      }
    });
  }
  
  private async executeBatch(key) {
    const batch = this.pending.get(key);
    if (!batch) return;
    
    this.pending.delete(key);
    
    // Execute all requests in parallel
    const results = await Promise.allSettled(
      batch.requests.map(req => req.requestFn())
    );
    
    // Resolve/reject individual promises
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        batch.requests[index].resolve(result.value);
      } else {
        batch.requests[index].reject(result.reason);
      }
    });
  }
}
```

### Memory Management

#### 1. Large Dataset Handling
```typescript
// Stream processing for large datasets
const processLargeDataset = async function* (dataset) {
  const chunkSize = 1000;
  
  for (let i = 0; i < dataset.length; i += chunkSize) {
    const chunk = dataset.slice(i, i + chunkSize);
    const processedChunk = await processChunk(chunk);
    
    // Yield processed chunk and allow garbage collection
    yield processedChunk;
    
    // Allow event loop to process other tasks
    await new Promise(resolve => setImmediate(resolve));
  }
};
```

#### 2. Memory Monitoring
```typescript
// Monitor memory usage and trigger cleanup
class MemoryMonitor {
  private readonly maxMemoryMB = 512;
  private readonly checkInterval = 30000; // 30 seconds
  
  start() {
    setInterval(() => {
      const usage = process.memoryUsage();
      const usageMB = usage.heapUsed / 1024 / 1024;
      
      if (usageMB > this.maxMemoryMB) {
        console.warn(`High memory usage: ${usageMB.toFixed(2)}MB`);
        this.triggerCleanup();
      }
    }, this.checkInterval);
  }
  
  private triggerCleanup() {
    // Clear caches
    dataAnalysisCache.clear();
    aiResponseCache.clear();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('Memory cleanup completed');
  }
}
```

---

This comprehensive data flow documentation covers the complete journey of data through the Iris Finance Chat → Chart platform, from initial user input to final visualization, including all error handling, optimization, and monitoring capabilities. Each component is designed to work together seamlessly while maintaining high performance, reliability, and observability.

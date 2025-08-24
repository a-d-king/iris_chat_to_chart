Complete Data Flow: User Prompt → Dashboard JSON

  User Request → AppController.generateDashboard() →
  ├── startTrace('endpoint.dashboard') [Langfuse Tracing]
  ├── DashboardService.generateDashboard() →
  │   └── runDashboardGraph() [LangGraph Orchestration] →
  │       ├── [Step 1: Data Loading & Analysis]
  │       │   ├── MetricsService.getDataAnalysis() →
  │       │   │   ├── MetricsService.load() →
  │       │   │   │   ├── IrisApiService.fetchMetrics() →
  │       │   │   │   │   ├── parseDateRange() [Date Processing]
  │       │   │   │   │   ├── buildIrisHeaders() [Auth Headers]
  │       │   │   │   │   └── HttpService.post() [External API Call]
  │       │   │   │   └── DataAnalysisService.analyzeData() →
  │       │   │   │       ├── extractMetricsRecursively() [Metric Discovery]
  │       │   │   │       │   ├── analyzeMetric() [Individual Analysis]
  │       │   │   │       │   ├── analyzeArrayMetric() [Array Processing]
  │       │   │   │       │   ├── analyzeObjectMetric() [Object Processing]
  │       │   │   │       │   ├── extractFromObjectArray() [Embedded Metrics]
  │       │   │   │       │   ├── extractFromDynamicKeyObject() [Dynamic Keys]
  │       │   │   │       │   └── detectValueType() [Currency/Count/etc.]
  │       │   │   │       ├── generateChartSuggestions() →
  │       │   │   │       │   ├── generateMetricSpecificSuggestions()
  │       │   │   │       │   ├── generateCombinationSuggestions()
  │       │   │   │       │   ├── scoreMetricDataCompatibility()
  │       │   │   │       │   └── scoreVisualEffectiveness()
  │       │   │   │       └── generateDataContext() [Context Generation]
  │       │   │   └── [Cache Storage]
  │       │   └── [Return DataAnalysis Object]
  │       │
  │       ├── [Step 2: Metric Selection & Ranking]
  │       │   └── DashboardService.identifyRelatedMetrics() →
  │       │       └── ReasoningService.analyzeAndRankMetrics() →
  │       │           ├── IntentAnalyzerService.performIntentAnalysis() →
  │       │           │   ├── analyzeKeywords() [Keyword Extraction]
  │       │           │   ├── detectTemporalSignals() [Time Analysis]
  │       │           │   ├── categorizeIntent() [Intent Classification]
  │       │           │   └── calculateConfidence() [Confidence Scoring]
  │       │           ├── scoreMetricsForRelevance() →
  │       │           │   ├── calculateLevenshteinSimilarity() [Fuzzy Matching]
  │       │           │   └── levenshteinDistance() [String Distance]
  │       │           ├── analyzeMetricQuality() [Quality Assessment]
  │       │           ├── applyBusinessContextBoosts() [Domain Knowledge]
  │       │           ├── selectDiverseMetrics() [Diversity Selection]
  │       │           └── calculateMetricConfidence() [Final Scoring]
  │       │
  │       ├── [Step 3: Chart Specification Generation]
  │       │   └── DashboardService.generateChartSpecs() →
  │       │       └── [For Each Selected Metric] →
  │       │           ├── DashboardService.buildContextualMetricPrompt() →
  │       │           │   ├── [Include metric details, type, value type]
  │       │           │   ├── [Add categories, embedded metrics if available]
  │       │           │   ├── [Incorporate original user prompt context]
  │       │           │   └── [Include chart recommendations for guidance]
  │       │           ├── OpenAiService.prompt() →
  │       │           │   ├── generateReasoning() →
  │       │           │   │   ├── startTrace('openai.generateReasoning')
  │       │           │   │   ├── identifyDataQualityIssues()
  │       │           │   │   ├── [Enhanced confidence level names: Excellent/Good/Acceptable/Poor/Unsuitable]
  │       │           │   │   └── openai.chat.completions.create() [GPT-4o Reasoning]
  │       │           │   ├── makeReasonedDecision() →
  │       │           │   │   ├── startTrace('openai.makeReasonedDecision')
  │       │           │   │   └── openai.chat.completions.create() [Tool Calling]
  │       │           │   └── generateReasoningSummary() →
  │       │           │       ├── extractIntent() [Intent classification]
  │       │           │       ├── extractRationalePoints() [Key reasoning points]
  │       │           │       ├── extractConfidence() [Evidence-based confidence]
  │       │           │       └── [Structure decisions with explanations]
  │       │           ├── DashboardService.generateChartTitle() [Title Formatting]
  │       │           └── [Apply Request DateRange Override]
  │       │       └── DashboardService.deduplicateChartSpecs() →
  │       │           └── createChartKey() [Deduplication Logic]
  │       │
  │       ├── [Step 4: Data Slicing & Transformation]
  │       │   └── [For Each Chart Spec] →
  │       │       └── MetricsService.slice() →
  │       │           ├── DateFilterUtil.isValidDateRangeFormat() [Validation]
  │       │           ├── [Metric Lookup & Validation]
  │       │           ├── ErrorHandlerService.handleValidationError() [Error Handling]
  │       │           └── ChartDataSlicerService.slice() →
  │       │               └── [Strategy Pattern Selection] →
  │       │                   ├── TimeSeriesSlicingStrategy.slice() →
  │       │                   │   ├── getNestedValue() [Data Extraction]
  │       │                   │   └── DateFilterUtil.filterByDateRange()
  │       │                   ├── GroupedSeriesSlicingStrategy.slice() →
  │       │                   │   ├── sliceNestedGroupedSeries()
  │       │                   │   └── DateFilterUtil.getDateIndicesInRange()
  │       │                   ├── ScalarSlicingStrategy.slice()
  │       │                   ├── DynamicKeyObjectSlicingStrategy.slice()
  │       │                   ├── EmbeddedMetricsSlicingStrategy.slice()
  │       │                   └── ArraySlicingStrategy.slice()
  │       │
  │       ├── [Step 5: Layout & Chart Assembly]
  │       │   ├── [Generate Chart IDs]
  │       │   ├── DashboardService.calculateChartSpan() [Layout Calculation]
  │       │   └── [Position Assignment (row/col)]
  │       │
  │       ├── [Step 6: Insight Generation]
  │       │   └── DashboardService.generateInsights() →
  │       │       ├── ReasoningService.intentAnalyzer.performIntentAnalysis() [Intent
  Re-analysis]
  │       │       ├── generateAIContextualInsights() →
  │       │       │   ├── [Construct AI Prompt]
  │       │       │   ├── OpenAiService.prompt() [AI Insight Generation]
  │       │       │   └── MetricsService.getDataAnalysis() [Context]
  │       │       ├── generateFinancialDomainInsights() [Domain Logic]
  │       │       ├── generateSmartCompositionInsights() [Chart Analysis]
  │       │       ├── prioritizeInsights() →
  │       │       │   └── scoreInsightRelevance() [Relevance Scoring]
  │       │       └── [Limit to Top 3 Insights]
  │       │
  │       ├── [Step 7: Dashboard Metadata Assembly]
  │       │   ├── DashboardService.generateDashboardId() [ID Generation]
  │       │   ├── [Calculate Response Time]
  │       │   └── [Assemble Metadata Object]
  │       │
  │       └── [Return Complete Dashboard Object]
  │
  ├── [Step 8: Audit Logging]
  │   └── AuditService.logChartGeneration() →
  │       ├── generateRequestId() [Unique ID Generation]
  │       ├── ensureAuditDirectoryExists() [Directory Setup]
  │       └── fs.writeFile() [File System Write]
  │
  ├── [Step 9: Response Assembly]
  │   ├── [Add RequestId to Response]
  │   ├── [Add Original Prompt]
  │   └── [Calculate Final Response Time]
  │
  ├── [Step 10: Tracing & Error Handling]
  │   ├── trace.end() [Langfuse Completion]
  │   └── ErrorHandlerService.handleApiError() [Error Cases]
  │
  └── [Return Final JSON Response]

  I'll trace the entire journey of a user request through the system,
  showing exactly how data transforms at each step.

  User Request Entry Point

  Example User Input:
  {
    "prompt": "Show me sales performance across all channels for 2025",
    "maxCharts": 5,
    "dateRange": "2025",
    "generateInsights": true
  }

  Entry Point: POST /v1/dashboard → AppController.generateDashboard()
  (app.controller.ts:218)

  ---
  Step 1: Request Validation & Processing

  Location: AppController.generateDashboard() (app.controller.ts:218-250)

  // ValidationPipe processes DashboardDto
  const validatedRequest = {
    prompt: "Show me sales performance across all channels for 2025",
    maxCharts: 5,
    dateRange: "2025",
    generateInsights: true
  }

  Tracing Setup:
  const trace = startTrace('endpoint.dashboard', { body });
  const startTime = Date.now();

  ---
  Step 2: Dashboard Service Orchestration

  Location: DashboardService.generateDashboard()
  (dashboard.service.ts:31-44)

  LangGraph Orchestration:
  const result = await runDashboardGraph(request, {
    metricsService: this.metricsService,
    identifyRelatedMetrics: this.identifyRelatedMetrics.bind(this),
    generateChartSpecs: this.generateChartSpecs.bind(this),
    // ... other service bindings
  });

  The LangGraph coordinates the following pipeline:

  ---
  Step 3: Data Loading & Analysis

  3.1 Metrics Data Loading

  Location: MetricsService.load() (metrics.service.ts:28-58)

  // Cache check
  const cacheKey = "2025"; // from dateRange
  if (!this.cache.has(cacheKey)) {
    // Fetch from external API
    const data = await this.irisApiService.fetchMetrics("2025");
  }

  3.2 External API Call

  Location: IrisApiService.fetchMetrics() (iris-api.service.ts:45-109)

  Date Range Parsing:
  // Input: "2025"
  const { startDate, endDate } = this.parseDateRange("2025");
  // Output:
  // startDate: "2025-01-01T00:00:00.000Z"
  // endDate: "2025-12-31T23:59:59.999Z"

  API Payload Construction:
  const payload = {
    filters: {
      startDate: "2025-01-01T00:00:00.000Z",
      endDate: "2025-12-31T23:59:59.999Z",
      isCashRefundSelected: false,
      salesChannels: {
        DTC: {
          channels: {
            "Amazon Seller Partner": { stores: { US: { subchannels:
  ["amazon"] }}},
            Shopify: { stores: { yoprettyboy: { subchannels: ["buy
  button", "point of sale", ...] }}}
          }
        },
        Wholesale: { channels: {} }
      }
    }
  }

  Raw API Response Example:
  {
    "totalGrossSales": 125000,
    "netSales": 118000,
    "dataBySalesChannels": [
      {
        "connector": "Shopify",
        "grossSales": 85000,
        "netSales": 80000,
        "orders": 450
      },
      {
        "connector": "Amazon",
        "grossSales": 40000,
        "netSales": 38000,
        "orders": 180
      }
    ],
    "salesTrends": {
      "dates": ["2025-01-01", "2025-02-01", ...],
      "values": [
        {
          "label": "Shopify",
          "values": [15000, 18000, 22000, ...]
        },
        {
          "label": "Amazon",
          "values": [8000, 9500, 11000, ...]
        }
      ]
    }
  }

  3.3 Data Analysis

  Location: DataAnalysisService.analyzeData()
  (data-analysis.service.ts:44-54)

  const metrics = this.extractMetricsRecursively(data);
  // Discovers metrics like:
  // - totalGrossSales (scalar)
  // - dataBySalesChannels (embeddedMetrics)
  // - salesTrends (groupedSeries)

  const suggestions = this.generateChartSuggestions(metrics);
  const context = this.generateDataContext(metrics, data);

  Generated Metric Analysis:
  const analysisResult = {
    availableMetrics: [
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
        name: "dataBySalesChannels",
        type: "embeddedMetrics",
        description: "Sales channels with multiple metrics",
        hasTimeData: false,
        hasGrouping: true,
        groupingDimensions: ["Shopify", "Amazon"],
        valueType: "generic",
        chartRecommendations: ["bar", "stacked-bar"],
        embeddedMetrics: ["grossSales", "netSales", "orders"]
      },
      {
        name: "salesTrends",
        type: "groupedSeries",
        description: "Sales trends broken down by category over time",
        hasTimeData: true,
        hasGrouping: true,
        groupingDimensions: ["Shopify", "Amazon"],
        valueType: "currency",
        chartRecommendations: ["line", "bar", "stacked-bar"]
      }
    ],
    suggestedChartTypes: [
      {
        chartType: "line",
        confidence: 0.85,
        reason: "Multiple time-series metrics with consistent value
  types",
        bestForMetrics: ["salesTrends"]
      },
      {
        chartType: "stacked-bar",
        confidence: 0.82,
        reason: "Multiple grouped currency metrics showing composition",
        bestForMetrics: ["dataBySalesChannels"]
      }
    ]
  }

  ---
  Step 4: Metric Selection & Ranking

  Location: DashboardService.identifyRelatedMetrics()
  (dashboard.service.ts:46-72)

  // Uses ReasoningService for intelligent metric selection
  const analysis = this.reasoningService.analyzeAndRankMetrics(
    "Show me sales performance across all channels for 2025",
    visualizableMetrics, // filters out scalar types
    5 // maxCharts
  );

  Location: ReasoningService.analyzeAndRankMetrics()
  (reasoning.service.ts:477-524)

  4.1 Intent Analysis

  const intentAnalysis =
  this.intentAnalyzer.performIntentAnalysis(prompt);
  // Result:
  {
    primaryIntent: {
      type: "performance_overview",
      confidence: 0.88
    },
    secondaryIntents: [
      { type: "categorical_comparison", confidence: 0.65 }
    ],
    temporalSignals: [
      { type: "yearly", confidence: 0.9, keyword: "2025" }
    ],
    explicitMetrics: ["sales", "performance", "channels"]
  }

  4.2 Metric Scoring

  // For each metric, calculate relevance score
  const scoredMetrics = [
    {
      metric: dataBySalesChannels,
      score: 4.2, // High score due to "sales" + "channels" keyword match
      reasons: [
        "Partial match: sales/sales",
        "Partial match: channels/channels",
        "Ideal for categorical comparison",
        "Core financial metric"
      ]
    },
    {
      metric: salesTrends,
      score: 3.8,
      reasons: [
        "Exact word match: sales",
        "Perfect for temporal analysis",
        "Strong temporal match (1 signals)"
      ]
    }
  ]

  4.3 Quality Analysis & Business Context

  // Quality issues detection
  const qualityIssues = []; // No issues found

  // Business context boosts
  const businessBoostedMetrics = [
    {
      metric: dataBySalesChannels,
      score: 4.7, // +0.5 boost for core financial metric
      reasons: [...previous, "Core financial metric"]
    }
  ]

  4.4 Diversity Selection

  // Select diverse metrics avoiding duplicates
  const selectedMetrics = [
    dataBySalesChannels, // embeddedMetrics type
    salesTrends,        // groupedSeries type
    // Ensures type diversity
  ]

  ---
  Step 5: Chart Specification Generation

  Location: DashboardService.generateChartSpecs()
  (dashboard.service.ts:74-91)

  For each selected metric, generate a chart specification:

  5.1 Individual Chart Generation

  For dataBySalesChannels:
  const metricPrompt = this.buildContextualMetricPrompt(metric, originalPrompt, dataAnalysis);
  // Results in contextual prompt with metric details, categories, and user intent
  const spec = await this.openAiService.prompt(metricPrompt,
  dataAnalysis);

  Location: OpenAiService.prompt() (openai.service.ts:55-66)

  AI Reasoning Phase:

  const reasoningResponse = await this.generateReasoning(prompt,
  dataAnalysis);

  GPT-4o Reasoning Output:
  STEP 1 - ANALYZE USER INTENT:
  User wants to see breakdown/comparison of sales data across different
  channels.
  Keywords "breakdown" indicate categorical comparison intent.

  STEP 2 - EVALUATE AVAILABLE DATA:
  dataBySalesChannels contains embedded metrics (grossSales, netSales,
  orders)
  with categorical grouping by connector (Shopify, Amazon).

  STEP 3 - CHART VISUALIZATION PRINCIPLES:
  - bar: Best for categorical comparisons ✓
  - stacked-bar: Best for composition analysis ✓
  Since this shows breakdown WITH multiple metrics, stacked-bar is ideal.

  STEP 4 - MATCH DATA TO VISUALIZATION:
  Data has categories (Shopify, Amazon) and multiple related metrics.
  Stacked-bar serves both comparison AND composition needs.

  STEP 5 - FINAL DECISION:
  Recommend stacked-bar chart for comprehensive channel breakdown.

  AI Decision Phase:

  const chartSpec = await this.makeReasonedDecision(prompt, dataAnalysis,
  reasoning);

  GPT-4o Tool Call:
  {
    "chartType": "stacked-bar",
    "metric": "dataBySalesChannels",
    "dateRange": "2025"
  }

  Final Chart Spec:
  {
    chartType: "stacked-bar",
    metric: "dataBySalesChannels", 
    dateRange: "2025",
    title: "Data By Sales Channels Breakdown",
    aiReasoning: "...", // Full reasoning text
    reasoning_summary: { // Condensed structured summary
      intent: "compositional_breakdown",
      rationale_points: ["categorical comparison needed", "composition analysis required"],
      confidence: 0.85,
      decisions: [
        {"name": "chart_type", "choice": "stacked-bar", "why": "shows composition breakdown"},
        {"name": "metric_selection", "choice": "dataBySalesChannels", "why": "best match for user intent"}
      ]
    }
  }

  5.2 Deduplication

  Location: DashboardService.deduplicateChartSpecs()
  (dashboard.service.ts:315-329)

  // Create unique keys for each chart
  const keys = specs.map(spec =>
  `${spec.metric}|${spec.chartType}|${spec.dateRange}`);
  // Remove duplicates based on metric+chartType+dateRange combination

  ---
  Step 6: Data Slicing & Transformation

  For each chart specification, slice the relevant data:

  Location: MetricsService.slice() (metrics.service.ts:77-137)

  const chartData = await this.slice("dataBySalesChannels", "2025");

  6.1 Strategy Selection

  Location: ChartDataSlicerService.slice()
  (chart-data-slicer.service.ts:340-348)

  // dataBySalesChannels is type "embeddedMetrics"
  const strategy = this.strategies.get("embeddedMetrics");
  // Uses EmbeddedMetricsSlicingStrategy

  6.2 Data Transformation

  Location: EmbeddedMetricsSlicingStrategy.slice()
  (chart-data-slicer.service.ts:230-280)

  Input Raw Data:
  {
    "dataBySalesChannels": [
      { "connector": "Shopify", "grossSales": 85000, "netSales": 80000,
  "orders": 450 },
      { "connector": "Amazon", "grossSales": 40000, "netSales": 38000,
  "orders": 180 }
    ]
  }

  Processing:
  // Extract categories
  const categories = ["Shopify", "Amazon"];

  // Extract numeric metrics
  const numericKeys = ["grossSales", "netSales", "orders"];

  // Create series for each metric
  const values = [
    {
      label: "grossSales",
      values: [85000, 40000]
    },
    {
      label: "netSales",
      values: [80000, 38000]
    },
    {
      label: "orders",
      values: [450, 180]
    }
  ];

  Output ChartData:
  {
    "dates": ["Shopify", "Amazon"],
    "values": [
      {
        "label": "grossSales",
        "values": [85000, 40000]
      },
      {
        "label": "netSales",
        "values": [80000, 38000]
      },
      {
        "label": "orders",
        "values": [450, 180]
      }
    ]
  }

  ---
  Step 7: Dashboard Layout & Insights

  7.1 Chart Layout Calculation

  Location: DashboardService.calculateChartSpan()
  (dashboard.service.ts:111-114)

  // All charts take full width (span=4) in single column layout
  const span = 4;

  7.2 Chart Title Generation

  Location: DashboardService.generateChartTitle()
  (dashboard.service.ts:93-109)

  // Input: "dataBySalesChannels", "stacked-bar"
  // Processing:
  const cleanName = "dataBySalesChannels";
  const formattedName = "Data By Sales Channels"; // Format camelCase
  const typeMap = { "stacked-bar": "Breakdown" };
  const title = "Data By Sales Channels Breakdown";

  7.3 Insight Generation

  Location: DashboardService.generateInsights()
  (dashboard.service.ts:116-141)

  AI Contextual Insights:

  const systemPrompt = `
  User asked: "Show me sales performance across all channels for 2025"
  Charts generated: Data By Sales Channels Breakdown (stacked-bar), Sales
  Trends (line)

  Focus on what these charts reveal together and what actions the user
  should consider.
  `;

  const aiInsights = await this.openAiService.prompt(systemPrompt,
  dataAnalysis);
  // Result: [
  //   "Cross-channel performance comparison enables optimization
  opportunities",
  //   "Revenue trends support forecasting and seasonal planning
  decisions"
  // ]

  Domain-Specific Insights:

  // Financial domain analysis
  const domainInsights = [
    "Direct-to-consumer vs wholesale mix analysis reveals channel strategy
   effectiveness"
  ];

  // Chart composition insights
  const compositionInsights = [
    "Trend and comparison charts together reveal both patterns and
  relative performance"
  ];

  Insight Prioritization:

  const prioritizedInsights = [
    "Cross-channel performance comparison enables optimization
  opportunities", // Score: 4.5
    "Trend and comparison charts together reveal both patterns and
  relative performance", // Score: 3.5
    "Revenue trends support forecasting and seasonal planning decisions"
  // Score: 3.0
  ].slice(0, 3);

  ---
  Step 8: Final Dashboard Assembly

  8.1 Dashboard Chart Creation

  Complete Chart Objects:
  {
    "charts": [
      {
        "id": "chart_1703123456789_abc123",
        "title": "Data By Sales Channels Breakdown",
        "chartType": "stacked-bar",
        "metric": "dataBySalesChannels",
        "dateRange": "2025",
        "row": 0,
        "col": 0,
        "span": 4,
        "data": {
          "dates": ["Shopify", "Amazon"],
          "values": [
            {"label": "grossSales", "values": [85000, 40000]},
            {"label": "netSales", "values": [80000, 38000]},
            {"label": "orders", "values": [450, 180]}
          ]
        }
      },
      {
        "id": "chart_1703123456790_def456",
        "title": "Sales Trends Trends",
        "chartType": "line",
        "metric": "salesTrends",
        "dateRange": "2025",
        "row": 1,
        "col": 0,
        "span": 4,
        "data": {
          "dates": ["2025-01-01", "2025-02-01", "2025-03-01"],
          "values": [
            {"label": "Shopify", "values": [15000, 18000, 22000]},
            {"label": "Amazon", "values": [8000, 9500, 11000]}
          ]
        }
      }
    ]
  }

  8.2 Metadata Assembly

  {
    "metadata": {
      "totalCharts": 2,
      "responseTimeMs": 1247,
      "suggestedInsights": [
        "Cross-channel performance comparison enables optimization
  opportunities",
        "Trend and comparison charts together reveal both patterns and
  relative performance",
        "Revenue trends support forecasting and seasonal planning
  decisions"
      ]
    }
  }

  ---
  Step 9: Audit Logging

  Location: AppController.generateDashboard() (app.controller.ts:225-236)

  const requestId = await this.audit.logChartGeneration(
    "Show me sales performance across all channels for 2025",
    { chartType: "dashboard", metric: "multiple", dateRange: "2025" },
    result.charts,
    dataAnalysis,
    {
      dataSource: "Iris Finance API",
      responseTimeMs: 1247,
      metricsCount: 2
    }
  );

  Audit Log File: /audit-logs/chart-1703123456789-abc123def.json
  {
    "timestamp": "2025-08-14T10:30:00.000Z",
    "requestId": "1703123456789-abc123def",
    "userPrompt": "Show me sales performance across all channels for
  2025",
    "chartSpec": {"chartType": "dashboard", "metric": "multiple",
  "dateRange": "2025"},
    "dataUsed": "...", // Full chart data with reasoning summaries
    "dataAnalysis": "...", // Complete analysis with confidence levels
    "metadata": {
      "dataSource": "Iris Finance API",
      "responseTimeMs": 1247,
      "metricsCount": 2,
      "enhancedReasoning": true // Indicates condensed reasoning included
    }
  }

  ---
  Step 10: Final JSON Response

  Complete Response Structure:
  {
    "dashboardId": "dashboard_1703123456789_xyz789",
    "charts": [
      {
        "id": "chart_1703123456789_abc123",
        "title": "Data By Sales Channels Breakdown",
        "chartType": "stacked-bar",
        "metric": "dataBySalesChannels",
        "dateRange": "2025",
        "row": 0,
        "col": 0,
        "span": 4,
        "data": {
          "dates": ["Shopify", "Amazon"],
          "values": [
            {"label": "grossSales", "values": [85000, 40000]},
            {"label": "netSales", "values": [80000, 38000]},
            {"label": "orders", "values": [450, 180]}
          ]
        }
      },
      {
        "id": "chart_1703123456790_def456",
        "title": "Sales Trends Trends",
        "chartType": "line",
        "metric": "salesTrends",
        "dateRange": "2025",
        "row": 1,
        "col": 0,
        "span": 4,
        "data": {
          "dates": ["2025-01-01", "2025-02-01", "2025-03-01"],
          "values": [
            {"label": "Shopify", "values": [15000, 18000, 22000]},
            {"label": "Amazon", "values": [8000, 9500, 11000]}
          ]
        }
      }
    ],
    "metadata": {
      "totalCharts": 2,
      "responseTimeMs": 1247,
      "suggestedInsights": [
        "Cross-channel performance comparison enables optimization
  opportunities",
        "Trend and comparison charts together reveal both patterns and
  relative performance",
        "Revenue trends support forecasting and seasonal planning
  decisions"
      ]
    },
    "requestId": "1703123456789-abc123def",
    "originalPrompt": "Show me sales performance across all channels for
  2025"
  }

  ---
  Performance & Observability

  Tracing Points:
  - LangFuse traces for AI operations
  - Performance timing at each step
  - Error handling with context preservation
  - Cache hits/misses for metrics data
  - Audit logging for compliance

  Total Processing Time: ~1.2 seconds
  - External API call: ~400ms
  - Data analysis: ~150ms
  - AI reasoning: ~500ms (now includes condensed reasoning generation)
  - Data slicing: ~100ms (enhanced with semantic search)
  - Insight generation: ~97ms

  This complete flow demonstrates how the system transforms a simple
  natural language request into a sophisticated, multi-chart dashboard
  with business intelligence insights and structured reasoning summaries,
  all while maintaining full audit trails and performance monitoring.
  
  Key Improvements in this Branch:
  - Enhanced contextual prompts for better AI chart generation
  - Condensed reasoning summaries for structured decision explanations
  - Evidence-based confidence scoring with descriptive levels
  - Semantic metric search with tokenized relevance scoring
  - Streamlined audit data structure for better compliance tracking
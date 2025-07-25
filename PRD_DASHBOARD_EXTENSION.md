# **PRD: Multi-Chart Dashboard & Live API Integration System**

**Project:** Iris Finance Chat-to-Chart Extension  
**Version:** 2.0  
**Last Updated:** January 2025  
**Document Type:** Product Requirements Document  

---

## **📋 Table of Contents**

1. [Executive Summary](#executive-summary)
2. [Current System Analysis](#current-system-analysis)
3. [Business Requirements](#business-requirements)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Phases](#implementation-phases)
6. [Success Metrics](#success-metrics)
7. [Risk Assessment](#risk-assessment)
8. [Timeline & Resources](#timeline--resources)

---

## **🎯 Executive Summary**

### **Project Vision**
Transform the current single-chart Iris Finance system into a comprehensive dashboard platform supporting complex financial analytics, live API integration, and enhanced user experience while maintaining production-ready architecture.

### **Key Objectives**
- **Multi-Chart Dashboards**: Generate 3-8 connected charts from single prompts
- **Advanced Analytics**: Support cohort analysis, unit economics, LTV/CAC modeling
- **Live Data Integration**: Replace static JSON with real-time API connections
- **Enhanced UX**: Structured forms to reduce user ambiguity
- **Production Ready**: Scalable microservice architecture for enterprise deployment

### **Business Impact**
- 80% reduction in time-to-insight for financial analysis
- Support for complex ecommerce analytics workflows
- Extensible platform for future analytics capabilities

---

## **📊 Current System Analysis**

### **Existing Architecture**
```
Web Frontend (Next.js) ←→ Backend API (NestJS) ←→ Static JSON File
     ↓                          ↓                      ↓
- ChatBox.tsx            - OpenAI Service         - sample-june-metrics.json
- ChartView.tsx          - Data Analysis Service  - 99+ auto-discovered metrics
- Single chart focus     - Metrics Service        - File-based audit logs
                         - Audit Service
```

### **Current Capabilities**
✅ Natural language to single chart generation  
✅ 5 chart types (line, bar, stacked-bar, heatmap, waterfall)  
✅ Intelligent metric discovery (99+ metrics)  
✅ Interactive data tables with AG Grid  
✅ Complete audit trail  
✅ GPT-4 powered chart type selection  

### **Current Limitations**
❌ Single chart per request  
❌ Static data source only  
❌ Limited analytics capabilities  
❌ Simple chat interface leads to ambiguity  
❌ File-based persistence not scalable  
❌ No real-time data updates  

---

## **🎯 Business Requirements**

### **Analytics Requirements**

#### **1. Cohort Level Analytics**
- **Net Sales**: Revenue by customer acquisition cohort
- **Unit Sales**: Product volume by cohort
- **Contribution Margin**: Profit contribution by cohort
- **Repeat Rates**: Customer return behavior analysis
- **Dollar Retention**: Revenue retention tracking
- **Customer Retention**: User retention by cohort
- **LTV (Contribution Margin)**: Lifetime value calculations
- **LTV/CAC Ratios**: Customer acquisition efficiency

#### **2. AOV Analysis by Customer Type**
- **New Customer AOV**: First-time buyer average order value
- **Returning Customer AOV**: Repeat buyer spending patterns
- **Subscriber AOV**: Subscription customer metrics
- **Blended AOV**: Overall average across all segments

#### **3. Order Analytics**
- **Units per Order**: Product quantity analysis
- **Orders per Lifetime**: Customer purchase frequency
- **Order Value Distribution**: Revenue concentration analysis

#### **4. Unit Economics Walkdown**
- **AOV → Gross Revenue**: Revenue calculation flow
- **COGS Deduction**: Cost of goods sold analysis
- **Shipping & Fulfillment**: Logistics cost breakdown
- **Marketing Attribution**: Customer acquisition costs
- **Contribution Margin**: Final profitability per order

#### **5. LTV/CAC Sensitivity Analysis**
- **CAC Optimization**: Customer acquisition cost scenarios
- **AOV Impact Modeling**: Order value sensitivity testing
- **Order Frequency Analysis**: Purchase behavior modeling
- **Scenario Planning**: Interactive what-if analysis

### **User Experience Requirements**

#### **1. Ambiguity Reduction Interface**
- **Structured Form Fields**: Replace simple chat with guided inputs
- **Date Range Selectors**: Precise time period selection
- **Metric Group Filters**: Category-based metric selection
- **Channel Filters**: Sales channel specification
- **Customer Segment Filters**: Targeted analysis capabilities

#### **2. Dashboard Capabilities**
- **Multi-Chart Generation**: 3-8 charts per request
- **Smart Layout**: Automatic chart positioning
- **Interactive Charts**: Drill-down and cross-filtering
- **Export Options**: PDF, PNG, Excel export
- **Shareable Dashboards**: Permalink generation

### **Data Integration Requirements**

#### **1. Live API Connectivity**
- **RESTful API Support**: Standard HTTP API integration
- **Authentication Handling**: Bearer tokens, API keys, OAuth
- **Rate Limiting**: Request throttling and retry logic
- **Error Handling**: Graceful degradation on API failures

#### **2. Schema Discovery**
- **Automatic Metric Detection**: Runtime schema analysis
- **Data Type Classification**: Currency, percentage, count detection
- **Relationship Mapping**: Cross-metric dependencies
- **Semantic Context**: Business meaning extraction

#### **3. Real-time Updates**
- **WebSocket Support**: Live data streaming
- **Polling Mechanisms**: Configurable refresh intervals
- **Change Detection**: Delta updates for efficiency
- **Cache Management**: Intelligent data caching

---

## **🏗️ Technical Architecture**

### **Enhanced System Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Dashboard UI    │ Chart Builder   │ Advanced Request Form       │
│ - Multi-chart   │ - Drag & drop   │ - Structured inputs         │
│ - Interactive   │ - Custom layouts│ - Ambiguity resolution      │
│ - Responsive    │ - Template mgmt │ - Smart suggestions         │
└─────────────────┴─────────────────┴─────────────────────────────┘
                                  │
┌─────────────────────────────────┼─────────────────────────────────┐
│                    API Gateway   │                                 │
│              Load Balancer & Authentication                       │
└─────────────────────────────────┼─────────────────────────────────┘
                                  │
┌─────────────────┬─────────────────┼─────────────────┬─────────────┐
│ Dashboard Svc   │ Data Source Svc │ Analytics Svc   │ Audit Svc   │
│ - Multi-chart   │ - API integration│ - Cohort calc  │ - DB persist│
│ - Layout engine │ - Schema discovery│ - Unit econ   │ - Analytics │
│ - AI orchestr.  │ - Real-time sync│ - LTV/CAC      │ - Compliance│
└─────────────────┴─────────────────┼─────────────────┴─────────────┘
                                  │
┌─────────────────┬─────────────────┼─────────────────┬─────────────┐
│ Redis Cache     │ PostgreSQL DB   │ Message Queue   │ File Storage│
│ - Data cache    │ - Audit logs    │ - Async jobs    │ - Exports   │
│ - Session mgmt  │ - User data     │ - Notifications │ - Templates │
│ - Rate limiting │ - Saved queries │ - Batch process │ - Assets    │
└─────────────────┴─────────────────┴─────────────────┴─────────────┘
```

### **New Service Interfaces**

#### **Dashboard Service**
```typescript
interface DashboardRequest {
  prompt: string;
  filters?: {
    dateRange?: string;
    channels?: string[];
    customerType?: string[];
    metricGroups?: string[];
  };
  maxCharts?: number; // Default: 5
  layoutPreference?: 'auto' | 'grid' | 'custom';
}

interface DashboardResponse {
  dashboardId: string;
  charts: ChartSpecification[];
  metadata: DashboardMetadata;
  rawData: any[];
  insights: AIInsight[];
  requestId: string;
}

interface ChartSpecification {
  id: string;
  chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall' | 'cohort' | 'funnel';
  title: string;
  metric: string;
  data: any[];
  position: { row: number; col: number; span: number };
  insights?: string[];
  filters?: ChartFilter[];
}
```

#### **Data Source Service**
```typescript
interface DataSource {
  id: string;
  name: string;
  type: 'static' | 'api' | 'database' | 'websocket';
  config: DataSourceConfig;
  status: 'healthy' | 'degraded' | 'down';
  lastSync: Date;
}

interface APIConfig {
  baseUrl: string;
  authentication: {
    type: 'bearer' | 'apiKey' | 'oauth';
    credentials: any;
  };
  endpoints: {
    metrics: string;
    schema: string;
    health: string;
  };
  rateLimiting: {
    requestsPerMinute: number;
    retryStrategy: 'exponential' | 'linear';
  };
}
```

#### **Analytics Service**
```typescript
interface CohortMetrics {
  netSales: CohortData[];
  unitSales: CohortData[];
  contributionMargin: CohortData[];
  repeatRates: RetentionData[];
  dollarRetention: RetentionData[];
  customerRetention: RetentionData[];
  ltv: LTVData[];
  ltvCacRatio: LTVCACData[];
}

interface UnitEconomicsMetrics {
  aovBreakdown: {
    newCustomer: number;
    returning: number;
    subscriber: number;
    blended: number;
  };
  walkdown: WalkdownStep[];
  sensitivityAnalysis: SensitivityResult[];
}
```

---

## **🚀 Implementation Phases**

### **Phase 1: Multi-Chart Dashboard Foundation**
**Timeline: 2-3 weeks**  
**Priority: High**

#### **Deliverables**
- [ ] `DashboardService` with multi-chart generation
- [ ] Enhanced OpenAI prompts for dashboard creation
- [ ] `DashboardView.tsx` with responsive grid layout
- [ ] Chart relationship detection and positioning
- [ ] Cross-chart filtering capabilities

#### **Technical Tasks**
```typescript
// New API endpoint
POST /dashboard
{
  "prompt": "Show me comprehensive June performance",
  "maxCharts": 6,
  "filters": {
    "dateRange": "2025-06",
    "channels": ["Shopify", "Amazon"]
  }
}

// Response with multiple charts
{
  "dashboardId": "dash_abc123",
  "charts": [
    {
      "id": "chart_1",
      "chartType": "line",
      "title": "Sales Trends",
      "position": {"row": 1, "col": 1, "span": 2}
    },
    // ... 5 more charts
  ]
}
```

#### **Success Criteria**
- Generate 3-8 related charts from single prompt
- Automatic layout optimization for different screen sizes
- Chart interaction and cross-filtering
- 95% user satisfaction with chart relevance

---

### **Phase 2: Advanced Analytics & Metrics**
**Timeline: 3-4 weeks**  
**Priority: High**

#### **Deliverables**
- [ ] `CohortAnalysisService` with full cohort calculations
- [ ] `UnitEconomicsService` with AOV breakdown and walkdown
- [ ] LTV/CAC sensitivity analysis engine
- [ ] New chart types: cohort, funnel, sensitivity
- [ ] Advanced metric calculation algorithms

#### **Technical Implementation**

##### **Cohort Analysis Engine**
```typescript
@Injectable()
export class CohortAnalysisService {
  generateCohortMetrics(data: CustomerData[]): CohortMetrics {
    const cohorts = this.groupByCohort(data);
    
    return {
      netSales: this.calculateCohortNetSales(cohorts),
      unitSales: this.calculateCohortUnitSales(cohorts),
      contributionMargin: this.calculateCohortMargin(cohorts),
      repeatRates: this.calculateRepeatRates(cohorts),
      dollarRetention: this.calculateDollarRetention(cohorts),
      customerRetention: this.calculateCustomerRetention(cohorts),
      ltv: this.calculateLTV(cohorts),
      ltvCacRatio: this.calculateLTVCAC(cohorts)
    };
  }
  
  private groupByCohort(data: CustomerData[]): CohortGroup[] {
    // Group customers by acquisition month
    return data.reduce((cohorts, customer) => {
      const cohortMonth = customer.firstPurchaseDate.substring(0, 7); // YYYY-MM
      if (!cohorts[cohortMonth]) {
        cohorts[cohortMonth] = [];
      }
      cohorts[cohortMonth].push(customer);
      return cohorts;
    }, {} as Record<string, CustomerData[]>);
  }
}
```

##### **Unit Economics Calculator**
```typescript
@Injectable()
export class UnitEconomicsService {
  calculateAOVBreakdown(orders: OrderData[]): AOVMetrics {
    const segments = this.segmentOrders(orders);
    
    return {
      newCustomer: this.calculateAOV(segments.newCustomer),
      returning: this.calculateAOV(segments.returning),
      subscriber: this.calculateAOV(segments.subscriber),
      blended: this.calculateAOV(orders)
    };
  }
  
  generateUnitEconomicsWalkdown(orders: OrderData[]): WalkdownMetrics {
    const aov = this.calculateAOV(orders);
    const cogs = this.calculateCOGS(orders);
    const shipping = this.calculateShipping(orders);
    const marketing = this.calculateMarketing(orders);
    
    return {
      steps: [
        { label: 'Average Order Value', value: aov },
        { label: 'Less: Cost of Goods Sold', value: -cogs },
        { label: 'Gross Profit', value: aov - cogs },
        { label: 'Less: Shipping Costs', value: -shipping },
        { label: 'Less: Marketing Costs', value: -marketing },
        { label: 'Contribution Margin', value: aov - cogs - shipping - marketing }
      ]
    };
  }
  
  runLTVCACAnalysis(baseMetrics: BaseMetrics, scenarios: ScenarioInputs[]): SensitivityAnalysis {
    return scenarios.map(scenario => {
      const adjustedCAC = baseMetrics.cac * scenario.cacMultiplier;
      const adjustedAOV = baseMetrics.aov * scenario.aovMultiplier;
      const adjustedFrequency = baseMetrics.orderFrequency * scenario.frequencyMultiplier;
      
      const ltv = this.calculateLTV(adjustedAOV, adjustedFrequency, baseMetrics.retentionRate);
      const ltvCacRatio = ltv / adjustedCAC;
      
      return {
        scenario: scenario.name,
        ltv,
        cac: adjustedCAC,
        ratio: ltvCacRatio,
        profitability: ltvCacRatio >= 3 ? 'good' : ltvCacRatio >= 2 ? 'acceptable' : 'poor'
      };
    });
  }
}
```

#### **Success Criteria**
- All 5 analytics categories fully implemented
- Cohort analysis with month-over-month retention
- Unit economics walkdown with interactive drilling
- LTV/CAC sensitivity with scenario modeling
- Performance: < 3 seconds for complex calculations

---

### **Phase 3: Live API Integration Architecture**
**Timeline: 2-3 weeks**  
**Priority: Medium**

#### **Deliverables**
- [ ] `DataSourceService` with multi-provider support
- [ ] API connection management and health monitoring
- [ ] Real-time data pipeline with caching
- [ ] Error handling and retry mechanisms
- [ ] Data transformation and normalization

#### **API Integration Framework**
```typescript
@Injectable()
export class DataSourceService {
  private dataSources: Map<string, DataSource> = new Map();
  
  async registerDataSource(config: DataSourceConfig): Promise<string> {
    const source = await this.validateAndConnect(config);
    this.dataSources.set(source.id, source);
    await this.scheduleHealthChecks(source.id);
    return source.id;
  }
  
  async fetchData(sourceId: string, query?: DataQuery): Promise<any> {
    const source = this.dataSources.get(sourceId);
    
    switch (source.type) {
      case 'api':
        return this.fetchFromAPI(source, query);
      case 'database':
        return this.fetchFromDatabase(source, query);
      case 'websocket':
        return this.fetchFromWebSocket(source, query);
      case 'static':
        return this.fetchFromFile(source);
    }
  }
  
  private async fetchFromAPI(source: DataSource, query?: DataQuery): Promise<any> {
    const cachedData = await this.cacheService.get(this.getCacheKey(source, query));
    if (cachedData && !this.isStale(cachedData.timestamp, source.config.ttl)) {
      return cachedData.data;
    }
    
    const response = await this.httpService.request({
      url: `${source.config.baseUrl}${source.config.endpoints.metrics}`,
      method: 'GET',
      headers: this.buildAuthHeaders(source.config.authentication),
      params: this.buildQueryParams(query),
      timeout: source.config.timeout || 30000
    }).toPromise();
    
    const transformedData = await this.transformData(response.data, source.config.schema);
    await this.cacheService.set(this.getCacheKey(source, query), {
      data: transformedData,
      timestamp: new Date()
    }, source.config.ttl);
    
    return transformedData;
  }
}
```

#### **Real-time Data Pipeline**
```typescript
@Injectable()
export class DataPipelineService {
  async setupRealtimeConnection(config: RealtimeConfig): Promise<void> {
    if (config.type === 'websocket') {
      const ws = new WebSocket(config.url);
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.processRealtimeUpdate(data, config.sourceId);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.scheduleReconnect(config);
      };
    } else if (config.type === 'polling') {
      setInterval(async () => {
        try {
          const data = await this.dataSourceService.fetchData(config.sourceId);
          this.processRealtimeUpdate(data, config.sourceId);
        } catch (error) {
          console.error('Polling error:', error);
        }
      }, config.interval);
    }
  }
  
  private async processRealtimeUpdate(data: any, sourceId: string): Promise<void> {
    // Emit to connected dashboards
    this.websocketGateway.emit('dataUpdate', {
      sourceId,
      data,
      timestamp: new Date()
    });
    
    // Update cache
    await this.cacheService.invalidate(`source:${sourceId}:*`);
  }
}
```

#### **Success Criteria**
- Support for 3+ API types (REST, GraphQL, WebSocket)
- 99.9% uptime for API connections
- < 5 second data refresh times
- Graceful handling of API failures
- Automatic retry with exponential backoff

---

### **Phase 4: Dynamic Schema Discovery**
**Timeline: 2 weeks**  
**Priority: Medium**

#### **Deliverables**
- [ ] `SchemaDiscoveryService` with automatic metric detection
- [ ] Semantic context builder for business understanding
- [ ] Dynamic prompt generation based on discovered schema
- [ ] Relationship mapping between metrics
- [ ] Business rule extraction and validation

#### **Schema Discovery Implementation**
```typescript
@Injectable()
export class SchemaDiscoveryService {
  async discoverAPI(apiUrl: string, auth: AuthConfig): Promise<DiscoveredSchema> {
    // Step 1: Fetch sample data
    const sampleData = await this.fetchSampleData(apiUrl, auth);
    
    // Step 2: Analyze structure
    const structure = this.analyzeDataStructure(sampleData);
    
    // Step 3: Extract metrics
    const metrics = this.extractMetrics(structure);
    
    // Step 4: Classify business context
    const context = await this.buildSemanticContext(metrics);
    
    // Step 5: Generate suggestions
    const suggestions = this.generateDashboardSuggestions(context);
    
    return {
      apiUrl,
      discoveredAt: new Date(),
      structure,
      metrics,
      context,
      suggestions,
      confidence: this.calculateConfidence(metrics, context)
    };
  }
  
  private async buildSemanticContext(metrics: MetricInfo[]): Promise<SemanticContext> {
    const businessTerms = await this.extractBusinessTerms(metrics);
    const relationships = this.findMetricRelationships(metrics);
    const calculatedFields = this.identifyCalculatedFields(metrics);
    
    return {
      businessDomain: this.classifyBusinessDomain(businessTerms),
      metricDefinitions: await this.generateDefinitions(metrics),
      relationships,
      calculatedFields,
      recommendedAnalytics: this.suggestAnalytics(businessTerms)
    };
  }
  
  generateSemanticPrompts(schema: DiscoveredSchema): string[] {
    const prompts = [];
    
    // Revenue analysis prompts
    if (schema.context.businessDomain.includes('ecommerce')) {
      prompts.push(
        `Show ${schema.metrics.revenue?.name} trends over time`,
        `Compare ${schema.metrics.sales?.name} by channel`,
        `Analyze customer cohort performance`,
        `Unit economics breakdown for ${schema.metrics.orders?.name}`
      );
    }
    
    // Financial analysis prompts
    if (schema.context.businessDomain.includes('finance')) {
      prompts.push(
        `Cash flow analysis with ${schema.metrics.cash?.name}`,
        `Profit margin trends`,
        `Cost breakdown analysis`
      );
    }
    
    return prompts;
  }
}
```

#### **Automatic Relationship Detection**
```typescript
interface MetricRelationship {
  source: string;
  target: string;
  type: 'calculation' | 'correlation' | 'causation' | 'composition';
  confidence: number;
  formula?: string;
}

class RelationshipDetector {
  findRelationships(metrics: MetricInfo[]): MetricRelationship[] {
    const relationships: MetricRelationship[] = [];
    
    // Detect calculation relationships
    relationships.push(...this.detectCalculations(metrics));
    
    // Detect correlations through naming patterns
    relationships.push(...this.detectNameBasedRelationships(metrics));
    
    // Detect composition relationships
    relationships.push(...this.detectCompositions(metrics));
    
    return relationships.filter(r => r.confidence > 0.7);
  }
  
  private detectCalculations(metrics: MetricInfo[]): MetricRelationship[] {
    const relationships = [];
    
    // Example: net = gross - discounts
    const gross = metrics.find(m => m.name.includes('gross'));
    const net = metrics.find(m => m.name.includes('net'));
    const discounts = metrics.find(m => m.name.includes('discount'));
    
    if (gross && net && discounts) {
      relationships.push({
        source: gross.name,
        target: net.name,
        type: 'calculation',
        confidence: 0.9,
        formula: `${net.name} = ${gross.name} - ${discounts.name}`
      });
    }
    
    return relationships;
  }
}
```

#### **Success Criteria**
- 90%+ accuracy in metric detection
- Automatic business context classification
- Dynamic prompt generation for discovered APIs
- Relationship mapping with 80%+ accuracy
- < 30 seconds for schema discovery

---

### **Phase 5: Enhanced User Experience**
**Timeline: 2-3 weeks**  
**Priority: High**

#### **Deliverables**
- [ ] Advanced request form with structured inputs
- [ ] Interactive dashboard builder with drag-and-drop
- [ ] Smart ambiguity resolution system
- [ ] Template management and sharing
- [ ] Enhanced export and sharing capabilities

#### **Advanced Request Interface**
```typescript
interface AdvancedRequestForm {
  analysisType: 'trend' | 'comparison' | 'cohort' | 'sensitivity' | 'custom';
  timeframe: {
    start: Date;
    end: Date;
    granularity: 'daily' | 'weekly' | 'monthly';
  };
  segments: {
    customerType?: ('new' | 'returning' | 'subscriber')[];
    channels?: string[];
    products?: string[];
    geography?: string[];
  };
  metrics: string[]; // Multi-select from discovered metrics
  chartPreferences: {
    maxCharts: number;
    layout: 'auto' | 'custom';
    chartTypes?: string[];
    exportFormat?: 'png' | 'pdf' | 'excel';
  };
  additionalPrompt?: string; // Free-text for nuances
}

// React component for the advanced form
export default function AdvancedRequestForm({ onSubmit }: AdvancedRequestFormProps) {
  const [formData, setFormData] = useState<AdvancedRequestForm>(initialState);
  const [availableMetrics, setAvailableMetrics] = useState<MetricInfo[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  return (
    <div className="advanced-request-form">
      <div className="form-section">
        <label>Analysis Type</label>
        <AnalysisTypeSelector 
          value={formData.analysisType}
          onChange={(type) => setFormData({...formData, analysisType: type})}
        />
      </div>
      
      <div className="form-section">
        <label>Time Range</label>
        <DateRangePicker 
          start={formData.timeframe.start}
          end={formData.timeframe.end}
          granularity={formData.timeframe.granularity}
          onChange={(timeframe) => setFormData({...formData, timeframe})}
        />
      </div>
      
      <div className="form-section">
        <label>Metrics (Select 1-10)</label>
        <MetricSelector
          metrics={availableMetrics}
          selected={formData.metrics}
          maxSelection={10}
          onChange={(metrics) => setFormData({...formData, metrics})}
        />
      </div>
      
      <div className="form-section">
        <label>Segments & Filters</label>
        <SegmentSelector
          segments={formData.segments}
          onChange={(segments) => setFormData({...formData, segments})}
        />
      </div>
      
      <div className="form-section">
        <label>Dashboard Preferences</label>
        <ChartPreferences
          preferences={formData.chartPreferences}
          onChange={(prefs) => setFormData({...formData, chartPreferences: prefs})}
        />
      </div>
      
      <div className="form-actions">
        <button onClick={() => onSubmit(formData)}>
          Generate Dashboard
        </button>
        <button onClick={() => saveAsTemplate(formData)}>
          Save as Template
        </button>
      </div>
    </div>
  );
}
```

#### **Smart Ambiguity Resolution**
```typescript
interface AmbiguityIssue {
  type: 'missing_timeframe' | 'unclear_metric' | 'ambiguous_segment' | 'conflicting_intent';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestions: string[];
}

interface ClarificationQuestion {
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'date_range' | 'free_text';
  options?: string[];
  defaultValue?: any;
}

@Injectable()
export class AmbiguityResolver {
  async detectAmbiguity(prompt: string, context: RequestContext): Promise<AmbiguityIssue[]> {
    const issues: AmbiguityIssue[] = [];
    
    // Check for missing time context
    if (!this.hasTimeReference(prompt)) {
      issues.push({
        type: 'missing_timeframe',
        severity: 'high',
        description: 'No time period specified',
        suggestions: ['last 30 days', 'this month', 'this quarter', 'this year']
      });
    }
    
    // Check for metric ambiguity
    const metrics = await this.extractMetrics(prompt);
    if (metrics.length === 0) {
      issues.push({
        type: 'unclear_metric',
        severity: 'high',
        description: 'No clear metrics identified',
        suggestions: ['revenue', 'orders', 'customers', 'profit']
      });
    }
    
    // Check for conflicting analysis intent
    const intents = this.detectAnalysisIntents(prompt);
    if (intents.length > 1) {
      issues.push({
        type: 'conflicting_intent',
        severity: 'medium',
        description: 'Multiple analysis types detected',
        suggestions: intents
      });
    }
    
    return issues;
  }
  
  generateClarificationQuestions(issues: AmbiguityIssue[]): ClarificationQuestion[] {
    return issues.map(issue => {
      switch (issue.type) {
        case 'missing_timeframe':
          return {
            question: 'What time period would you like to analyze?',
            type: 'single_choice',
            options: issue.suggestions,
            defaultValue: 'last 30 days'
          };
          
        case 'unclear_metric':
          return {
            question: 'Which metrics are you most interested in?',
            type: 'multiple_choice',
            options: issue.suggestions
          };
          
        case 'conflicting_intent':
          return {
            question: 'What type of analysis would you prefer?',
            type: 'single_choice',
            options: issue.suggestions
          };
      }
    });
  }
}
```

#### **Interactive Dashboard Builder**
```typescript
export default function DashboardBuilder() {
  const [availableCharts, setAvailableCharts] = useState<ChartOption[]>([]);
  const [dashboardLayout, setDashboardLayout] = useState<DashboardLayout>({
    rows: 3,
    cols: 4,
    charts: []
  });
  
  const handleChartDrop = (chartType: string, position: GridPosition) => {
    const newChart = {
      id: generateId(),
      type: chartType,
      position,
      config: getDefaultConfig(chartType)
    };
    
    setDashboardLayout({
      ...dashboardLayout,
      charts: [...dashboardLayout.charts, newChart]
    });
  };
  
  return (
    <div className="dashboard-builder">
      <div className="chart-palette">
        <h3>Available Charts</h3>
        {availableCharts.map(chart => (
          <DraggableChart
            key={chart.type}
            chart={chart}
            onDragStart={() => setDraggedChart(chart)}
          />
        ))}
      </div>
      
      <div className="dashboard-canvas">
        <GridLayout
          layout={dashboardLayout}
          onDrop={handleChartDrop}
          onResize={handleChartResize}
          onMove={handleChartMove}
        />
      </div>
      
      <div className="dashboard-controls">
        <button onClick={saveDashboard}>Save Dashboard</button>
        <button onClick={publishDashboard}>Publish</button>
        <button onClick={exportDashboard}>Export</button>
      </div>
    </div>
  );
}
```

#### **Success Criteria**
- 70% reduction in ambiguous requests
- Structured form completion rate > 85%
- Dashboard builder adoption rate > 60%
- User satisfaction score > 4.5/5
- Template sharing usage > 30%

---

### **Phase 6: Enhanced Audit & Persistence**
**Timeline: 1-2 weeks**  
**Priority: Medium**

#### **Deliverables**
- [ ] PostgreSQL database integration
- [ ] Enhanced audit analytics and reporting
- [ ] Saved prompt library with semantic search
- [ ] User behavior analytics
- [ ] System performance monitoring

#### **Database Schema Design**
```sql
-- Core entities
CREATE TABLE dashboard_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255),
  original_request JSONB NOT NULL,
  generated_charts JSONB NOT NULL,
  data_snapshot JSONB NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE saved_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  semantic_context JSONB NOT NULL,
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(3,2) DEFAULT 0.0,
  tags TEXT[],
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  last_used TIMESTAMP
);

CREATE TABLE data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  health_score DECIMAL(3,2) DEFAULT 1.0,
  last_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  session_id UUID,
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_dashboard_sessions_user_id ON dashboard_sessions(user_id);
CREATE INDEX idx_dashboard_sessions_created_at ON dashboard_sessions(created_at);
CREATE INDEX idx_saved_prompts_usage ON saved_prompts(usage_count DESC);
CREATE INDEX idx_user_analytics_user_id ON user_analytics(user_id);
CREATE INDEX idx_user_analytics_timestamp ON user_analytics(timestamp);
```

#### **Enhanced Audit Service**
```typescript
@Entity()
export class DashboardSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  userId: string;
  
  @Column('jsonb')
  originalRequest: DashboardRequest;
  
  @Column('jsonb')
  generatedCharts: ChartSpecification[];
  
  @Column('jsonb')
  dataSnapshot: any;
  
  @Column('jsonb')
  metadata: {
    responseTimeMs: number;
    dataSourcesUsed: string[];
    aiTokensUsed: number;
    cacheHitRate: number;
  };
  
  @CreateDateColumn()
  createdAt: Date;
  
  @UpdateDateColumn()
  updatedAt: Date;
}

@Injectable()
export class EnhancedAuditService {
  async logDashboardGeneration(request: DashboardRequest, response: DashboardResponse, metadata: any): Promise<string> {
    const session = this.dashboardSessionRepository.create({
      userId: request.userId,
      originalRequest: request,
      generatedCharts: response.charts,
      dataSnapshot: response.rawData,
      metadata
    });
    
    await this.dashboardSessionRepository.save(session);
    
    // Update analytics
    await this.updateUserAnalytics(request.userId, 'dashboard_generated', {
      chartCount: response.charts.length,
      responseTime: metadata.responseTimeMs
    });
    
    return session.id;
  }
  
  async getAnalyticsSummary(dateRange: DateRange): Promise<AnalyticsSummary> {
    const sessions = await this.dashboardSessionRepository
      .createQueryBuilder('session')
      .where('session.createdAt BETWEEN :start AND :end', dateRange)
      .getMany();
    
    return {
      totalSessions: sessions.length,
      uniqueUsers: new Set(sessions.map(s => s.userId)).size,
      averageResponseTime: sessions.reduce((sum, s) => sum + s.metadata.responseTimeMs, 0) / sessions.length,
      chartTypeBreakdown: this.analyzeChartTypes(sessions),
      mostUsedMetrics: this.analyzeMostUsedMetrics(sessions),
      userSatisfactionScore: await this.calculateSatisfactionScore(sessions)
    };
  }
}
```

#### **Saved Prompt Library**
```typescript
@Injectable()
export class PromptLibraryService {
  async savePrompt(prompt: string, context: SemanticContext, userId: string): Promise<SavedPrompt> {
    const savedPrompt = this.savedPromptRepository.create({
      prompt,
      semanticContext: context,
      createdBy: userId,
      tags: this.extractTags(prompt, context)
    });
    
    return this.savedPromptRepository.save(savedPrompt);
  }
  
  async searchPrompts(query: string, userId?: string): Promise<SavedPrompt[]> {
    const qb = this.savedPromptRepository
      .createQueryBuilder('prompt')
      .where('prompt.prompt ILIKE :query', { query: `%${query}%` })
      .orWhere('prompt.tags && :tags', { tags: this.extractSearchTags(query) })
      .orderBy('prompt.usage_count', 'DESC')
      .limit(10);
    
    if (userId) {
      qb.andWhere('prompt.created_by = :userId', { userId });
    }
    
    return qb.getMany();
  }
  
  async suggestSimilarPrompts(prompt: string): Promise<SavedPrompt[]> {
    // Use semantic similarity (could integrate with vector database)
    const embedding = await this.generateEmbedding(prompt);
    return this.findSimilarByEmbedding(embedding);
  }
}
```

#### **Success Criteria**
- 99.9% audit data integrity
- Query performance < 500ms for analytics
- Prompt library search < 200ms
- User behavior insights dashboard
- Automated performance alerts

---

### **Phase 7: Production Deployment Architecture**
**Timeline: 2-3 weeks**  
**Priority: High**

#### **Deliverables**
- [ ] Microservice decomposition and containerization
- [ ] Kubernetes deployment manifests
- [ ] CI/CD pipeline with automated testing
- [ ] Monitoring and observability stack
- [ ] Security hardening and compliance

#### **Microservice Architecture**
```yaml
# docker-compose.yml for development
version: '3.8'
services:
  frontend:
    build: ./web
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://api-gateway:4000
    depends_on: [api-gateway]
    
  api-gateway:
    build: ./services/gateway
    ports: ["4000:4000"]
    environment:
      - DASHBOARD_SERVICE_URL=http://dashboard-service:3001
      - DATA_SERVICE_URL=http://data-service:3002
      - ANALYTICS_SERVICE_URL=http://analytics-service:3003
    depends_on: [dashboard-service, data-service, analytics-service]
    
  dashboard-service:
    build: ./services/dashboard
    ports: ["3001:3001"]
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/iris_finance
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on: [postgres, redis]
    
  data-service:
    build: ./services/data
    ports: ["3002:3002"]
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/iris_finance
      - REDIS_URL=redis://redis:6379
    depends_on: [postgres, redis]
    
  analytics-service:
    build: ./services/analytics
    ports: ["3003:3003"]
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/iris_finance
    depends_on: [postgres]
    
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: iris_finance
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports: ["5432:5432"]
    
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

#### **Kubernetes Deployment**
```yaml
# k8s/dashboard-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dashboard-service
  labels:
    app: dashboard-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: dashboard-service
  template:
    metadata:
      labels:
        app: dashboard-service
    spec:
      containers:
      - name: dashboard-service
        image: iris-finance/dashboard-service:latest
        ports:
        - containerPort: 3001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: redis-secret
              key: url
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secret
              key: api-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3001
          initialDelaySeconds: 5
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: dashboard-service
spec:
  selector:
    app: dashboard-service
  ports:
  - port: 3001
    targetPort: 3001
  type: ClusterIP
```

#### **CI/CD Pipeline**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: |
        cd server && npm ci
        cd ../web && npm ci
    
    - name: Run tests
      run: |
        cd server && npm run test
        cd ../web && npm run test
    
    - name: Build applications
      run: |
        cd server && npm run build
        cd ../web && npm run build
  
  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: us-west-2
    
    - name: Build and push Docker images
      run: |
        docker build -t iris-finance/dashboard-service:${{ github.sha }} ./services/dashboard
        docker build -t iris-finance/data-service:${{ github.sha }} ./services/data
        docker build -t iris-finance/analytics-service:${{ github.sha }} ./services/analytics
        docker build -t iris-finance/frontend:${{ github.sha }} ./web
        
        # Push to ECR
        aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
        docker push $ECR_REGISTRY/iris-finance/dashboard-service:${{ github.sha }}
        docker push $ECR_REGISTRY/iris-finance/data-service:${{ github.sha }}
        docker push $ECR_REGISTRY/iris-finance/analytics-service:${{ github.sha }}
        docker push $ECR_REGISTRY/iris-finance/frontend:${{ github.sha }}
    
    - name: Deploy to EKS
      run: |
        aws eks update-kubeconfig --name iris-finance-cluster
        kubectl set image deployment/dashboard-service dashboard-service=$ECR_REGISTRY/iris-finance/dashboard-service:${{ github.sha }}
        kubectl set image deployment/data-service data-service=$ECR_REGISTRY/iris-finance/data-service:${{ github.sha }}
        kubectl set image deployment/analytics-service analytics-service=$ECR_REGISTRY/iris-finance/analytics-service:${{ github.sha }}
        kubectl set image deployment/frontend frontend=$ECR_REGISTRY/iris-finance/frontend:${{ github.sha }}
        kubectl rollout status deployment/dashboard-service
        kubectl rollout status deployment/data-service
        kubectl rollout status deployment/analytics-service
        kubectl rollout status deployment/frontend
```

#### **Monitoring Stack**
```typescript
interface MonitoringConfig {
  metrics: {
    provider: 'Prometheus';
    scrapeInterval: '15s';
    retention: '30d';
    alertRules: AlertRule[];
  };
  logging: {
    provider: 'ELK';
    logLevel: 'info';
    retention: '30d';
    indexes: ['application-logs', 'access-logs', 'error-logs'];
  };
  tracing: {
    provider: 'Jaeger';
    sampleRate: 0.1;
    serviceMesh: 'Istio';
  };
  uptime: {
    provider: 'StatusPage';
    endpoints: [
      '/health',
      '/api/dashboard',
      '/api/data-sources',
      '/api/analytics'
    ];
    interval: '30s';
  };
}

// Prometheus metrics
const prometheusMetrics = {
  dashboard_generation_duration: new Histogram({
    name: 'dashboard_generation_duration_seconds',
    help: 'Time taken to generate dashboard',
    labelNames: ['user_id', 'chart_count']
  }),
  
  api_request_duration: new Histogram({
    name: 'api_request_duration_seconds',
    help: 'API request duration',
    labelNames: ['method', 'endpoint', 'status_code']
  }),
  
  data_source_health: new Gauge({
    name: 'data_source_health_score',
    help: 'Health score of data sources',
    labelNames: ['source_id', 'source_type']
  }),
  
  active_users: new Gauge({
    name: 'active_users_total',
    help: 'Number of active users',
    labelNames: ['time_window']
  })
};
```

#### **Success Criteria**
- 99.9% uptime SLA
- Auto-scaling based on load (2-10 instances)
- < 5 minute deployment time
- Comprehensive monitoring and alerting
- Security compliance (SOC 2, ISO 27001 ready)

---

## **📊 Success Metrics**

### **Functional Requirements**
| Requirement | Success Criteria | Measurement Method |
|-------------|-----------------|-------------------|
| Multi-Chart Dashboards | Generate 3-8 related charts from single prompt | Automated testing + user acceptance |
| Advanced Analytics | Support all 5 analytics categories | Feature completion checklist |
| Live API Integration | Connect to 3+ API types with auto-discovery | Integration test suite |
| Enhanced UX | 70% reduction in ambiguous requests | User behavior analytics |
| Production Ready | 99.9% uptime, 100+ concurrent users | System monitoring |

### **Performance Requirements**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Dashboard Generation Time | < 5 seconds | API response time monitoring |
| Data Refresh Time | < 2 seconds | Real-time monitoring |
| Schema Discovery Time | < 30 seconds | Automated benchmarks |
| Database Query Performance | < 500ms | Database monitoring |
| User Interface Responsiveness | < 200ms | Frontend performance monitoring |

### **Business Impact Metrics**
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Time-to-Insight Reduction | 80% improvement | User workflow analysis |
| User Adoption Rate | 70% of existing users | Usage analytics |
| User Satisfaction Score | > 4.5/5 | User surveys |
| Feature Utilization Rate | > 60% for advanced features | Feature usage tracking |
| System ROI | 300% within 12 months | Cost-benefit analysis |

---

## **⚠️ Risk Assessment**

### **Technical Risks**
| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| OpenAI API Rate Limits | Medium | High | Implement request queuing and caching |
| Database Performance at Scale | Medium | High | Database optimization and read replicas |
| Third-party API Reliability | High | Medium | Fallback mechanisms and error handling |
| Real-time Data Synchronization | Medium | Medium | Event-driven architecture with retry logic |

### **Business Risks**
| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| User Adoption Slower than Expected | Medium | High | Comprehensive training and onboarding |
| Increased Infrastructure Costs | High | Medium | Cost monitoring and optimization |
| Security and Compliance Issues | Low | High | Security audits and compliance framework |
| Feature Complexity Overwhelming Users | Medium | Medium | Progressive disclosure and user testing |

### **Operational Risks**
| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|-------------------|
| Deployment Complexity | Medium | Medium | Automated deployment and rollback procedures |
| Monitoring and Alerting Gaps | Medium | High | Comprehensive monitoring strategy |
| Data Quality Issues | High | Medium | Data validation and quality checks |
| Scalability Bottlenecks | Medium | High | Load testing and performance optimization |

---

## **📅 Timeline & Resources**

### **Development Timeline**
```
┌─────────────────────────────────────────────────────────────────┐
│ Month 1 │ Month 2 │ Month 3 │ Month 4 │ Month 5 │ Month 6 │ Month 7 │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ Phase 1 │ Phase 2 │ Phase 3 │ Phase 4 │ Phase 5 │ Phase 6 │ Phase 7 │
│Multi-   │Advanced │Live API │Schema   │Enhanced │Audit &  │Production│
│Chart    │Analytics│Integration│Discovery│UX       │Persist  │Deploy    │
│Dashboard│         │         │         │         │         │         │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

### **Resource Requirements**

#### **Development Team**
- **1 Tech Lead** (Full project duration)
- **2 Full-Stack Developers** (Phases 1-5)
- **1 DevOps Engineer** (Phases 3, 6-7)
- **1 UI/UX Designer** (Phases 1, 5)
- **1 Data Engineer** (Phases 2-4)
- **1 QA Engineer** (All phases)

#### **Infrastructure Costs (Monthly)**
| Component | Development | Production |
|-----------|-------------|------------|
| Kubernetes Cluster | $500 | $2,000 |
| Database (PostgreSQL) | $100 | $500 |
| Cache (Redis) | $50 | $200 |
| Monitoring Stack | $100 | $300 |
| CDN & Load Balancer | $50 | $200 |
| **Total Monthly** | **$800** | **$3,200** |

#### **Third-party Services**
- **OpenAI API**: $500-2,000/month (based on usage)
- **Monitoring & Analytics**: $200-500/month
- **Security & Compliance Tools**: $300-800/month

### **Total Project Investment**
- **Development Cost**: $350,000 - $500,000
- **Infrastructure (First Year)**: $40,000 - $60,000
- **Third-party Services (First Year)**: $12,000 - $40,000
- **Total First Year**: $402,000 - $600,000

---

## **✅ Next Steps**

### **Immediate Actions (Week 1)**
1. **Stakeholder Approval**: Review and approve this PRD
2. **Team Assembly**: Recruit and onboard development team
3. **Environment Setup**: Provision development infrastructure
4. **Architecture Review**: Detailed technical design session

### **Phase 1 Kickoff (Week 2)**
1. **Sprint Planning**: Break down Phase 1 into 2-week sprints
2. **Development Environment**: Complete local development setup
3. **API Design**: Finalize dashboard API specifications
4. **UI Mockups**: Create wireframes for multi-chart dashboard

### **Success Criteria for Go-Live**
- [ ] All 7 phases completed successfully
- [ ] Performance benchmarks met
- [ ] Security audit passed
- [ ] User acceptance testing completed
- [ ] Production monitoring active
- [ ] Documentation and training materials ready

---

**Document Approvals:**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Manager | | | |
| Tech Lead | | | |
| Engineering Manager | | | |
| DevOps Lead | | | |

---

*This PRD represents a comprehensive roadmap for transforming Iris Finance into a production-ready, enterprise-scale business intelligence platform. Regular reviews and updates will ensure alignment with evolving business needs and technical requirements.* 
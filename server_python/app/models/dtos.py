from pydantic import BaseModel, Field, validator
from typing import Optional, List, Literal, Dict, Any
from enum import Enum


class ChatDto(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000, description="Natural language prompt for chart generation")
    dateRange: Optional[str] = Field(None, description="Optional date range filter (YYYY or YYYY-MM format)")


class FeedbackDto(BaseModel):
    requestId: str = Field(..., description="Unique request identifier from chart generation")
    rating: int = Field(..., ge=1, le=5, description="User rating from 1-5")
    comment: Optional[str] = Field(None, max_length=500, description="Optional feedback comment")
    chartId: Optional[str] = Field(None, description="Optional chart identifier for dashboard feedback")


class DashboardDto(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=1000, description="Natural language prompt for dashboard generation")
    dateRange: Optional[str] = Field(None, description="Optional date range filter")
    numberOfCharts: int = Field(4, ge=1, le=8, description="Number of charts to generate (1-8)")
    channelFilter: Optional[str] = Field(None, description="Optional channel filter")
    includeInsights: bool = Field(True, description="Whether to include AI-generated insights")


ChartType = Literal["line", "bar", "stacked-bar", "heatmap", "waterfall"]


class ChartSpecDto(BaseModel):
    chartType: ChartType = Field(..., description="Type of chart to generate")
    metric: str = Field(..., description="Metric name to visualize")
    dateRange: str = Field(..., description="Date range for data (YYYY or YYYY-MM format)")
    groupBy: Optional[str] = Field(None, description="Optional grouping dimension")


class DashboardChartDto(ChartSpecDto):
    title: str = Field(..., description="Chart title")
    row: int = Field(..., ge=0, description="Grid row position")
    col: int = Field(..., ge=0, description="Grid column position")
    rowSpan: int = Field(1, ge=1, le=4, description="Number of rows to span")
    colSpan: int = Field(1, ge=1, le=4, description="Number of columns to span")


class MetricInfo(BaseModel):
    name: str
    type: Literal["timeSeries", "groupedSeries", "scalar", "dynamicKeyObject", "embeddedMetrics", "array"]
    description: str
    sampleValue: Any
    valueType: Literal["currency", "percentage", "count", "generic"]
    isTimeGrouped: bool = False
    groupingFields: List[str] = []


class ChartSuggestion(BaseModel):
    chartType: ChartType
    confidence: float = Field(..., ge=0, le=1)
    reasoning: str


class DataAnalysis(BaseModel):
    availableMetrics: List[MetricInfo]
    suggestedChartTypes: List[ChartSuggestion]
    dataDescription: str
    totalDataPoints: int
    dateRangeAvailable: Optional[str] = None


class AuditLogEntry(BaseModel):
    requestId: str
    timestamp: str
    prompt: str
    chartSpec: Dict[str, Any]
    dataPoints: int
    dataAnalysis: Dict[str, Any]
    metadata: Dict[str, Any]
    feedback: Optional[Dict[str, Any]] = None


class ChartFeedback(BaseModel):
    requestId: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = None
    chartId: Optional[str] = None
    timestamp: str


class ErrorResponse(BaseModel):
    error: str
    details: Optional[str] = None


class ChartResponse(BaseModel):
    chartType: ChartType
    metric: str
    dateRange: str
    groupBy: Optional[str] = None
    data: List[Dict[str, Any]]
    requestId: str
    originalPrompt: str
    dataAnalysis: Dict[str, Any]


class DashboardResponse(BaseModel):
    charts: List[Dict[str, Any]]
    insights: Optional[str] = None
    requestId: str
    originalPrompt: str
    metadata: Dict[str, Any]


class AuditStatsResponse(BaseModel):
    success: bool
    stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class FeedbackStatsResponse(BaseModel):
    totalFeedback: int
    averageRating: float
    ratingDistribution: Dict[str, int]
    chartTypeBreakdown: Dict[str, int]
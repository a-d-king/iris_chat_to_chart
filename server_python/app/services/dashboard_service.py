import asyncio
import logging
import time
import random
from typing import Dict, Any, List, Optional
from app.models.dtos import DashboardDto, MetricInfo, DataAnalysis, DashboardChartDto
from app.services.openai_service import OpenAIService
from app.services.metrics_service import MetricsService
from app.services.data_analysis_service import DataAnalysisService

logger = logging.getLogger(__name__)


class DashboardResponse:
    """Dashboard response data structure"""
    
    def __init__(self, dashboard_id: str, charts: List[Dict[str, Any]], metadata: Dict[str, Any], request_id: str):
        self.dashboard_id = dashboard_id
        self.charts = charts
        self.metadata = metadata
        self.request_id = request_id
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "dashboardId": self.dashboard_id,
            "charts": self.charts,
            "metadata": self.metadata,
            "requestId": self.request_id
        }


class DashboardService:
    """Service for generating multi-chart dashboards with layout management and insights"""
    
    def __init__(self):
        self.openai_service = OpenAIService()
        self.metrics_service = MetricsService()
        self.data_analysis_service = DataAnalysisService()
    
    async def generate_dashboard(self, request: DashboardDto) -> Dict[str, Any]:
        """
        Generate a complete dashboard with multiple charts based on the request
        
        Args:
            request: Dashboard generation request with prompt and options
            
        Returns:
            Complete dashboard with charts, layout, and metadata
        """
        start_time = time.time()
        dashboard_id = self._generate_dashboard_id()
        
        try:
            # Get data analysis for context
            data_analysis = await self.metrics_service.get_data_analysis()
            
            # Identify related metrics from the prompt
            related_metrics = await self._identify_related_metrics(
                request.prompt, 
                data_analysis, 
                request.numberOfCharts
            )
            
            if not related_metrics:
                logger.warning("No suitable metrics found for dashboard generation")
                # Return empty dashboard with explanation
                return {
                    "charts": [],
                    "insights": "No suitable metrics found for the requested dashboard",
                    "dashboardId": dashboard_id,
                    "metadata": {
                        "totalCharts": 0,
                        "responseTimeMs": int((time.time() - start_time) * 1000),
                        "error": "No visualizable metrics found"
                    }
                }
            
            # Generate chart specifications
            chart_specs = await self._generate_chart_specs(request, related_metrics, data_analysis)
            
            # Fetch data for each chart in parallel
            chart_tasks = []
            for i, spec in enumerate(chart_specs):
                task = self._create_chart_with_data(spec, i)
                chart_tasks.append(task)
            
            charts = await asyncio.gather(*chart_tasks, return_exceptions=True)
            
            # Filter out failed charts and log errors
            successful_charts = []
            for i, result in enumerate(charts):
                if isinstance(result, Exception):
                    logger.error(f"Failed to create chart {i}: {result}")
                    continue
                successful_charts.append(result)
            
            response_time = int((time.time() - start_time) * 1000)
            insights = []
            if request.includeInsights:
                insights = await self._generate_insights(successful_charts, request.prompt)
            
            return {
                "charts": successful_charts,
                "insights": insights[0] if insights else None,
                "dashboardId": dashboard_id,
                "metadata": {
                    "totalCharts": len(successful_charts),
                    "responseTimeMs": response_time
                }
            }
            
        except Exception as error:
            logger.error(f"Error generating dashboard: {error}")
            response_time = int((time.time() - start_time) * 1000)
            return {
                "charts": [],
                "insights": None,
                "dashboardId": dashboard_id,
                "metadata": {
                    "totalCharts": 0,
                    "responseTimeMs": response_time,
                    "error": str(error)
                }
            }
    
    async def _identify_related_metrics(
        self, 
        prompt: str, 
        data_analysis: DataAnalysis, 
        max_charts: int = 5
    ) -> List[MetricInfo]:
        """
        Identify metrics related to the prompt for dashboard generation
        
        Args:
            prompt: User's natural language prompt
            data_analysis: Available data analysis with metrics
            max_charts: Maximum number of charts to generate
            
        Returns:
            List of relevant metrics for the dashboard
        """
        prompt_lower = prompt.lower()
        all_metrics = data_analysis.availableMetrics
        
        # Filter out scalar metrics for dashboards - they don't visualize well as charts
        # TODO: In the future, implement metric-card type for scalar values
        visualizable_metrics = [
            m for m in all_metrics 
            if m.type != "scalar"
        ]
        
        if not visualizable_metrics:
            logger.warning("No visualizable metrics available")
            return []
        
        # Find primary metric mentioned in prompt
        primary_metric = self.data_analysis_service.find_best_metric_match(prompt, visualizable_metrics)
        related_metrics = [primary_metric] if primary_metric else []
        
        # Add related metrics based on keywords and patterns
        if any(keyword in prompt_lower for keyword in ['performance', 'overview', 'dashboard']):
            # Add key business metrics
            business_metrics = [
                m for m in visualizable_metrics
                if any(term in m.name.lower() for term in ['sales', 'orders', 'revenue', 'profit'])
            ][:3]
            related_metrics.extend(business_metrics)
        
        if any(keyword in prompt_lower for keyword in ['sales', 'revenue']):
            sales_metrics = [
                m for m in visualizable_metrics
                if any(term in m.name.lower() for term in ['gross', 'net', 'connector', 'channel'])
            ][:2]
            related_metrics.extend(sales_metrics)
        
        if any(keyword in prompt_lower for keyword in ['financial', 'cash']):
            financial_metrics = [
                m for m in visualizable_metrics
                if any(term in m.name.lower() for term in ['cash', 'profit', 'margin'])
            ][:2]
            related_metrics.extend(financial_metrics)
        
        # Remove duplicates and limit to max_charts
        unique_metrics = []
        seen_names = set()
        for metric in related_metrics:
            if metric and metric.name not in seen_names:
                unique_metrics.append(metric)
                seen_names.add(metric.name)
        
        return unique_metrics[:max_charts]
    
    async def _generate_chart_specs(
        self, 
        request: DashboardDto, 
        metrics: List[MetricInfo], 
        data_analysis: DataAnalysis
    ) -> List[Dict[str, Any]]:
        """
        Generate chart specifications for each metric
        
        Args:
            request: Dashboard request
            metrics: List of metrics to visualize
            data_analysis: Data analysis context
            
        Returns:
            List of chart specifications
        """
        specs = []
        
        for metric in metrics:
            # Create a focused prompt for this specific metric
            metric_prompt = f"Show {metric.name} {'trends over time' if metric.isTimeGrouped else 'breakdown'}"
            
            try:
                spec = await self.openai_service.prompt(metric_prompt, data_analysis)
                specs.append({
                    **spec,
                    "title": self._generate_chart_title(metric.name, spec.get("chartType", "bar")),
                    "dateRange": request.dateRange or spec.get("dateRange")
                })
            except Exception as error:
                logger.warning(f"Failed to generate spec for {metric.name}: {str(error)}")
                # Fallback to default chart spec
                specs.append({
                    "chartType": "line" if metric.isTimeGrouped else "bar",
                    "metric": metric.name,
                    "dateRange": request.dateRange or "2025-06",
                    "title": self._generate_chart_title(metric.name, "line" if metric.isTimeGrouped else "bar")
                })
        
        return specs
    
    async def _create_chart_with_data(self, spec: Dict[str, Any], index: int) -> Dict[str, Any]:
        """
        Create a chart with data and layout information
        
        Args:
            spec: Chart specification
            index: Chart index for layout calculation
            
        Returns:
            Complete chart with data and layout
        """
        try:
            data = await self.metrics_service.slice(
                spec["metric"],
                spec.get("dateRange"),
                spec.get("groupBy")
            )
            
            return {
                **spec,
                "id": f"chart_{index + 1}",
                "data": data,
                "row": (index // 2) + 1,
                "col": (index % 2) + 1,
                "span": self._calculate_chart_span(spec.get("chartType", "bar"), 1)  # Total charts not available here
            }
        except Exception as error:
            logger.error(f"Failed to create chart for metric {spec.get('metric')}: {error}")
            raise error
    
    def _generate_chart_title(self, metric_name: str, chart_type: str) -> str:
        """
        Generate a human-readable chart title
        
        Args:
            metric_name: Raw metric name
            chart_type: Type of chart
            
        Returns:
            Formatted chart title
        """
        # Extract the last part of dotted metric names
        clean_name = metric_name.split(".")[-1] if "." in metric_name else metric_name
        
        # Convert camelCase to spaced format
        import re
        formatted_name = re.sub(r'([A-Z])', r' \1', clean_name).strip()
        formatted_name = formatted_name.capitalize()
        
        type_map = {
            "line": "Trends",
            "bar": "Comparison", 
            "stacked-bar": "Breakdown",
            "heatmap": "Pattern Analysis",
            "waterfall": "Impact Analysis"
        }
        
        chart_suffix = type_map.get(chart_type, "Analysis")
        return f"{formatted_name} {chart_suffix}"
    
    def _calculate_chart_span(self, chart_type: str, total_charts: int) -> int:
        """
        Calculate chart span for layout (currently all charts take full width)
        
        Args:
            chart_type: Type of chart
            total_charts: Total number of charts
            
        Returns:
            Chart span value
        """
        # All charts take full width in single column layout
        return 4
    
    async def _generate_insights(self, charts: List[Dict[str, Any]], original_prompt: str) -> List[str]:
        """
        Generate insights about the dashboard
        
        Args:
            charts: List of charts in the dashboard
            original_prompt: Original user prompt
            
        Returns:
            List of insight strings
        """
        insights = []
        
        # Basic insights based on chart count and types
        if len(charts) > 3:
            insights.append(f"Generated {len(charts)} related charts for comprehensive analysis")
        
        chart_types = list(set(chart.get("chartType", "unknown") for chart in charts))
        if len(chart_types) > 2:
            insights.append("Multiple visualization types used for different data perspectives")
        
        # Add domain-specific insights
        has_time_series = any(chart.get("chartType") == "line" for chart in charts)
        has_comparison = any(chart.get("chartType") in ["bar", "stacked-bar"] for chart in charts)
        
        if has_time_series and has_comparison:
            insights.append("Dashboard includes both trend analysis and comparative metrics")
        
        return insights[:3]  # Limit to 3 insights
    
    def _generate_dashboard_id(self) -> str:
        """Generate unique dashboard ID"""
        return f"dashboard_{int(time.time())}_{self._generate_random_string()}"
    
    def _generate_random_string(self, length: int = 9) -> str:
        """Generate random string for IDs"""
        import string
        characters = string.ascii_lowercase + string.digits
        return ''.join(random.choice(characters) for _ in range(length))
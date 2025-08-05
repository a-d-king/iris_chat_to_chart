import json
import logging
from typing import Dict, Any, Optional
from openai import AsyncOpenAI
from app.config import config
from app.models.dtos import DataAnalysis

logger = logging.getLogger(__name__)

# OpenAI client will be initialized in the service

# OpenAI tool schema for chart creation
TOOL_SCHEMA = [{
    "type": "function",
    "function": {
        "name": "create_chart",
        "description": "Produce a simple chart spec",
        "parameters": {
            "type": "object",
            "properties": {
                "chartType": {
                    "enum": ["line", "bar", "stacked-bar", "heatmap", "waterfall"],
                    "description": "Type of chart to generate"
                },
                "metric": {
                    "type": "string",
                    "description": "The metric to display in the chart"
                },
                "groupBy": {
                    "type": "string",
                    "description": "Optional grouping dimension for the data"
                },
                "dateRange": {
                    "type": "string",
                    "pattern": "YYYY[-MM]",
                    "description": "Date range in YYYY or YYYY-MM format"
                }
            },
            "required": ["chartType", "metric", "dateRange"]
        }
    }
}]


class OpenAIService:
    """Service for handling OpenAI API interactions"""
    
    def __init__(self):
        self.openai = AsyncOpenAI(api_key=config.OPENAI_API_KEY)
    
    async def prompt(self, prompt: str, data_analysis: Optional[DataAnalysis] = None) -> Dict[str, Any]:
        """
        Send a prompt to GPT and get back a structured chart specification
        
        Args:
            prompt: Natural language description of the desired chart
            data_analysis: Analysis of available data for context
            
        Returns:
            Structured chart specification
        """
        primary_prompt = f"""You are a data visualization expert. Analyze this request and create the most appropriate chart specification.

USER REQUEST: "{prompt}"

CHART TYPE SELECTION GUIDELINES:
- **line**: Best for time series trends, showing change over time. Use for single or multiple metrics over dates.
- **bar**: Best for comparing values across categories or discrete time periods. Use when emphasis is on comparison, not trends.
- **stacked-bar**: Best for showing composition and part-to-whole relationships over categories or time.
- **heatmap**: Best for showing intensity/correlation patterns across two dimensions (e.g., time vs categories).
- **waterfall**: Best for showing cumulative effect of sequential positive/negative changes.

DATA STRUCTURE MAPPING:
- **timeSeries metrics**: Work best with line charts (trends) or bar charts (period comparison)
- **groupedSeries metrics**: Ideal for stacked-bar (composition) or multi-line charts (comparison)
- **scalar metrics**: Use bar charts for single values or combine with other metrics

ANALYSIS APPROACH:
1. First, identify the user's analytical intent (trend analysis, comparison, composition, etc.)
2. Consider the temporal aspect - are they asking about changes over time?
3. Match the intent with the most suitable chart type
4. Choose date ranges that make sense for the analysis (broader for trends, specific for snapshots)

USER INTENT KEYWORDS:
- "trend/trending/over time/growth/decline" → line chart
- "compare/comparison/vs/versus/against" → bar chart  
- "breakdown/composition/parts/segments" → stacked-bar chart
- "pattern/correlation/intensity" → heatmap chart
- "impact/effect/contribution/waterfall" → waterfall chart"""

        if data_analysis:
            primary_prompt += f"\n\nAVAILABLE DATA CONTEXT:\n{data_analysis.dataDescription}"
            
            primary_prompt += "\n\nAVAILABLE METRICS:"
            for metric in data_analysis.availableMetrics:
                primary_prompt += f"\n- **{metric.name}**: {metric.description}"
                primary_prompt += f"\n  └ Type: {metric.type}, Values: {metric.valueType}"
                
                # Add chart type suggestions based on metric type
                if metric.type == "timeSeries":
                    primary_prompt += " → Recommended: line (trends) or bar (periods)"
                elif metric.type == "groupedSeries":
                    primary_prompt += " → Recommended: stacked-bar (composition) or line (comparison)"
                elif metric.type == "scalar":
                    primary_prompt += " → Recommended: bar (single value)"
            
            if data_analysis.suggestedChartTypes:
                primary_prompt += "\n\nAUTO-GENERATED SUGGESTIONS:"
                for suggestion in data_analysis.suggestedChartTypes:
                    primary_prompt += f"\n- {suggestion.chartType}: {suggestion.reasoning} (confidence: {suggestion.confidence})"
            
            primary_prompt += """\n\nEXAMPLES OF GOOD SELECTIONS:
- "Show revenue trends" → line chart with revenue metric, full date range
- "Compare channels" → stacked-bar chart with revenue grouped by channel
- "June performance" → bar chart with key metrics, dateRange: "2025-06"
- "User growth over time" → line chart with user metrics, broad date range"""

        primary_prompt += """\n\nIMPORTANT: 
- Choose the chart type that best matches the user's analytical intent
- Select appropriate date ranges (specific months for snapshots, full year for trends)
- If the request is ambiguous, default to the most informative visualization
- Prioritize clarity and insight over complexity"""

        response = await self.openai.chat.completions.create(
            model="gpt-4o",
            temperature=0,  # Deterministic responses
            messages=[{
                "role": "user",
                "content": primary_prompt
            }],
            tools=TOOL_SCHEMA,
            tool_choice={"type": "function", "function": {"name": "create_chart"}}
        )

        logger.info(f"OpenAI Response: {json.dumps(dict(response.choices[0].message), indent=2)}")

        # Parse the tool call arguments into a chart spec object
        tool_call = response.choices[0].message.tool_calls[0] if response.choices[0].message.tool_calls else None
        if tool_call and tool_call.function and tool_call.function.arguments:
            logger.info("Tool call successful, parsing arguments")
            return json.loads(tool_call.function.arguments)
        else:
            raise Exception("OpenAI did not return a valid tool call response")
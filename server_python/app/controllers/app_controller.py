import logging
import time
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any

from app.models.dtos import (
    ChatDto, FeedbackDto, DashboardDto, 
    ChartResponse, DashboardResponse, AuditStatsResponse, FeedbackStatsResponse
)
from app.services.openai_service import OpenAIService
from app.services.metrics_service import MetricsService
from app.services.audit_service import AuditService
from app.services.dashboard_service import DashboardService

logger = logging.getLogger(__name__)

router = APIRouter()

# Dependency injection
async def get_openai_service() -> OpenAIService:
    return OpenAIService()

async def get_metrics_service() -> MetricsService:
    return MetricsService()

async def get_audit_service() -> AuditService:
    return AuditService()

async def get_dashboard_service() -> DashboardService:
    return DashboardService()


@router.post("/chat", response_model=ChartResponse)
async def chat(
    body: ChatDto,
    ai_service: OpenAIService = Depends(get_openai_service),
    metrics_service: MetricsService = Depends(get_metrics_service),
    audit_service: AuditService = Depends(get_audit_service)
) -> Dict[str, Any]:
    """
    POST /chat endpoint
    Takes a natural language prompt, converts it to a chart spec via OpenAI,
    fetches the relevant data, and returns the complete chart configuration
    """
    start_time = time.time()
    
    try:
        # Step 1: Get data analysis for context (use provided dateRange or default)
        effective_date_range = body.dateRange
        data_analysis = await metrics_service.get_data_analysis(effective_date_range)
        
        # Step 2: Convert natural language prompt to structured chart spec with context
        spec = await ai_service.prompt(body.prompt, data_analysis)
        
        # Step 3: Fetch the relevant data based on the chart spec
        # Use the provided dateRange from frontend if available, otherwise use spec.dateRange
        final_date_range = body.dateRange or spec["dateRange"]
        data = await metrics_service.slice(
            spec["metric"],
            final_date_range,
            spec.get("groupBy")
        )
        
        response_time = int((time.time() - start_time) * 1000)
        
        # Step 4: Audit the chart generation
        request_id = await audit_service.log_chart_generation(
            body.prompt,
            spec,
            data,
            data_analysis,
            {
                "dataSource": "Iris Finance API",
                "responseTimeMs": response_time,
                "metricsCount": len(data_analysis.availableMetrics)
            }
        )
        
        # Step 5: Return combined spec and data for the frontend
        return {
            **spec,
            "data": data,
            "requestId": request_id,
            "originalPrompt": body.prompt,
            "dataAnalysis": {
                "totalMetrics": len(data_analysis.availableMetrics),
                "suggestedChartTypes": [s.chartType for s in data_analysis.suggestedChartTypes]
            }
        }
        
    except Exception as error:
        response_time = int((time.time() - start_time) * 1000)
        error_message = str(error)
        
        logger.error(f"Chat endpoint error: {error_message}", extra={
            "prompt": body.prompt,
            "error": error_message,
            "responseTime": response_time,
            "error_type": type(error).__name__
        })
        
        if "not found in dataset" in error_message:
            raise HTTPException(
                status_code=400,
                detail=f"I couldn't find the requested metric in the data. {error_message.split('Available metrics:')[1] if 'Available metrics:' in error_message else ''}"
            )
        elif "Date range" in error_message:
            raise HTTPException(
                status_code=400,
                detail="Invalid date range format. Please use YYYY or YYYY-MM format (e.g., '2025' or '2025-06')."
            )
        elif "OpenAI" in error_message or "tool call" in error_message:
            raise HTTPException(
                status_code=400,
                detail="I had trouble understanding your request. Please try rephrasing it more clearly."
            )
        elif "Unsupported metric type" in error_message:
            raise HTTPException(
                status_code=400,
                detail="This metric type is not yet supported for visualization. Please try a different metric."
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Something went wrong while generating your chart. Please try again or contact support."
            )


@router.get("/audit/stats", response_model=AuditStatsResponse)
async def get_audit_stats(
    audit_service: AuditService = Depends(get_audit_service)
) -> Dict[str, Any]:
    """
    GET /audit/stats endpoint
    Returns audit statistics for monitoring and analysis
    """
    try:
        stats = await audit_service.get_audit_stats()
        return {
            "success": True,
            "stats": stats
        }
    except Exception as error:
        logger.error(f"Error getting audit stats: {error}")
        return {
            "success": False,
            "error": "Failed to get audit statistics"
        }


@router.post("/dashboard", response_model=DashboardResponse)
async def generate_dashboard(
    body: DashboardDto,
    dashboard_service: DashboardService = Depends(get_dashboard_service),
    audit_service: AuditService = Depends(get_audit_service),
    metrics_service: MetricsService = Depends(get_metrics_service)
) -> Dict[str, Any]:
    """
    POST /dashboard endpoint
    Takes a natural language prompt and generates multiple related charts
    """
    start_time = time.time()
    
    try:
        result = await dashboard_service.generate_dashboard(body)
        logger.info(f"Dashboard service result keys: {list(result.keys())}")
        
        # Audit the dashboard generation
        request_id = await audit_service.log_chart_generation(
            body.prompt,
            {"chartType": "dashboard", "metric": "multiple", "dateRange": body.dateRange or "2025-06"},
            {"charts": result["charts"], "totalCharts": len(result["charts"])},
            await metrics_service.get_data_analysis(),
            {
                "dataSource": "Iris Finance API",
                "responseTimeMs": int((time.time() - start_time) * 1000),
                "metricsCount": len(result["charts"])
            }
        )
        
        # Ensure dashboardId is always present for frontend compatibility
        dashboard_id = request_id  # Use request_id as dashboard_id for simplicity
        
        return {
            "charts": result["charts"],
            "insights": result.get("insights"),
            "requestId": request_id,
            "dashboardId": dashboard_id,
            "originalPrompt": body.prompt,
            "metadata": result.get("metadata", {})
        }
        
    except Exception as error:
        logger.error(f"Error generating dashboard: {error}")
        raise HTTPException(status_code=500, detail="Failed to generate dashboard")


@router.post("/feedback")
async def submit_feedback(
    body: FeedbackDto,
    audit_service: AuditService = Depends(get_audit_service)
) -> Dict[str, Any]:
    """
    POST /feedback endpoint
    Accepts user feedback for generated charts
    """
    try:
        await audit_service.add_feedback(
            body.requestId,
            body.rating,
            body.comment,
            body.chartId
        )
        
        return {
            "success": True,
            "message": "Feedback submitted successfully"
        }
        
    except Exception as error:
        logger.error(f"Error submitting feedback: {error}")
        raise HTTPException(status_code=500, detail="Failed to submit feedback")


@router.get("/feedback/stats", response_model=FeedbackStatsResponse)
async def get_feedback_stats(
    audit_service: AuditService = Depends(get_audit_service)
) -> Dict[str, Any]:
    """
    GET /feedback/stats endpoint
    Returns aggregated feedback statistics for analytics
    """
    try:
        return await audit_service.get_feedback_stats()
    except Exception as error:
        logger.error(f"Error getting feedback stats: {error}")
        raise HTTPException(status_code=500, detail="Failed to get feedback statistics")


@router.get("/test")
async def test_services():
    """Test endpoint to verify services are working without external API calls"""
    try:
        # Test data analysis service
        from app.services.data_analysis_service import DataAnalysisService
        analysis_service = DataAnalysisService()
        
        # Test with mock data
        mock_data = {
            "sales": 1000,
            "revenue": [
                {"date": "2025-01-01", "value": 500},
                {"date": "2025-01-02", "value": 600}
            ]
        }
        
        analysis = analysis_service.analyze_data(mock_data)
        
        return {
            "status": "success",
            "message": "Services are working correctly",
            "mock_analysis": {
                "metrics_found": len(analysis.availableMetrics),
                "chart_suggestions": len(analysis.suggestedChartTypes)
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Service test failed: {str(e)}"
        }

@router.get("/debug/data")
async def debug_data():
    """Debug endpoint to test data loading"""
    try:
        metrics_service = MetricsService()
        data_analysis = await metrics_service.get_data_analysis()
        
        return {
            "status": "success",
            "message": "Data loaded successfully",
            "metrics_count": len(data_analysis.availableMetrics),
            "sample_metrics": [m.name for m in data_analysis.availableMetrics[:5]]
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Data loading failed: {str(e)}"
        }
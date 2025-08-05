from fastapi import Depends
from app.services.openai_service import OpenAIService
from app.services.metrics_service import MetricsService
from app.services.audit_service import AuditService
from app.services.dashboard_service import DashboardService
from app.services.data_analysis_service import DataAnalysisService
from app.services.iris_api_service import IrisApiService

# Dependency injection functions
async def get_openai_service() -> OpenAIService:
    return OpenAIService()

async def get_metrics_service() -> MetricsService:
    return MetricsService()

async def get_audit_service() -> AuditService:
    return AuditService()

async def get_dashboard_service() -> DashboardService:
    return DashboardService()

async def get_data_analysis_service() -> DataAnalysisService:
    return DataAnalysisService()

async def get_iris_api_service() -> IrisApiService:
    return IrisApiService()
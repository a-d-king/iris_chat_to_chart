import asyncio
import aiofiles
import json
import logging
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional, Literal
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class ChartFeedback(BaseModel):
    """Chart feedback data structure"""
    rating: Literal[1, 2, 3, 4, 5]
    timestamp: str
    comment: Optional[str] = None
    chart_id: Optional[str] = None


class AuditLogEntry(BaseModel):
    """Audit log entry data structure"""
    timestamp: str
    request_id: str
    user_prompt: str
    chart_spec: Dict[str, Any]
    data_used: Dict[str, Any]
    data_analysis: Dict[str, Any]
    metadata: Dict[str, Any]
    feedback: Optional[ChartFeedback] = None


class DashboardAuditData(BaseModel):
    """Dashboard audit data formatted for PostgreSQL"""
    request_id: str
    timestamp: datetime
    user_prompt: str
    request_type: str
    chart_schemas: List[Dict[str, Any]]
    total_charts: int
    response_time_ms: int
    metadata: Dict[str, Any]


class FeedbackStats(BaseModel):
    """Feedback statistics data structure"""
    total_feedback: int
    average_rating: float
    rating_distribution: Dict[int, int]


class AuditStats(BaseModel):
    """Audit statistics data structure"""
    total_requests: int
    today_requests: int
    chart_type_breakdown: Dict[str, int]
    average_response_time: float


class AuditService:
    """
    Service for auditing chart generation requests
    Saves data used in chart generation for compliance/debugging and extension to saving to a database
    """
    
    def __init__(self):
        # Set audit directory relative to the service file location
        current_dir = Path(__file__).parent.parent
        self.audit_dir = current_dir / "audit-logs"
        
        # Ensure audit directory exists
        asyncio.create_task(self._ensure_audit_directory_exists())
    
    async def _ensure_audit_directory_exists(self) -> None:
        """Ensure the audit directory exists"""
        try:
            if not self.audit_dir.exists():
                self.audit_dir.mkdir(parents=True, exist_ok=True)
                logger.info(f"Created audit directory: {self.audit_dir}")
        except Exception as error:
            logger.error(f"Error creating audit directory: {error}")
            raise
    
    def _generate_request_id(self) -> str:
        """Generate a unique request ID"""
        timestamp = int(time.time() * 1000)  # milliseconds for higher precision
        import random
        import string
        random_part = ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))
        return f"{timestamp}-{random_part}"
    
    async def log_chart_generation(
        self,
        user_prompt: str,
        chart_spec: Dict[str, Any],
        data_used: Any,
        data_analysis: Any,
        metadata: Dict[str, Any]
    ) -> str:
        """
        Log a chart generation request
        
        Args:
            user_prompt: The user's natural language prompt
            chart_spec: The generated chart specification
            data_used: The actual data used in the chart
            data_analysis: The data analysis context
            metadata: Additional metadata (dataSource, responseTimeMs, metricsCount)
            
        Returns:
            The unique request ID for this log entry
        """
        await self._ensure_audit_directory_exists()
        
        request_id = self._generate_request_id()
        timestamp = datetime.now().isoformat()
        
        # Convert objects to dictionaries if needed
        data_used_dict = data_used.model_dump() if hasattr(data_used, 'model_dump') else data_used
        data_analysis_dict = data_analysis.model_dump() if hasattr(data_analysis, 'model_dump') else data_analysis
        
        audit_entry = AuditLogEntry(
            timestamp=timestamp,
            request_id=request_id,
            user_prompt=user_prompt,
            chart_spec=chart_spec,
            data_used=data_used_dict,
            data_analysis=data_analysis_dict,
            metadata=metadata
        )
        
        filename = f"chart-{request_id}.json"
        filepath = self.audit_dir / filename
        
        try:
            async with aiofiles.open(filepath, 'w', encoding='utf-8') as f:
                content = audit_entry.model_dump_json(indent=2)
                await f.write(content)
            
            logger.info(f"Audit log saved: {filename}")
            return request_id
            
        except Exception as error:
            logger.error(f"Error saving audit log: {error}")
            raise Exception("Failed to save audit log")
    
    async def add_feedback(
        self,
        request_id: str,
        rating: Literal[1, 2, 3, 4, 5],
        comment: Optional[str] = None,
        chart_id: Optional[str] = None
    ) -> None:
        """
        Add feedback to an existing audit log entry
        
        Args:
            request_id: The request ID from the original chart generation
            rating: User rating from 1-5
            comment: Optional feedback comment
            chart_id: Optional chart identifier for dashboard feedback
        """
        feedback = ChartFeedback(
            rating=rating,
            timestamp=datetime.now().isoformat(),
            comment=comment,
            chart_id=chart_id
        )
        
        # Update the audit log file
        filename = f"chart-{request_id}.json"
        filepath = self.audit_dir / filename
        
        try:
            # Read existing data
            async with aiofiles.open(filepath, 'r', encoding='utf-8') as f:
                content = await f.read()
                audit_data = json.loads(content)
            
            # Create audit entry and add feedback
            audit_entry = AuditLogEntry(**audit_data)
            audit_entry.feedback = feedback
            
            # Write back updated data
            async with aiofiles.open(filepath, 'w', encoding='utf-8') as f:
                content = audit_entry.model_dump_json(indent=2)
                await f.write(content)
            
            logger.info(f"Feedback added to audit log: {filename}")
            
        except FileNotFoundError:
            logger.error(f"Audit log file not found: {filename}")
            raise Exception("Audit log not found")
        except Exception as error:
            logger.error(f"Error adding feedback to audit log: {error}")
            raise Exception("Failed to save feedback")
    
    async def get_feedback_stats(self) -> FeedbackStats:
        """
        Get feedback statistics across all audit logs
        
        Returns:
            Aggregated feedback statistics
        """
        try:
            await self._ensure_audit_directory_exists()
            
            # Get all audit files
            audit_files = [
                f for f in self.audit_dir.iterdir()
                if f.name.startswith('chart-') and f.name.endswith('.json')
            ]
            
            total_feedback = 0
            rating_sum = 0
            rating_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            
            for file_path in audit_files:
                try:
                    async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        entry_data = json.loads(content)
                        
                    if 'feedback' in entry_data and entry_data['feedback']:
                        feedback_data = entry_data['feedback']
                        rating = feedback_data['rating']
                        
                        total_feedback += 1
                        rating_sum += rating
                        rating_distribution[rating] += 1
                        
                except (json.JSONDecodeError, KeyError, TypeError):
                    # Skip invalid files
                    logger.warning(f"Skipping invalid audit file: {file_path.name}")
                    continue
            
            average_rating = rating_sum / total_feedback if total_feedback > 0 else 0.0
            
            return FeedbackStats(
                total_feedback=total_feedback,
                average_rating=average_rating,
                rating_distribution=rating_distribution
            )
            
        except Exception as error:
            logger.error(f"Error calculating feedback stats: {error}")
            return FeedbackStats(
                total_feedback=0,
                average_rating=0.0,
                rating_distribution={1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            )
    
    async def get_audit_stats(self) -> AuditStats:
        """
        Get audit statistics
        
        Returns:
            Aggregated audit statistics
        """
        try:
            await self._ensure_audit_directory_exists()
            
            # Get all chart files
            chart_files = [
                f for f in self.audit_dir.iterdir()
                if f.name.startswith('chart-') and f.name.endswith('.json')
            ]
            
            today = datetime.now().date().isoformat()
            today_files = [f for f in chart_files if today in f.name]
            
            # Sample recent files for performance (max 100)
            sample_size = min(100, len(chart_files))
            sample_files = chart_files[-sample_size:] if chart_files else []
            
            chart_type_breakdown: Dict[str, int] = {}
            total_response_time = 0
            valid_samples = 0
            
            for file_path in sample_files:
                try:
                    async with aiofiles.open(file_path, 'r', encoding='utf-8') as f:
                        content = await f.read()
                        entry_data = json.loads(content)
                    
                    # Extract chart type
                    chart_spec = entry_data.get('chart_spec', {})
                    chart_type = chart_spec.get('chartType', 'unknown')
                    chart_type_breakdown[chart_type] = chart_type_breakdown.get(chart_type, 0) + 1
                    
                    # Extract response time
                    metadata = entry_data.get('metadata', {})
                    response_time = metadata.get('responseTimeMs', 0)
                    if response_time > 0:
                        total_response_time += response_time
                        valid_samples += 1
                        
                except (json.JSONDecodeError, KeyError, TypeError):
                    logger.warning(f"Skipping invalid audit file: {file_path.name}")
                    continue
            
            average_response_time = total_response_time / valid_samples if valid_samples > 0 else 0.0
            
            return AuditStats(
                total_requests=len(chart_files),
                today_requests=len(today_files),
                chart_type_breakdown=chart_type_breakdown,
                average_response_time=average_response_time
            )
            
        except Exception as error:
            logger.error(f"Error getting audit stats: {error}")
            return AuditStats(
                total_requests=0,
                today_requests=0,
                chart_type_breakdown={},
                average_response_time=0.0
            )
    
    async def prepare_for_database(
        self,
        user_prompt: str,
        dashboard_result: Dict[str, Any],
        dashboard_type: Literal['standard', 'enhanced'],
        metadata: Dict[str, Any],
        requirements: Optional[Dict[str, Any]] = None
    ) -> DashboardAuditData:
        """
        Prepare dashboard audit data for database insertion
        Call this after dashboard generation to get formatted data for your existing DB
        
        Args:
            user_prompt: The user's prompt
            dashboard_result: The generated dashboard result
            dashboard_type: Type of dashboard ('standard' or 'enhanced')
            metadata: Metadata including dataSource, responseTimeMs, metricsCount, etc.
            requirements: Optional requirements data
            
        Returns:
            Formatted audit data ready for database insertion
        """
        request_id = self._generate_request_id()
        
        # Extract chart schemas for JSONB storage
        charts = dashboard_result.get('charts', [])
        chart_schemas = []
        
        for chart in charts:
            schema = {
                "id": chart.get("id"),
                "chartType": chart.get("chartType"),
                "metric": chart.get("metric"),
                "dateRange": chart.get("dateRange"),
                "title": chart.get("title"),
                "groupBy": chart.get("groupBy"),
                "row": chart.get("row"),
                "col": chart.get("col"),
                "span": chart.get("span"),
                "analysisType": chart.get("analysisType"),
                "context": chart.get("context")
            }
            chart_schemas.append(schema)
        
        # Determine request type
        request_type = "enhanced-dashboard" if dashboard_type == "enhanced" else "dashboard"
        
        return DashboardAuditData(
            request_id=request_id,
            timestamp=datetime.now(),
            user_prompt=user_prompt,
            request_type=request_type,
            chart_schemas=chart_schemas,
            total_charts=len(chart_schemas),
            response_time_ms=metadata.get("responseTimeMs", 0),
            metadata={
                "dataSource": metadata.get("dataSource"),
                "metricsCount": metadata.get("metricsCount"),
                "analysisType": metadata.get("analysisType"),
                "context": metadata.get("context"),
                "requirements": requirements
            }
        )
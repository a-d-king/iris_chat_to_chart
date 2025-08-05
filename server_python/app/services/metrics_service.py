import logging
from typing import Dict, Any, List, Optional
from cachetools import TTLCache
from app.models.dtos import MetricInfo, DataAnalysis
from app.services.data_analysis_service import DataAnalysisService
from app.services.iris_api_service import IrisApiService
import re

logger = logging.getLogger(__name__)


class MetricsService:
    """Service for handling metrics data operations with caching"""
    
    def __init__(self):
        self.cache: TTLCache = TTLCache(maxsize=100, ttl=3600)  # 1 hour TTL
        self.data_analysis: Optional[DataAnalysis] = None
        self.data_analysis_service = DataAnalysisService()
        self.iris_api_service = IrisApiService()
    
    async def load(self, date_range: Optional[str] = None) -> Dict[str, Any]:
        """
        Load metrics data from Iris Finance API with caching to improve performance
        
        Args:
            date_range: Optional date range for API calls
            
        Returns:
            The loaded metrics data
        """
        # Create cache key based on date range
        cache_key = date_range or "default"
        
        if cache_key not in self.cache:
            try:
                logger.info("🌐 Loading data from Iris Finance API...")
                data = await self.iris_api_service.fetch_metrics(date_range)
                
                self.cache[cache_key] = data
                self.data_analysis = self.data_analysis_service.analyze_data(data)
                logger.info(f"✅ Detected {len(self.data_analysis.availableMetrics)} metrics in the dataset")
                
            except Exception as error:
                logger.error(f"❌ Error loading metrics data from API: {error}")
                raise Exception("Failed to load metrics data from Iris Finance API")
        
        return self.cache[cache_key]
    
    async def get_data_analysis(self, date_range: Optional[str] = None) -> DataAnalysis:
        """
        Get data analysis results
        
        Args:
            date_range: Optional date range for API calls
            
        Returns:
            Data analysis including available metrics and suggestions
        """
        await self.load(date_range)
        return self.data_analysis
    
    async def slice(self, metric: str, date_range: str, group_by: Optional[str] = None) -> Dict[str, Any]:
        """
        Slice metrics data based on the specified parameters
        
        Args:
            metric: The metric name to retrieve
            date_range: Date range filter (YYYY or YYYY-MM)
            group_by: Optional grouping dimension (unused in current implementation)
            
        Returns:
            The sliced data ready for charting
        """
        try:
            data = await self.load(date_range)
            analysis = self.data_analysis
            
            # Validate inputs
            if not metric or metric.strip() == "":
                raise Exception("Metric name is required")
            
            if not date_range or date_range.strip() == "":
                raise Exception("Date range is required")
            
            # Validate date range format - support YYYY, YYYY-MM, YYYY-MM-DD, and custom ranges
            is_valid_format = (
                bool(re.match(r'^\d{4}(-\d{2})?$', date_range)) or          # YYYY or YYYY-MM
                bool(re.match(r'^\d{4}-\d{2}-\d{2}$', date_range)) or        # YYYY-MM-DD
                bool(re.match(r'^\d{4}-\d{2}-\d{2}T.*,\d{4}-\d{2}-\d{2}T.*$', date_range))  # Custom ISO range
            )
            
            if not is_valid_format:
                raise Exception("Date range must be in YYYY, YYYY-MM, YYYY-MM-DD, or custom range format")
            
            # Find the matching metric with flexible matching
            metric_info = next(
                (m for m in analysis.availableMetrics if m.name.lower() == metric.lower()),
                None
            )
            
            # If exact match not found, try partial matching
            if not metric_info:
                metric_info = next(
                    (m for m in analysis.availableMetrics 
                     if metric.lower() in m.name.lower() or m.name.lower() in metric.lower()),
                    None
                )
            
            if not metric_info:
                available_metrics = [m.name for m in analysis.availableMetrics]
                raise Exception(
                    f'Metric "{metric}" not found in dataset. Available metrics: {", ".join(available_metrics)}'
                )
            
            # Handle different data structures based on metric type
            if metric_info.type == "timeSeries":
                return self._slice_time_series(data, metric_info, date_range)
            elif metric_info.type == "groupedSeries":
                return self._slice_grouped_series(data, metric_info, date_range)
            elif metric_info.type == "scalar":
                return self._slice_scalar(data, metric_info)
            elif metric_info.type == "dynamicKeyObject":
                return self._slice_dynamic_key_object(data, metric_info)
            elif metric_info.type == "embeddedMetrics":
                return self._slice_embedded_metrics(data, metric_info)
            elif metric_info.type == "array":
                return self._slice_array(data, metric_info)
            else:
                raise Exception(f"Unsupported metric type: {metric_info.type}")
                
        except Exception as error:
            error_message = str(error)
            logger.error(f"Error in metrics slice: {error_message}", extra={
                "metric": metric,
                "date_range": date_range, 
                "group_by": group_by
            })
            
            if any(keyword in error_message for keyword in ["not found", "required", "format"]):
                raise error
            else:
                raise Exception(f'Failed to process metric "{metric}": {error_message}')
    
    def _slice_time_series(self, data: Dict[str, Any], metric_info: MetricInfo, date_range: str) -> Dict[str, Any]:
        """Extract time series data"""
        raw_data = self._get_nested_value(data, metric_info.name)
        
        if not raw_data or not isinstance(raw_data, list):
            return {"dates": [], "values": []}
        
        # Filter by date range if specified
        filtered_data = raw_data
        if date_range:
            filtered_data = []
            for item in raw_data:
                if not item.get("date"):
                    continue
                
                # Handle custom ISO date ranges (e.g., "2025-05-06T00:00:00.000Z,2025-08-04T23:59:59.999Z")
                if "," in date_range:
                    start_iso, end_iso = date_range.split(",")
                    start_date = start_iso.split("T")[0]  # Extract YYYY-MM-DD part
                    end_date = end_iso.split("T")[0]      # Extract YYYY-MM-DD part  
                    item_date = item["date"].split("T")[0]  # Extract YYYY-MM-DD part from item
                    
                    if start_date <= item_date <= end_date:
                        filtered_data.append(item)
                
                # Handle YYYY-MM-DD format
                elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_range):
                    if item["date"].startswith(date_range):
                        filtered_data.append(item)
                
                # Handle month-specific filter (e.g., "2025-06")
                elif "-" in date_range:
                    if item["date"] and item["date"].startswith(date_range):
                        filtered_data.append(item)
                else:
                    # Year filter (e.g., "2025")
                    if item["date"] and item["date"].startswith(date_range):
                        filtered_data.append(item)
        
        # Convert to AG Chart format
        return {
            "dates": [item["date"] for item in filtered_data],
            "values": [{
                "label": metric_info.description,
                "values": [item["value"] for item in filtered_data]
            }]
        }
    
    def _slice_grouped_series(self, data: Dict[str, Any], metric_info: MetricInfo, date_range: str) -> Dict[str, Any]:
        """Extract grouped series data"""
        # Handle nested path metrics (like dataBySalesConnectors.grossSales)
        if hasattr(metric_info, 'name') and "." in metric_info.name:
            return self._slice_nested_grouped_series(data, metric_info, date_range)
        
        raw_data = self._get_nested_value(data, metric_info.name)
        
        if not raw_data or not raw_data.get("dates") or not raw_data.get("values"):
            return {"dates": [], "values": []}
        
        # Filter by date range if specified
        dates = raw_data["dates"]
        values = raw_data["values"]
        
        if date_range:
            filtered_indices: List[int] = []
            for index, date in enumerate(dates):
                # Handle custom ISO date ranges
                if "," in date_range:
                    start_iso, end_iso = date_range.split(",")
                    start_date = start_iso.split("T")[0]
                    end_date = end_iso.split("T")[0]
                    item_date = date.split("T")[0]
                    
                    if start_date <= item_date <= end_date:
                        filtered_indices.append(index)
                
                # Handle YYYY-MM-DD format
                elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_range):
                    if date.startswith(date_range):
                        filtered_indices.append(index)
                
                # Handle month/year formats
                elif "-" in date_range:
                    if date.startswith(date_range):
                        filtered_indices.append(index)
                else:
                    if date.startswith(date_range):
                        filtered_indices.append(index)
            
            dates = [dates[i] for i in filtered_indices]
            values = [
                {
                    "label": series["label"],
                    "values": [series["values"][i] for i in filtered_indices]
                }
                for series in values
            ]
        
        return {"dates": dates, "values": values}
    
    def _slice_nested_grouped_series(self, data: Dict[str, Any], metric_info: MetricInfo, date_range: str) -> Dict[str, Any]:
        """Extract nested grouped series data (for metrics like dataBySalesConnectors.grossSales)"""
        path_parts = metric_info.name.split(".")
        container_path = ".".join(path_parts[:-1])
        metric_key = path_parts[-1]
        
        container_data = self._get_nested_value(data, container_path)
        
        if not isinstance(container_data, list):
            return {"dates": [], "values": []}
        
        # Special case: If this is a time series array (has date/value objects) and we're extracting 'value'
        # then convert it to proper time series format instead of treating as grouped series
        if (metric_key == "value" and container_data and 
            container_data[0].get("date") and "value" in container_data[0]):
            
            # Filter by date range if specified
            filtered_data = container_data
            if date_range:
                filtered_data = []
                for item in container_data:
                    if not item.get("date"):
                        continue
                    
                    # Handle custom ISO date ranges
                    if "," in date_range:
                        start_iso, end_iso = date_range.split(",")
                        start_date = start_iso.split("T")[0]
                        end_date = end_iso.split("T")[0]
                        item_date = item["date"].split("T")[0]
                        
                        if start_date <= item_date <= end_date:
                            filtered_data.append(item)
                    
                    # Handle YYYY-MM-DD format
                    elif re.match(r'^\d{4}-\d{2}-\d{2}$', date_range):
                        if item["date"].startswith(date_range):
                            filtered_data.append(item)
                    
                    # Handle month/year formats
                    elif "-" in date_range:
                        if item["date"] and item["date"].startswith(date_range):
                            filtered_data.append(item)
                    else:
                        if item["date"] and item["date"].startswith(date_range):
                            filtered_data.append(item)
            
            # Return as time series format
            return {
                "dates": [item["date"] for item in filtered_data],
                "values": [{
                    "label": metric_info.description,
                    "values": [item["value"] for item in filtered_data]
                }]
            }
        
        # Original logic for true grouped series (like dataBySalesConnectors)
        categories = [
            item.get("connector") or item.get("label") or item.get("name") or "Unknown"
            for item in container_data
        ]
        values = [item.get(metric_key, 0) for item in container_data]
        
        return {
            "dates": categories,
            "values": [{
                "label": metric_info.description,
                "values": values
            }]
        }
    
    def _slice_scalar(self, data: Dict[str, Any], metric_info: MetricInfo) -> Dict[str, Any]:
        """Extract scalar data"""
        value = self._get_nested_value(data, metric_info.name)
        
        return {
            "dates": ["Total"],
            "values": [{
                "label": metric_info.description,
                "values": [value]
            }]
        }
    
    def _slice_dynamic_key_object(self, data: Dict[str, Any], metric_info: MetricInfo) -> Dict[str, Any]:
        """Extract data from dynamic key objects (like cashDetails, creditCardDetails)"""
        raw_data = self._get_nested_value(data, metric_info.name)
        
        if not raw_data or not isinstance(raw_data, dict):
            return {"dates": [], "values": []}
        
        entries = list(raw_data.items())
        if not entries:
            return {"dates": [], "values": []}
        
        # If this is a container metric, return summary of all accounts
        if "." not in metric_info.name or len(metric_info.name.split(".")) == 1:
            categories = [
                value.get("name") or value.get("officialName") or key
                for key, value in entries
            ]
            
            # Get the first numeric property as the default metric
            first_entry = entries[0][1]
            first_numeric_key = next(
                (key for key, value in first_entry.items() if isinstance(value, (int, float))),
                None
            )
            
            if not first_numeric_key:
                return {"dates": [], "values": []}
            
            values = [value.get(first_numeric_key, 0) for _, value in entries]
            
            return {
                "dates": categories,
                "values": [{
                    "label": f"{first_numeric_key} by account",
                    "values": values
                }]
            }
        
        # If this is a specific metric within the dynamic object
        path_parts = metric_info.name.split(".")
        metric_key = path_parts[-1]
        
        categories = [
            value.get("name") or value.get("officialName") or key
            for key, value in entries
        ]
        values = [value.get(metric_key, 0) for _, value in entries]
        
        return {
            "dates": categories,
            "values": [{
                "label": metric_info.description,
                "values": values
            }]
        }
    
    def _slice_embedded_metrics(self, data: Dict[str, Any], metric_info: MetricInfo) -> Dict[str, Any]:
        """Extract data from embedded metrics (like dataBySalesConnectors)"""
        raw_data = self._get_nested_value(data, metric_info.name)
        
        if not isinstance(raw_data, list) or not raw_data:
            return {"dates": [], "values": []}
        
        categories = [
            item.get("connector") or item.get("label") or item.get("name") or "Unknown"
            for item in raw_data
        ]
        
        # Get all numeric keys from the first item
        first_item = raw_data[0]
        numeric_keys = [
            key for key, value in first_item.items()
            if isinstance(value, (int, float)) and key != "date"
        ]
        
        if not numeric_keys:
            return {"dates": [], "values": []}
        
        # Create series for each numeric metric
        values = [
            {
                "label": key,
                "values": [item.get(key, 0) for item in raw_data]
            }
            for key in numeric_keys
        ]
        
        return {"dates": categories, "values": values}
    
    def _slice_array(self, data: Dict[str, Any], metric_info: MetricInfo) -> Dict[str, Any]:
        """Extract data from simple arrays"""
        raw_data = self._get_nested_value(data, metric_info.name)
        
        if not isinstance(raw_data, list) or not raw_data:
            return {"dates": [], "values": []}
        
        # Generate simple indices as categories (Item 1, Item 2, etc.)
        categories = [f"Item {index + 1}" for index in range(len(raw_data))]
        
        return {
            "dates": categories,
            "values": [{
                "label": metric_info.description,
                "values": [value if isinstance(value, (int, float)) else 0 for value in raw_data]
            }]
        }
    
    def _get_nested_value(self, obj: Dict[str, Any], path: str) -> Any:
        """Helper method to get nested values from object using dot notation"""
        current = obj
        for key in path.split("."):
            if current is None or not isinstance(current, dict) or key not in current:
                return None
            current = current[key]
        return current
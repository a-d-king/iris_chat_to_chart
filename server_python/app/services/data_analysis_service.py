import logging
from typing import Dict, Any, List, Optional, Tuple, Literal
from app.models.dtos import MetricInfo, ChartSuggestion, DataAnalysis

logger = logging.getLogger(__name__)

ValueType = Literal["currency", "percentage", "count", "generic"]
MetricType = Literal["timeSeries", "groupedSeries", "scalar", "dynamicKeyObject", "embeddedMetrics", "array"]
ChartType = Literal["line", "bar", "stacked-bar", "heatmap", "waterfall"]


class DataAnalysisService:
    """Service for analyzing data structure and providing intelligent chart recommendations"""
    
    def analyze_data(self, data: Any) -> DataAnalysis:
        """Analyze the loaded data and provide context for chart generation"""
        metrics = self._extract_metrics_recursively(data)
        suggestions = self._generate_chart_suggestions(metrics)
        description = self._generate_data_description(metrics, data)
        
        return DataAnalysis(
            availableMetrics=metrics,
            suggestedChartTypes=suggestions,
            dataDescription=description,
            totalDataPoints=len(metrics),
            dateRangeAvailable=self._detect_date_range(data)
        )
    
    def _extract_metrics_recursively(self, data: Any, key_path: List[str] = None, depth: int = 0) -> List[MetricInfo]:
        """Recursively extract and categorize all metrics from the data"""
        if key_path is None:
            key_path = []
            
        metrics: List[MetricInfo] = []
        max_depth = 10
        
        if depth > max_depth or not data or not isinstance(data, dict):
            return metrics
        
        for key, value in data.items():
            current_path = ".".join(key_path + [key]) if key_path else key
            full_path = key_path + [key]
            
            # Analyze current level metric
            metric = self._analyze_metric(key, value, current_path)
            if metric:
                metrics.append(metric)
            
            # Handle arrays of objects with embedded metrics
            if isinstance(value, list) and len(value) > 0 and isinstance(value[0], dict):
                embedded_metrics = self._extract_from_object_array(value, current_path)
                metrics.extend(embedded_metrics)
            
            # Handle dynamic key objects (cashDetails, creditCardDetails)
            if self._is_dynamic_key_object(value):
                dynamic_metrics = self._extract_from_dynamic_key_object(key, value, current_path)
                metrics.extend(dynamic_metrics)
            
            # Recurse into objects that aren't already handled
            if self._should_recurse_into(value, full_path):
                metrics.extend(self._extract_metrics_recursively(value, full_path, depth + 1))
        
        return metrics
    
    def _extract_from_object_array(self, array: List[Dict], base_path: str) -> List[MetricInfo]:
        """Extract metrics from arrays of objects with embedded metrics"""
        metrics: List[MetricInfo] = []
        
        if not array:
            return metrics
        
        first_item = array[0]
        numeric_keys = [key for key, value in first_item.items() 
                       if isinstance(value, (int, float)) and key != "date"]
        
        # Create a container metric for the array
        if numeric_keys:
            grouping_dimensions = [
                item.get("connector") or item.get("label") or item.get("name") or "Unknown"
                for item in array
            ]
            
            metrics.append(MetricInfo(
                name=base_path,
                type="embeddedMetrics",
                description=f"{self._generate_metric_description(base_path, 'embeddedMetrics')} containing {len(numeric_keys)} metrics",
                sampleValue=numeric_keys,
                valueType="generic",
                isTimeGrouped=False,
                groupingFields=grouping_dimensions
            ))
            
            # Create individual metrics for each numeric key
            for key in numeric_keys:
                metric_name = f"{base_path}.{key}"
                value_type = self._detect_value_type(key, first_item[key])
                
                metrics.append(MetricInfo(
                    name=metric_name,
                    type="groupedSeries",
                    description=f"{self._generate_metric_description(key, 'groupedSeries')} from {base_path}",
                    sampleValue=[item.get(key) for item in array[:3]],
                    valueType=value_type,
                    isTimeGrouped=False,
                    groupingFields=grouping_dimensions
                ))
        
        return metrics
    
    def _extract_from_dynamic_key_object(self, container_key: str, obj: Dict, base_path: str) -> List[MetricInfo]:
        """Extract metrics from objects with dynamic keys (like account IDs)"""
        metrics: List[MetricInfo] = []
        entries = list(obj.items())
        
        if not entries:
            return metrics
        
        first_key, first_value = entries[0]
        
        if isinstance(first_value, dict):
            numeric_keys = [key for key, value in first_value.items() 
                           if isinstance(value, (int, float))]
            
            # Create a container metric
            if numeric_keys:
                grouping_dimensions = [
                    value.get("name") or value.get("officialName") or key
                    for key, value in entries
                ]
                
                metrics.append(MetricInfo(
                    name=base_path,
                    type="dynamicKeyObject",
                    description=f"{self._generate_metric_description(container_key, 'dynamicKeyObject')} with {len(entries)} accounts",
                    sampleValue=numeric_keys,
                    valueType="generic",
                    isTimeGrouped=False,
                    groupingFields=grouping_dimensions
                ))
                
                # Create individual metrics for each numeric property
                for key in numeric_keys:
                    metric_name = f"{base_path}.{key}"
                    value_type = self._detect_value_type(key, first_value[key])
                    
                    metrics.append(MetricInfo(
                        name=metric_name,
                        type="groupedSeries",
                        description=f"{self._generate_metric_description(key, 'groupedSeries')} across {container_key}",
                        sampleValue=[value.get(key) for _, value in entries[:3]],
                        valueType=value_type,
                        isTimeGrouped=False,
                        groupingFields=grouping_dimensions
                    ))
        
        return metrics
    
    def _is_dynamic_key_object(self, value: Any) -> bool:
        """Check if an object has dynamic keys (like account IDs)"""
        if not isinstance(value, dict) or not value:
            return False
        
        entries = list(value.items())
        if not entries:
            return False
        
        # Check if keys look like IDs (long alphanumeric strings) or UUIDs
        has_id_like_keys = all(
            len(key) > 20 and key.replace("-", "").isalnum()
            for key, _ in entries
        )
        
        # Check if all values have similar structure
        first_value = entries[0][1]
        if not isinstance(first_value, dict):
            return False
        
        first_keys = set(first_value.keys())
        all_similar_structure = all(
            isinstance(val, dict) and set(val.keys()) == first_keys
            for _, val in entries
        )
        
        return has_id_like_keys and all_similar_structure
    
    def _should_recurse_into(self, value: Any, path: List[str]) -> bool:
        """Check if we should recurse into this object"""
        if not isinstance(value, dict) or not value:
            return False
        
        # Don't recurse into known patterns we've already handled
        if self._is_dynamic_key_object(value):
            return False
        
        # Don't recurse into grouped series structures
        if "dates" in value and "values" in value and isinstance(value.get("dates"), list) and isinstance(value.get("values"), list):
            return False
        
        # Don't recurse too deep
        if len(path) > 5:
            return False
        
        return True
    
    def _analyze_metric(self, key: str, value: Any, full_path: Optional[str] = None) -> Optional[MetricInfo]:
        """Analyze a single metric and determine its characteristics"""
        if value is None:
            return None
        
        if isinstance(value, (int, float)):
            value_type = self._detect_value_type(key, value)
            return MetricInfo(
                name=full_path or key,
                type="scalar",
                description=self._generate_metric_description(key, "scalar"),
                sampleValue=value,
                valueType=value_type,
                isTimeGrouped=False,
                groupingFields=[]
            )
        
        if isinstance(value, list):
            return self._analyze_array_metric(key, value, full_path)
        
        if isinstance(value, dict):
            return self._analyze_object_metric(key, value, full_path)
        
        return None
    
    def _analyze_array_metric(self, key: str, value: List, full_path: Optional[str] = None) -> Optional[MetricInfo]:
        """Analyze array-based metrics"""
        if not value:
            return None
        
        first_item = value[0]
        metric_name = full_path or key
        
        # Check if it's time series (has date/value pairs)
        if isinstance(first_item, dict) and "date" in first_item and "value" in first_item:
            return MetricInfo(
                name=metric_name,
                type="timeSeries",
                description=self._generate_metric_description(key, "timeSeries"),
                sampleValue=[item.get("value") for item in value[:3]],
                valueType=self._detect_value_type(key, first_item["value"]),
                isTimeGrouped=True,
                groupingFields=[]
            )
        
        # Skip arrays of objects - handled by extract_from_object_array
        if isinstance(first_item, dict):
            return None
        
        return MetricInfo(
            name=metric_name,
            type="array",
            description=self._generate_metric_description(key, "array"),
            sampleValue=value[:3],
            valueType="generic",
            isTimeGrouped=False,
            groupingFields=[]
        )
    
    def _analyze_object_metric(self, key: str, value: Dict, full_path: Optional[str] = None) -> Optional[MetricInfo]:
        """Analyze object-based metrics (grouped series)"""
        metric_name = full_path or key
        
        if ("dates" in value and "values" in value and 
            isinstance(value.get("dates"), list) and isinstance(value.get("values"), list)):
            
            grouping_dimensions = [series.get("label", "") for series in value["values"]]
            sample_values = value["values"][0].get("values", [])[:3] if value["values"] else []
            
            return MetricInfo(
                name=metric_name,
                type="groupedSeries",
                description=self._generate_metric_description(key, "groupedSeries"),
                sampleValue=sample_values,
                valueType=self._detect_value_type(key, sample_values[0] if sample_values else 0),
                isTimeGrouped=True,
                groupingFields=grouping_dimensions
            )
        
        return None
    
    def _detect_value_type(self, key: str, sample_value: Any) -> ValueType:
        """Detect the type of values (currency, percentage, count, etc.)"""
        key_lower = key.lower()
        
        # Currency indicators
        currency_keywords = ["sales", "revenue", "income", "profit", "cash", "expenses", 
                           "cost", "balance", "amount"]
        if any(keyword in key_lower for keyword in currency_keywords):
            if "margin" in key_lower and "percentage" not in key_lower:
                return "currency"
            elif "margin" not in key_lower:
                return "currency"
        
        # Percentage indicators
        if any(keyword in key_lower for keyword in ["percentage", "rate", "ratio"]):
            return "percentage"
        
        # Count indicators
        count_keywords = ["orders", "customers", "count", "users", "total"]
        if (any(keyword in key_lower for keyword in count_keywords) and 
            isinstance(sample_value, (int, float)) and 
            sample_value == int(sample_value)):
            return "count"
        
        return "generic"
    
    def _generate_metric_description(self, key: str, metric_type: str) -> str:
        """Generate human-readable descriptions for metrics"""
        import re
        key_words = re.sub(r'([A-Z])', r' \1', key).lower().strip()
        
        descriptions = {
            "scalar": f"Total {key_words}",
            "timeSeries": f"{key_words} over time",
            "groupedSeries": f"{key_words} broken down by category over time",
            "array": f"{key_words} data points",
            "dynamicKeyObject": f"{key_words} breakdown by account/entity",
            "embeddedMetrics": f"{key_words} with multiple metrics"
        }
        
        return descriptions.get(metric_type, key_words)
    
    def _generate_chart_suggestions(self, metrics: List[MetricInfo]) -> List[ChartSuggestion]:
        """Generate chart type suggestions based on available metrics"""
        suggestions: List[ChartSuggestion] = []
        
        time_series_metrics = [m for m in metrics if m.isTimeGrouped and not m.groupingFields]
        grouped_series_metrics = [m for m in metrics if m.groupingFields]
        scalar_metrics = [m for m in metrics if m.type == "scalar"]
        embedded_metrics = [m for m in metrics if m.type in ["embeddedMetrics", "dynamicKeyObject"]]
        
        # Line charts for time series
        if time_series_metrics:
            suggestions.append(ChartSuggestion(
                chartType="line",
                confidence=0.9,
                reasoning="Perfect for showing trends over time"
            ))
        
        # Bar charts for comparisons
        if len(scalar_metrics) > 1:
            suggestions.append(ChartSuggestion(
                chartType="bar",
                confidence=0.8,
                reasoning="Great for comparing different metrics"
            ))
        
        # Stacked bar charts for grouped data
        if grouped_series_metrics:
            suggestions.append(ChartSuggestion(
                chartType="stacked-bar",
                confidence=0.85,
                reasoning="Shows composition and trends for grouped data"
            ))
        
        # Bar charts for embedded metrics and dynamic key objects
        if embedded_metrics:
            suggestions.append(ChartSuggestion(
                chartType="bar",
                confidence=0.75,
                reasoning="Ideal for comparing metrics across different accounts or entities"
            ))
        
        # Waterfall charts for changes over time
        change_metrics = [m for m in metrics if "change" in m.name.lower() or "delta" in m.name.lower()]
        if change_metrics:
            suggestions.append(ChartSuggestion(
                chartType="waterfall",
                confidence=0.7,
                reasoning="Excellent for showing cumulative changes"
            ))
        
        # Heatmap charts for correlation/pattern analysis
        correlation_metrics = [m for m in metrics if 
                             (m.groupingFields and m.isTimeGrouped) or
                             (m.type == "embeddedMetrics" and len(m.groupingFields) > 3) or
                             any(keyword in m.name.lower() for keyword in 
                                 ["correlation", "pattern", "intensity", "density"])]
        
        if correlation_metrics:
            suggestions.append(ChartSuggestion(
                chartType="heatmap",
                confidence=0.65,
                reasoning="Perfect for visualizing patterns and intensity across multiple dimensions"
            ))
        
        return sorted(suggestions, key=lambda x: x.confidence, reverse=True)
    
    def _generate_data_description(self, metrics: List[MetricInfo], data: Any = None) -> str:
        """Generate contextual information about the data for the AI model"""
        time_series_count = len([m for m in metrics if m.isTimeGrouped])
        grouped_count = len([m for m in metrics if m.groupingFields])
        scalar_count = len([m for m in metrics if m.type == "scalar"])
        embedded_count = len([m for m in metrics if m.type in ["embeddedMetrics", "dynamicKeyObject"]])
        
        currency_metrics = [m for m in metrics if m.valueType == "currency"]
        percentage_metrics = [m for m in metrics if m.valueType == "percentage"]
        count_metrics = [m for m in metrics if m.valueType == "count"]
        
        context = f"This dataset contains {len(metrics)} metrics. "
        
        if time_series_count > 0:
            context += f"There are {time_series_count} time-series metrics that show trends over time. "
        
        if grouped_count > 0:
            context += f"There are {grouped_count} grouped metrics that can be broken down by categories. "
        
        if scalar_count > 0:
            context += f"There are {scalar_count} summary/total metrics. "
        
        if embedded_count > 0:
            context += f"There are {embedded_count} complex metrics with embedded sub-metrics or account-level breakdowns. "
        
        if currency_metrics:
            context += f"Currency metrics include: {', '.join(m.name for m in currency_metrics)}. "
        
        if percentage_metrics:
            context += f"Percentage metrics include: {', '.join(m.name for m in percentage_metrics)}. "
        
        if count_metrics:
            context += f"Count metrics include: {', '.join(m.name for m in count_metrics)}. "
        
        # Try to detect the year range from actual data
        detected_year = self._detect_date_range(data)
        if detected_year:
            context += f"Data appears to be from {detected_year}. Use {detected_year} for date ranges unless user specifies otherwise. "
        
        return context
    
    def _detect_date_range(self, data: Any) -> Optional[str]:
        """Detect date range from data structure"""
        def check_for_dates(obj: Any, depth: int = 0) -> Optional[str]:
            if depth > 3:
                return None
                
            if isinstance(obj, list):
                for item in obj[:3]:
                    if isinstance(item, dict) and "date" in item:
                        date_str = str(item["date"])
                        if date_str and len(date_str) >= 4:
                            return date_str[:4]  # Extract year
            elif isinstance(obj, dict):
                # Check for dates arrays in grouped data
                if "dates" in obj and isinstance(obj["dates"], list) and obj["dates"]:
                    date_str = str(obj["dates"][0])
                    if date_str and len(date_str) >= 4:
                        return date_str[:4]
                
                # Recursively check nested objects
                for key, value in list(obj.items())[:10]:
                    result = check_for_dates(value, depth + 1)
                    if result:
                        return result
            
            return None
        
        return check_for_dates(data) if data else None
    
    def find_best_metric_match(self, prompt: str, metrics: List[MetricInfo]) -> Optional[MetricInfo]:
        """Find the best metric match for a given prompt"""
        prompt_lower = prompt.lower()
        
        # Direct name matches (including nested paths)
        for metric in metrics:
            metric_name_lower = metric.name.lower()
            if metric_name_lower in prompt_lower:
                return metric
            
            # Check if prompt matches the base name (without path)
            base_name = metric.name.split(".")[-1].lower()
            if base_name in prompt_lower:
                return metric
        
        # Keyword matching
        keywords = prompt_lower.split()
        best_match: Optional[MetricInfo] = None
        best_score = 0
        
        for metric in metrics:
            import re
            metric_keywords = re.split(r'(?=[A-Z])|[\s_.-]+', metric.name.lower())
            score = 0
            
            for keyword in keywords:
                if any(keyword in mk or mk in keyword for mk in metric_keywords if mk):
                    score += 1
            
            # Handle embedded metrics
            if (hasattr(metric, 'sampleValue') and isinstance(metric.sampleValue, list) and
                any(isinstance(item, str) and any(kw in item.lower() or item.lower() in kw 
                                                  for kw in keywords) for item in metric.sampleValue)):
                score += 2
            
            if score > best_score:
                best_score = score
                best_match = metric
        
        return best_match
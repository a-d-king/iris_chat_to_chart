import httpx
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from app.config import config

logger = logging.getLogger(__name__)


class IrisApiService:
    def __init__(self):
        self.api_url = config.IRIS_API_URL or "https://api.irisfinance.co/metrics"
        self.api_token = config.IRIS_API_TOKEN
        
    async def fetch_metrics(self, date_range: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetch metrics data from Iris Finance API
        
        Args:
            date_range: Optional date range (YYYY or YYYY-MM format)
            
        Returns:
            Dict containing the metrics data from the API
            
        Raises:
            Exception: If API token is missing or API call fails
        """
        if not self.api_token:
            raise Exception("IRIS_API_TOKEN environment variable is required")
            
        try:
            start_date, end_date = self._parse_date_range(date_range)
            
            payload = {
                "filters": {
                    "startDate": start_date,
                    "endDate": end_date,
                    "isCashRefundSelected": False,
                    "salesChannels": {
                        "DTC": {
                            "channels": {
                                "Amazon Seller Partner": {
                                    "stores": {
                                        "US": {
                                            "subchannels": ["amazon"]
                                        }
                                    }
                                },
                                "Shopify": {
                                    "stores": {
                                        "yoprettyboy": {
                                            "subchannels": [
                                                "buy button", "point of sale", "faire", "facebook & instagram",
                                                "unknown", "iphone", "shop", "tiktok", "draft order",
                                                "subscription", "online store"
                                            ]
                                        }
                                    }
                                }
                            }
                        },
                        "Wholesale": {
                            "channels": {}
                        }
                    }
                }
            }
            
            headers = {
                "Authorization": f"Bearer {self.api_token}",
                "Content-Type": "application/json",
                "Accept": "application/json, text/plain, */*",
                "Accept-Encoding": "gzip, deflate, br, zstd",
                "Accept-Language": "en-US,en;q=0.9",
                "Cache-Control": "no-cache",
                "Origin": "https://dashboard.irisfinance.co",
                "Pragma": "no-cache",
                "Referer": "https://dashboard.irisfinance.co/",
                "Sec-Ch-Ua": '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"macOS"',
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site",
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36"
            }
            
            logger.info(f"Fetching metrics from Iris API for date range: {start_date} to {end_date}")
            
            async with httpx.AsyncClient() as client:
                response = await client.post(self.api_url, json=payload, headers=headers)
                response.raise_for_status()
                
            logger.info("Successfully fetched metrics data from Iris API")
            return response.json()
            
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching data from Iris API: {e}")
            logger.error(f"API Response Status: {e.response.status_code}")
            logger.error(f"API Response Data: {e.response.text}")
            raise Exception(f"Failed to fetch data from Iris Finance API: HTTP {e.response.status_code}")
        except Exception as e:
            logger.error(f"Error fetching data from Iris API: {e}")
            raise Exception(f"Failed to fetch data from Iris Finance API: {str(e)}")
    
    def _parse_date_range(self, date_range: Optional[str] = None) -> Tuple[str, str]:
        """
        Parse date range string and return start/end dates
        Supports multiple formats: YYYY, YYYY-MM, YYYY-MM-DD, ISO strings, and custom ranges
        
        Args:
            date_range: Date range in various formats
            
        Returns:
            Tuple with (start_date, end_date) in ISO format
        """
        if not date_range:
            # Default to current week for API calls
            now = datetime.now()
            start_of_week = now - timedelta(days=6)
            return start_of_week.isoformat(), now.isoformat()
        
        # Handle custom date ranges from frontend: "startISO,endISO"
        if "," in date_range:
            start_date, end_date = date_range.split(",")
            
            # If already in ISO format, use as-is
            if "T" in start_date and "T" in end_date:
                return start_date, end_date
            
            # If in YYYY-MM-DD format, convert to ISO
            return f"{start_date}T00:00:00.000Z", f"{end_date}T23:59:59.999Z"
        
        # Handle single date values (YYYY-MM-DD format from frontend presets)
        if len(date_range) == 10 and date_range.count("-") == 2:
            # Single day range
            return f"{date_range}T00:00:00.000Z", f"{date_range}T23:59:59.999Z"
        
        # Handle year format (YYYY)
        if len(date_range) == 4 and date_range.isdigit():
            year = int(date_range)
            return f"{year}-01-01T00:00:00.000Z", f"{year}-12-31T23:59:59.999Z"
        
        # Handle month format (YYYY-MM)
        if len(date_range) == 7 and date_range.count("-") == 1:
            year, month = map(int, date_range.split("-"))
            start_date = datetime(year, month, 1)
            
            # Get last day of month
            if month == 12:
                end_date = datetime(year + 1, 1, 1) - timedelta(days=1)
            else:
                end_date = datetime(year, month + 1, 1) - timedelta(days=1)
            
            return (
                start_date.isoformat().replace("T00:00:00", "T00:00:00.000Z"),
                end_date.isoformat().replace("T00:00:00", "T23:59:59.999Z")
            )
        
        logger.warning(f"Unrecognized date range format: {date_range}, using default week range")
        
        # Fallback to current week
        now = datetime.now()
        start_of_week = now - timedelta(days=6)
        return start_of_week.isoformat(), now.isoformat()
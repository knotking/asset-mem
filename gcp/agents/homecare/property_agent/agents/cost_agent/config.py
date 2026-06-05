"""
Configuration settings for AI-powered cost estimation.

This module contains feature flags, thresholds, and configuration
parameters for the cost estimation system.
"""

import os
from typing import Any, Dict, Optional, Union


class CostEstimationConfig:
    """Configuration for AI-powered cost estimation."""

    # Feature Flags
    USE_AI_COST_ESTIMATION: bool = (
        os.getenv("USE_AI_COST_ESTIMATION", "true").lower() == "true"
    )
    USE_SERVICE_PROVIDER_CALIBRATION: bool = (
        os.getenv("USE_SERVICE_PROVIDER_CALIBRATION", "true").lower() == "true"
    )

    # Confidence Thresholds
    MIN_AI_CONFIDENCE_THRESHOLD: float = float(
        os.getenv("MIN_AI_CONFIDENCE_THRESHOLD", "0.6")
    )
    MIN_PROVIDER_DATA_CONFIDENCE: float = float(
        os.getenv("MIN_PROVIDER_DATA_CONFIDENCE", "0.5")
    )

    # Timeout Settings (seconds)
    AI_ESTIMATION_TIMEOUT: int = int(os.getenv("AI_ESTIMATION_TIMEOUT", "30"))
    PROVIDER_PRICING_TIMEOUT: int = int(os.getenv("PROVIDER_PRICING_TIMEOUT", "10"))

    # Calibration Settings
    PROVIDER_DATA_WEIGHT: float = float(
        os.getenv("PROVIDER_DATA_WEIGHT", "0.3")
    )  # 0.0-1.0

    # Model for direct generate_content (Google Search grounding); matches LEGACY_API_GEMINI default.
    AI_MODEL_NAME: str = os.getenv("COST_ESTIMATION_MODEL", "gemini-2.5-flash")
    AI_TEMPERATURE: float = float(os.getenv("AI_TEMPERATURE", "0.3"))
    AI_MAX_OUTPUT_TOKENS: int = int(os.getenv("AI_MAX_OUTPUT_TOKENS", "2048"))

    # Cost Validation Ranges
    MIN_VALID_COST: float = 5.0  # Minimum cost in dollars
    MAX_VALID_COST: float = 50000.0  # Maximum cost in dollars
    MAX_DIY_TO_PRO_RATIO: float = 1.5  # DIY shouldn't exceed 1.5x professional cost

    # Regional Cost Adjustments (optional enhancement)
    # Multipliers for high cost-of-living areas
    REGIONAL_COST_MULTIPLIERS: Dict[str, float] = {
        "San Francisco": 1.4,
        "New York": 1.35,
        "Los Angeles": 1.25,
        "Seattle": 1.2,
        "Boston": 1.2,
        "Washington": 1.15,
        "Chicago": 1.1,
        "Denver": 1.05,
        # Default for unlisted cities
        "default": 1.0,
    }

    # Logging
    LOG_AI_RESPONSES: bool = (
        os.getenv("LOG_AI_COST_RESPONSES", "false").lower() == "true"
    )
    LOG_FALLBACK_USAGE: bool = os.getenv("LOG_FALLBACK_USAGE", "true").lower() == "true"

    @classmethod
    def get_regional_multiplier(cls, location: Optional[str]) -> float:
        """
        Get regional cost multiplier for a location.

        Args:
            location: City or location string

        Returns:
            Cost multiplier (1.0 = baseline)
        """
        if not location:
            return cls.REGIONAL_COST_MULTIPLIERS["default"]

        location_lower = location.lower()

        for city, multiplier in cls.REGIONAL_COST_MULTIPLIERS.items():
            if city.lower() in location_lower:
                return multiplier

        return cls.REGIONAL_COST_MULTIPLIERS["default"]

    @classmethod
    def should_use_ai_estimation(cls) -> bool:
        """
        Check if AI estimation should be used.

        Returns:
            True if AI estimation is enabled
        """
        return cls.USE_AI_COST_ESTIMATION

    @classmethod
    def should_calibrate_with_provider_data(cls) -> bool:
        """
        Check if provider data calibration should be used.

        Returns:
            True if calibration is enabled
        """
        return cls.USE_SERVICE_PROVIDER_CALIBRATION

    @classmethod
    def get_ai_config(cls) -> Dict[str, Any]:
        """
        Get AI model configuration.

        Returns:
            Dictionary with AI configuration parameters
        """
        return {
            "model": cls.AI_MODEL_NAME,
            "temperature": cls.AI_TEMPERATURE,
            "max_output_tokens": cls.AI_MAX_OUTPUT_TOKENS,
            "timeout": cls.AI_ESTIMATION_TIMEOUT,
        }

    @classmethod
    def validate_cost_estimate(
        cls, diy_low: float, diy_high: float, pro_low: float, pro_high: float
    ) -> tuple[bool, Optional[str]]:
        """
        Validate cost estimate ranges.

        Args:
            diy_low: DIY low estimate
            diy_high: DIY high estimate
            pro_low: Professional low estimate
            pro_high: Professional high estimate

        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check minimum costs
        if any(
            cost < cls.MIN_VALID_COST for cost in [diy_low, diy_high, pro_low, pro_high]
        ):
            return (
                False,
                f"Cost estimate below minimum valid cost (${cls.MIN_VALID_COST})",
            )

        # Check maximum costs
        if any(
            cost > cls.MAX_VALID_COST for cost in [diy_low, diy_high, pro_low, pro_high]
        ):
            return (
                False,
                f"Cost estimate exceeds maximum valid cost (${cls.MAX_VALID_COST})",
            )

        # Check range validity
        if diy_low >= diy_high:
            return False, "DIY low cost must be less than high cost"

        if pro_low >= pro_high:
            return False, "Professional low cost must be less than high cost"

        # Check DIY vs Professional ratio
        if diy_high > pro_high * cls.MAX_DIY_TO_PRO_RATIO:
            return (
                False,
                f"DIY cost exceeds professional cost by more than {cls.MAX_DIY_TO_PRO_RATIO}x",
            )

        return True, None

    @classmethod
    def get_fallback_reason_log(cls, reason: str, diagnosis: str) -> Dict[str, Union[str, bool]]:
        """
        Create log entry for fallback usage.

        Args:
            reason: Reason for fallback
            diagnosis: Repair diagnosis

        Returns:
            Dictionary with log information
        """
        return {
            "event": "cost_estimation_fallback",
            "reason": reason,
            "diagnosis": diagnosis[:100],
            "ai_enabled": cls.USE_AI_COST_ESTIMATION,
        }


# Global config instance
config = CostEstimationConfig()


__all__ = [
    "CostEstimationConfig",
    "config",
]

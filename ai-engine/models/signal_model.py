"""
ML Signal Scoring Model.

Currently implements a lightweight logistic-regression-style scoring layer
on top of the weighted indicator outputs from signal_engine.py.

This module is intentionally simple and dependency-free (no sklearn/torch)
so the engine has zero heavy ML dependencies. It acts as a normalization
pass that maps the raw weighted sum to a calibrated confidence score.
"""
import math


# Sigmoid-style calibration: maps weighted score to 0-1 probability
def _sigmoid(x: float, k: float = 0.6) -> float:
    return 1.0 / (1.0 + math.exp(-k * x))


def score_signal(weighted_sum: float, max_possible: float, direction: str) -> dict:
    """
    Converts a raw weighted indicator score into a calibrated confidence.

    Args:
        weighted_sum:  raw weighted sum from signal_engine
        max_possible:  maximum possible absolute weighted sum
        direction:     'CALL', 'PUT', or 'WAIT'

    Returns:
        {
            raw_score: float,       # -max_possible to +max_possible
            normalized: float,      # -1 to +1
            confidence: float,      # 0 to 100 (percentage)
            model: str              # label of scoring method
        }
    """
    normalized = weighted_sum / max_possible if max_possible != 0 else 0.0
    # Confidence: sigmoid-mapped absolute normalized score, in percent
    confidence = round(_sigmoid(abs(weighted_sum)) * 100.0, 2)
    return {
        "raw_score": round(weighted_sum, 6),
        "normalized": round(normalized, 6),
        "confidence": confidence,
        "model": "weighted_indicator_sigmoid_v1",
    }


class SignalModel:
    """
    Thin wrapper that holds model metadata and exposes a predict interface
    compatible with the Flask endpoint. No training data or external weights.
    """

    version = "1.0.0"
    name = "WeightedIndicatorSigmoidModel"
    description = (
        "Deterministic weighted-scoring model with sigmoid confidence calibration. "
        "No historical training; purely technical-analysis-driven."
    )

    @staticmethod
    def predict(weighted_sum: float, max_possible: float, direction: str) -> dict:
        return score_signal(weighted_sum, max_possible, direction)

    @staticmethod
    def metadata() -> dict:
        return {
            "version": SignalModel.version,
            "name": SignalModel.name,
            "description": SignalModel.description,
        }

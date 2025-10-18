"""Utilities for constructing Agent instances with shared Anthropic configuration."""

from __future__ import annotations

from pydantic_ai.models.anthropic import AnthropicModel, AnthropicModelSettings
from pydantic_ai.providers.anthropic import AnthropicProvider

from ..config.settings import ModelSettings


def build_anthropic_model(
    config: ModelSettings,
    api_key: str,
) -> tuple[AnthropicModel, AnthropicModelSettings]:
    """Return an Anthropic model instance and corresponding settings."""

    provider, model_name = _split_provider(config.model)
    if provider != "anthropic":
        raise ValueError(
            f"Unsupported provider '{provider}'. Only Anthropic models are currently supported."
        )

    model = AnthropicModel(model_name, provider=AnthropicProvider(api_key=api_key))

    settings_values: AnthropicModelSettings = {
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
    }
    if config.top_p is not None:
        settings_values["top_p"] = config.top_p

    if config.thinking_budget:
        settings_values["anthropic_thinking"] = {
            "type": "enabled",
            "budget_tokens": config.thinking_budget,
        }
        settings_values["extra_headers"] = {"anthropic-beta": "interleaved-thinking-2025-05-14"}

    return model, settings_values


def _split_provider(model_identifier: str) -> tuple[str, str]:
    if ":" in model_identifier:
        provider, model_name = model_identifier.split(":", 1)
        return provider, model_name
    return "anthropic", model_identifier

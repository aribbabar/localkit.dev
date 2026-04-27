---
title: "LLM Cost Calculator"
description: "Estimate token usage cost for LLM requests and manage model pricing locally."
tool: "llm-cost-calculator"
icon: "Calculator"
accent: "teal"
lastUpdated: 2026-04-26
order: 16
---

## What it does

The LLM Cost Calculator estimates usage cost from a selected model, input tokens, and output tokens. Default pricing is loaded from `src/data/llm-model-pricing.json` and treated as USD per 1 million tokens.

## Model pricing

Each model stores:

- Model name
- Provider
- Input cost per 1 million tokens
- Output cost per 1 million tokens

Default models can be edited, but they cannot be deleted. Editing a default model creates a local override. Use **Reset default** to return that model to the original seeded pricing.

## Custom models

Use **Add model** to create a custom model, then update the pricing and save it. Custom models are stored in local storage and can be edited or deleted.

## Privacy and storage

All calculations happen in your browser. Token counts, default model edits, and custom models are saved only in local storage. That data can be lost if browser data is cleared, site storage is reset, storage is blocked, or the browser removes local site data.

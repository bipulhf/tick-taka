-- Calls logged before per-model pricing used the generic tier prices, which were far above
-- gpt-6-luna's. Re-price them at list price (cached input wasn't recorded, so it counts as input).
UPDATE `ai_usage` SET `cost_micros` = (`input_tokens` * 100000 + `output_tokens` * 500000 + 999999) / 1000000 WHERE `model` LIKE 'gpt-6-luna%';--> statement-breakpoint
UPDATE `ai_usage` SET `cost_micros` = (`input_tokens` * 1250000 + `output_tokens` * 5000000 + 999999) / 1000000 WHERE `model` LIKE 'gpt-4o-mini-transcribe%';

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from 'vitest';
import { parseRss, stripHtml } from '../adapters/remoteok.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureXml = readFileSync(
	resolve(__dirname, "fixtures/stress-test.xml"),
	"utf-8"
);

describe('RemoteOK Adapter - v5.5.6 Security & Limits', () => {
	it('should parse a feed with >10,000 entities without throwing', () => {
		// This would have failed on the default (1000) or your previous (10000) limit
		const jobs = parseRss(fixtureXml);

		expect(jobs).toHaveLength(1);
		expect(jobs[0].title).toBe('Extreme Entity Test');
	});

	it('should correctly decode entities in both RemoteOK and HN contexts', () => {
		const rawHnText = 'This job is &quot;Special&quot; &amp; Unique.';
		const cleaned = stripHtml(rawHnText);

		// Verifies our manual decoding regexes for JSON-based sources (HN)
		expect(cleaned).toBe('This job is "Special" & Unique.');
	});
});
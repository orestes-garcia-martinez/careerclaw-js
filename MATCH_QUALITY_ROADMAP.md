# Match Quality Roadmap

## Goal

Improve briefing precision by fixing the three main failure modes seen in production traces:

- duplicate syndicated listings crowding out variety
- single-role query construction for multi-role profiles
- cross-function false positives caused by transferable keyword overlap

## Phase 1: Retrieval And Dedup

- Expand SerpApi query construction beyond the first target role so multi-role profiles do not collapse into one narrow search.
- Collapse syndicated duplicates using canonical title/company/location and title/company/description fingerprints instead of URL-only ids.
- Prefer the richer duplicate variant when multiple copies of the same role exist.

## Phase 2: Role-Fit Ranking

- Add a first-class role-alignment dimension to ranking.
- Keep the signal neutral when the engine cannot infer a clear function family.
- Penalize clear cross-function mismatches while allowing light adjacency between related families such as product-design or marketing-sales.

## Phase 3: Regression Profiles

Use synthetic regression fixtures to keep ranking behavior stable for distinct functions:

- Elena Ruiz: marketing leadership
- Marcus Chen: product design
- Priya Patel: operations
- Daniel Moreau: finance

Validation targets:

- same-function roles outrank cross-function roles
- syndicated duplicate jobs collapse to one entry
- multi-role queries retain more than one useful target-role signal

## Phase 4: Follow-On Work

- Add source-quality weighting so direct employer pages outrank repost boards.
- Add stronger geographic scoring inside ranking, not only search-time filtering.
- Add anonymized production benchmark fixtures to tune weights safely over time.

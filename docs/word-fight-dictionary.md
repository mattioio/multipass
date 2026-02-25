# Word Fight Dictionary

Word Fight uses generated 4-letter dictionaries for:
- broad guess validation
- common-only secret-word selection

## Source of truth

- Primary source package: `wordlist-english`
- Fallback source words (offline/dev): `apps/server/src/games/wordFightWords.source.uk-us.txt`
- Safety exclusions: `apps/server/src/games/wordFightWords.blocklist.txt`
- Generator: `apps/server/scripts/build-word-fight-dictionary.mjs`

## Generation rules

The generator applies these rules in order:
1. Build guess and secret pools from `wordlist-english` tiers.
2. Normalize to uppercase.
3. Keep only words matching `^[A-Z]{4}$`.
4. Deduplicate.
5. Remove words that appear in the blocklist.
6. Sort A-Z for deterministic output.

Tier policy:
- Guess allowlist tiers: `10,20,35,40,50,55,60,70`
- Secret tiers (common-only): `10,20,35,40`

## Generated files

Do not edit these directly:
- `apps/server/src/games/wordFightWords.js`
- `apps/web/src/domain/games/engines/wordFightWords.js`

## Commands

- Regenerate dictionaries:
  - `npm --prefix /Users/matthew/Projects/multipass/apps/server run dict:wordfight`
- Verify generated files are up to date:
  - `npm --prefix /Users/matthew/Projects/multipass/apps/server run dict:wordfight:check`

## Notes

- Repeated-letter words are allowed for both guesses and secret words.
- This is an allowlist system: words not present in generated guess list (or removed by blocklist) are invalid.
- Generated files are auto-generated; do not edit them directly.

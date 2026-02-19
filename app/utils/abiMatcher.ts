/**
 * Fuzzy ABI matching: resolves deployment contract names to ABI folder names
 * when they don't match exactly (e.g., "Staking" -> "IGenLayerStaking").
 *
 * Priority order (lower score = better):
 * 1. Exact match
 * 2. Case-insensitive exact match
 * 3. Suffix match (case-insensitive) — contract name is a suffix of ABI name
 * 4. Substring match (case-insensitive) — contract name appears inside ABI name
 *
 * Tie-break at same level: shorter ABI name wins (more specific).
 */

export interface AbiMatch {
  abiName: string;
  score: number;
}

export function findBestAbiMatch(
  contractName: string,
  availableAbiNames: Set<string> | string[]
): AbiMatch | null {
  const names = availableAbiNames instanceof Set
    ? Array.from(availableAbiNames)
    : availableAbiNames;

  if (!contractName || names.length === 0) return null;

  const lowerContract = contractName.toLowerCase();
  let bestMatch: AbiMatch | null = null;

  for (const abiName of names) {
    let score: number | null = null;

    if (abiName === contractName) {
      score = 1;
    } else if (abiName.toLowerCase() === lowerContract) {
      score = 2;
    } else if (abiName.toLowerCase().endsWith(lowerContract)) {
      score = 3;
    } else if (abiName.toLowerCase().includes(lowerContract)) {
      score = 4;
    }

    if (score === null) continue;

    if (
      !bestMatch ||
      score < bestMatch.score ||
      (score === bestMatch.score && abiName.length < bestMatch.abiName.length)
    ) {
      bestMatch = { abiName, score };
    }
  }

  return bestMatch;
}

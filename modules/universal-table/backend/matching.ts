import type {
  FieldMappingSuggestion,
  StandardColumn,
  StandardTableRecord,
  TableMatchResult,
} from './types';

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[_\-\s]+/g, ' ')
    .replace(/[^\w\u4e00-\u9fa5 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function normalizeHeader(value: string): string {
  return tokenize(value).join('');
}

function overlapScore(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }

  if (a === b) {
    return 1;
  }

  if (a.includes(b) || b.includes(a)) {
    return 0.92;
  }

  const aTokens = new Set(tokenize(a));
  const bTokens = new Set(tokenize(b));
  const shared = [...aTokens].filter((token) => bTokens.has(token)).length;
  const tokenScore = shared === 0 ? 0 : shared / Math.max(aTokens.size, bTokens.size);

  const aChars = new Set(a.replace(/\s+/g, ''));
  const bChars = new Set(b.replace(/\s+/g, ''));
  const sharedChars = [...aChars].filter((char) => bChars.has(char)).length;
  const charScore = sharedChars === 0 ? 0 : sharedChars / Math.max(aChars.size, bChars.size);

  return Math.max(tokenScore, charScore * 0.9);
}

function scoreAgainstField(sourceHeader: string, field: StandardColumn): FieldMappingSuggestion {
  const normalizedSource = normalizeHeader(sourceHeader);
  const normalizedTarget = normalizeHeader(field.title);
  const aliases = (field.aliases || []).map(normalizeHeader);

  if (normalizedSource === normalizedTarget || aliases.includes(normalizedSource)) {
    return {
      sourceHeader,
      standardField: field.title,
      confidence: 1,
      reason: '表头完全一致',
      exact: true,
    };
  }

  const aliasScores = aliases.map((alias) => overlapScore(normalizedSource, alias));
  const aliasBest = aliasScores.length > 0 ? Math.max(...aliasScores) : 0;
  const baseScore = Math.max(overlapScore(normalizedSource, normalizedTarget), aliasBest);

  let reason = '表头语义相近';
  if (baseScore >= 0.9) {
    reason = '表头名称高度相似';
  } else if (baseScore < 0.65) {
    reason = '表头匹配较弱';
  }

  return {
    sourceHeader,
    standardField: field.title,
    confidence: Number(baseScore.toFixed(3)),
    reason,
    exact: false,
  };
}

export function buildFieldMapping(
  sourceHeaders: string[],
  fields: StandardColumn[],
): FieldMappingSuggestion[] {
  const suggestions: FieldMappingSuggestion[] = [];
  const usedTargetFields = new Set<string>();

  for (const sourceHeader of sourceHeaders) {
    let best: FieldMappingSuggestion | null = null;

    for (const field of fields) {
      if (usedTargetFields.has(field.title)) {
        continue;
      }

      const candidate = scoreAgainstField(sourceHeader, field);
      if (!best || candidate.confidence > best.confidence) {
        best = candidate;
      }
    }

    if (best) {
      usedTargetFields.add(best.standardField);
      suggestions.push(best);
    }
  }

  return suggestions;
}

function computeCoverage(mapping: FieldMappingSuggestion[], fields: StandardColumn[]): number {
  if (fields.length === 0) {
    return 0;
  }

  const matched = mapping.filter((item) => item.confidence >= 0.7).length;
  return Number((matched / fields.length).toFixed(3));
}

export function findBestStandardTableMatch(
  sourceHeaders: string[],
  standardTables: StandardTableRecord[],
  sampleText = '',
): TableMatchResult {
  if (standardTables.length === 0) {
    return {
      standardTableId: null,
      standardTableName: null,
      confidence: 0,
      coverage: 0,
      mapping: [],
      needsConfirm: true,
    };
  }

  const lowerText = sampleText.toLowerCase();
  let bestResult: TableMatchResult | null = null;

  for (const table of standardTables) {
    const mapping = buildFieldMapping(sourceHeaders, table.columns);
    const coverage = computeCoverage(mapping, table.columns);
    const averageScore = mapping.length === 0
      ? 0
      : mapping.reduce((sum, item) => sum + item.confidence, 0) / mapping.length;

    const keywordBoost = table.columns.some((field) => lowerText.includes(field.title.toLowerCase()))
      || lowerText.includes(table.name.toLowerCase())
      ? 0.08
      : 0;

    const confidence = Number(Math.min(1, averageScore * 0.45 + coverage * 0.47 + keywordBoost).toFixed(3));
    const needsConfirm = !mapping.every((item) => item.exact) || coverage < 1;

    const candidate: TableMatchResult = {
      standardTableId: table.id,
      standardTableName: table.name,
      confidence,
      coverage,
      mapping,
      needsConfirm,
    };

    if (!bestResult || candidate.confidence > bestResult.confidence) {
      bestResult = candidate;
    }
  }

  if (!bestResult || bestResult.confidence < 0.45) {
    return {
      standardTableId: null,
      standardTableName: null,
      confidence: bestResult?.confidence || 0,
      coverage: bestResult?.coverage || 0,
      mapping: bestResult?.mapping || [],
      needsConfirm: true,
    };
  }

  return bestResult;
}

export function mappingToDictionary(mapping: FieldMappingSuggestion[]): Record<string, string> {
  return mapping
    .filter((item) => item.confidence >= 0.65)
    .reduce<Record<string, string>>((acc, item) => {
      acc[item.sourceHeader] = item.standardField;
      return acc;
    }, {});
}

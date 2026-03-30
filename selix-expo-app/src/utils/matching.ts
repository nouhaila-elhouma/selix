import Colors from '../constants/colors';
import { LeadAnswers, Property, MatchBadge } from '../types';

// ============================================================
// SELIX - Matching Engine
// Scores property <-> lead profile fit (0-100)
// ============================================================

export function matchScore(answers: Partial<LeadAnswers>, property: Property): number {
  let score = 0;

  if (answers.propertyType && answers.propertyType === property.type) score += 25;

  const budget = answers.budgetRaw ?? 0;
  if (budget > 0) {
    if (property.priceRaw <= budget) {
      const ratio = property.priceRaw / budget;
      if (ratio >= 0.85) score += 30;
      else if (ratio >= 0.70) score += 20;
      else score += 8;
    } else {
      const over = (property.priceRaw - budget) / budget;
      if (over <= 0.10) score += 20;
      else if (over <= 0.20) score += 10;
    }
  }

  const cityMatch = answers.city &&
    property.city.toLowerCase().includes(answers.city.toLowerCase());
  const zoneMatch = answers.targetZone &&
    (property.city.toLowerCase().includes(answers.targetZone.toLowerCase()) ||
      property.district.toLowerCase().includes(answers.targetZone.toLowerCase()));

  if (cityMatch && zoneMatch) score += 20;
  else if (cityMatch) score += 14;
  else if (zoneMatch) score += 10;

  const desiredAreaRaw = answers.desiredAreaRaw ?? 0;
  if (desiredAreaRaw > 0 && property.areaRaw > 0) {
    const min = desiredAreaRaw * 0.8;
    const max = desiredAreaRaw * 1.3;
    if (property.areaRaw >= min && property.areaRaw <= max) score += 15;
    else if (property.areaRaw >= desiredAreaRaw * 0.65) score += 7;
  }

  const rooms = answers.rooms ?? 0;
  if (rooms > 0 && property.rooms > 0) {
    const diff = Math.abs(property.rooms - rooms);
    if (diff === 0) score += 10;
    else if (diff === 1) score += 5;
    else if (diff === 2) score += 2;
  }

  if (answers.objective === 'Investir' && property.investment) score += 5;

  return Math.min(100, Math.round(score));
}

export function getMatchedProperties(
  answers: Partial<LeadAnswers>,
  properties: Property[],
): Property[] {
  return properties
    .map((property) => ({
      ...property,
      score: matchScore(answers, property),
      badge: getBadge(matchScore(answers, property)),
    }))
    .filter((property) => property.score >= 20)
    .sort((a, b) => b.score - a.score);
}

export function getBadge(score: number): MatchBadge {
  if (score >= 85) return 'Top Match';
  if (score >= 70) return 'Excellent Match';
  if (score >= 50) return 'Bon potentiel';
  return 'À explorer';
}

export function getBadgeColor(badge: MatchBadge): string {
  switch (badge) {
    case 'Top Match':
      return Colors.badgeTop;
    case 'Excellent Match':
      return Colors.primaryLight;
    case 'Bon potentiel':
      return Colors.accentOrange;
    case 'À explorer':
      return Colors.textMuted;
  }
}

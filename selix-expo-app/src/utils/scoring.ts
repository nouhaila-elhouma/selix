import Colors from '../constants/colors';
import { LeadAnswers, LeadTemperature } from '../types';

// ============================================================
// SELIX — Lead Scoring Engine  (score 0–100)
// ============================================================

export function computeScore(a: Partial<LeadAnswers>): number {
  let score = 0;

  // Identity completeness (10 pts)
  if (a.firstName?.trim())  score += 3;
  if (a.lastName?.trim())   score += 2;
  if (a.phone?.trim())      score += 3;
  if (a.email?.trim())      score += 2;

  // Budget (20 pts)
  const budget = a.budgetRaw ?? 0;
  if (budget > 0) {
    score += 10;
    if (budget >= 500_000)   score += 5;
    if (budget >= 1_000_000) score += 5;
  }

  // Down payment signal (5 pts)
  if ((a.downPaymentRaw ?? 0) > 0) score += 5;

  // Financing readiness (10 pts)
  if (a.financing) {
    if (a.financing === 'Cash')         score += 10;
    else if (a.financing === 'Mixte')   score += 7;
    else                                score += 4;
  }
  if (a.hasBankPreApproval) score += 5;

  // Purchase urgency (20 pts)
  switch (a.purchaseDeadline) {
    case 'Immédiat':     score += 20; break;
    case '3 mois':       score += 15; break;
    case '6 mois':       score += 10; break;
    case '1 an':         score += 5;  break;
    case 'Plus de 1 an': score += 2;  break;
    default: break;
  }

  // Project definition (15 pts)
  if (a.propertyType)       score += 5;
  if (a.objective)          score += 5;
  if (a.targetZone?.trim()) score += 5;

  // Property specs (10 pts)
  if ((a.desiredAreaRaw ?? 0) > 0) score += 5;
  if ((a.rooms ?? 0) > 0)          score += 5;

  // Criteria richness (5 pts)
  const n = a.mustHave?.length ?? 0;
  if (n >= 3) score += 5;
  else if (n >= 1) score += 2;

  // MRE bonus — higher purchase power profile (5 pts)
  if (a.isMRE) score += 5;

  // Investment signal (5 pts)
  if (a.objective === 'Investir' && a.expectedYield?.trim()) score += 5;

  // Credit profile signal (5 pts)
  if ((a.financing === 'Crédit' || a.financing === 'Mixte') && a.netIncome?.trim()) {
    score += 3;
    if (a.loanDuration?.trim()) score += 2;
  }

  return Math.min(100, Math.round(score));
}

export function getTemperature(score: number): LeadTemperature {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

export function getTemperatureLabel(temp: LeadTemperature): string {
  switch (temp) {
    case 'hot':  return 'Chaud';
    case 'warm': return 'Tiède';
    case 'cold': return 'Froid';
  }
}

export function getTemperatureEmoji(temp: LeadTemperature): string {
  switch (temp) {
    case 'hot':  return '🔥';
    case 'warm': return '⚡';
    case 'cold': return '❄️';
  }
}

export function getTemperatureColor(temp: LeadTemperature): string {
  switch (temp) {
    case 'hot':  return Colors.danger;
    case 'warm': return Colors.accentOrange;
    case 'cold': return Colors.primary;
  }
}

export function getTemperatureBgColor(temp: LeadTemperature): string {
  switch (temp) {
    case 'hot':  return Colors.dangerLight;
    case 'warm': return Colors.warningLight;
    case 'cold': return Colors.lavenderLight;
  }
}

export function getScoreColor(score: number): string {
  if (score >= 70) return Colors.success;
  if (score >= 50) return Colors.accentOrange;
  if (score >= 30) return Colors.primary;
  return Colors.textMuted;
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 70) return 'Très bon';
  if (score >= 55) return 'Bon';
  if (score >= 40) return 'Moyen';
  return 'Faible';
}

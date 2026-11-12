/** Labels and small pure helpers for showing an analysis report. The numbers themselves come from the server. */

export const STATUS_ORDER = ['MATCHED', 'PARTIAL_MATCH', 'NOT_FOUND', 'UNVERIFIED'];

export const STATUS_META = {
  MATCHED: { label: 'Matched', color: 'success' },
  PARTIAL_MATCH: { label: 'Partial match', color: 'warning' },
  // Wording matters: "not found" means no evidence in the resume, not that the person lacks the skill.
  NOT_FOUND: { label: 'Not found', color: 'error' },
  UNVERIFIED: { label: 'Could not verify', color: 'default' },
};

export const IMPORTANCE_LABELS = { MANDATORY: 'Required', PREFERRED: 'Preferred', OPTIONAL: 'Optional' };

export const RECOMMENDATION_META = {
  READY_TO_APPLY: {
    label: 'Ready to apply',
    color: 'success',
    text: 'Your resume covers most of what this job asks for. Review the details below before you apply.',
  },
  IMPROVE_BEFORE_APPLYING: {
    label: 'Improve before applying',
    color: 'warning',
    text: 'Your resume matches part of this job. Closing the gaps below could make it stronger.',
  },
  LOW_COMPATIBILITY: {
    label: 'Low compatibility',
    color: 'error',
    text: 'Your resume matches little of what this job asks for. Check that the role fits your experience, then review the gaps below.',
  },
};

/** Order the requirement groups are shown in. Structure has its own checklist, not requirement rows. */
export const CATEGORY_ORDER = ['technicalSkills', 'experience', 'responsibilities', 'keywords', 'education'];

const SECTION_LABELS = {
  experience: 'work experience',
  projects: 'projects',
  summary: 'summary',
  achievements: 'achievements',
  certifications: 'certifications',
  education: 'education',
  skills: 'skills list',
};

export const PRIORITY_META = {
  high: { label: 'High priority', color: 'error' },
  medium: { label: 'Medium', color: 'warning' },
  low: { label: 'Low', color: 'default' },
};

/** Visual banding only. The recommendation thresholds that matter live in the scoring engine. */
export const scoreColor = (score) => (score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error');

export function countByStatus(requirements = []) {
  const counts = { MATCHED: 0, PARTIAL_MATCH: 0, NOT_FOUND: 0, UNVERIFIED: 0 };
  requirements.forEach((item) => {
    if (counts[item.status] !== undefined) counts[item.status] += 1;
  });
  return counts;
}

export function filterByStatus(requirements = [], status = 'ALL') {
  return status === 'ALL' ? requirements : requirements.filter((item) => item.status === status);
}

/** Groups requirement rows by category, in display order, skipping empty groups. */
export function groupByCategory(requirements = [], categoryScores = []) {
  const labels = Object.fromEntries(categoryScores.map((c) => [c.key, c.label]));
  return CATEGORY_ORDER
    .map((key) => ({ key, label: labels[key] || key, items: requirements.filter((r) => r.category === key) }))
    .filter((group) => group.items.length > 0);
}

export function evidenceLabel(section) {
  return SECTION_LABELS[section] ? `From your ${SECTION_LABELS[section]}` : 'From your resume';
}

export function formatConfidence(value) {
  return typeof value === 'number' ? `${Math.round(value * 100)}% confidence` : '';
}

export function formatPoints(category) {
  if (!category?.applicable) return 'Not scored';
  return `${category.points} of ${category.effectiveWeight} points`;
}

/** Radar chart input: only categories that were actually scored. */
export function radarData(categoryScores = []) {
  return categoryScores
    .filter((c) => c.applicable && typeof c.ratio === 'number')
    .map((c) => ({ subject: c.label, value: Math.round(c.ratio * 100) }));
}

export const formatDate = (value) => (
  value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''
);

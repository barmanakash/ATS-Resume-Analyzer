import React, { useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import {
  IMPORTANCE_LABELS,
  PRIORITY_META,
  RECOMMENDATION_META,
  STATUS_META,
  STATUS_ORDER,
  countByStatus,
  evidenceLabel,
  filterByStatus,
  formatConfidence,
  formatPoints,
  groupByCategory,
  radarData,
  scoreColor,
} from '../../utils/analysis';

const SectionTitle = ({ children, caption }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="h6" component="h2">{children}</Typography>
    {caption && <Typography variant="body2" color="text.secondary">{caption}</Typography>}
  </Box>
);

function ChipGroup({ label, items, color, variant = 'filled', emptyText }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>{label} ({items.length})</Typography>
      {items.length ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          {items.map((name) => <Chip key={name} size="small" label={name} color={color} variant={variant} />)}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">{emptyText}</Typography>
      )}
    </Box>
  );
}

/** Overall score, recommendation and the honest limits of what the score means. */
export function ScoreHero({ report }) {
  const score = Math.round(report.overallScore ?? 0);
  const recommendation = RECOMMENDATION_META[report.recommendation];
  const gaps = report.mandatoryGaps?.length || 0;

  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} alignItems={{ xs: 'center', md: 'flex-start' }}>
          <Box
            role="img"
            aria-label={`Overall compatibility score: ${score} out of 100`}
            sx={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
          >
            <CircularProgress variant="determinate" value={100} size={150} thickness={4} sx={{ color: 'grey.200' }} />
            <CircularProgress
              variant="determinate"
              value={score}
              size={150}
              thickness={4}
              color={scoreColor(score)}
              sx={{ position: 'absolute', left: 0 }}
            />
            <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h3" component="span" sx={{ fontWeight: 700, lineHeight: 1 }}>{score}</Typography>
              <Typography variant="caption" color="text.secondary">out of 100</Typography>
            </Box>
          </Box>

          <Box>
            <Typography variant="h5" component="h2" gutterBottom>Overall compatibility</Typography>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.5 }}>
              {recommendation && <Chip color={recommendation.color} label={recommendation.label} />}
              {gaps > 0 && (
                <Chip
                  color="warning"
                  variant="outlined"
                  label={`${gaps} required ${gaps === 1 ? 'item' : 'items'} not found`}
                />
              )}
            </Stack>
            {recommendation && <Typography sx={{ mb: 1.5 }}>{recommendation.text}</Typography>}
            {report.disclaimer && (
              <Typography variant="caption" color="text.secondary" component="p">{report.disclaimer}</Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function ReportWarnings({ warnings = [] }) {
  if (!warnings.length) return null;
  return (
    <Stack spacing={1}>
      {warnings.map((text) => <Alert key={text} severity="warning">{text}</Alert>)}
    </Stack>
  );
}

/** Required items that were not found, shown on their own so they cannot be missed. */
export function MandatoryGaps({ gaps = [] }) {
  if (!gaps.length) return null;
  return (
    <Alert severity="warning">
      <AlertTitle>Required items not found in your resume</AlertTitle>
      <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
        {gaps.map((gap) => (
          <li key={`${gap.kind}-${gap.requirement}`}>
            <strong>{gap.requirement}</strong>
            {gap.explanation ? `: ${gap.explanation}` : ''}
          </li>
        ))}
      </Box>
      <Typography variant="body2" sx={{ mt: 1 }}>
        The job description marks these as required. If you do have this experience, make sure your resume states it clearly.
      </Typography>
    </Alert>
  );
}

export function CategoryBreakdown({ categories = [] }) {
  const theme = useTheme();
  const data = radarData(categories);
  const summary = data.map((d) => `${d.subject} ${d.value}%`).join(', ');

  return (
    <Card>
      <CardContent>
        <SectionTitle caption="Each bar shows how much of a category's points your resume earned. Categories that do not apply to this job are left out and the rest are scaled to add up to 100.">
          Score by category
        </SectionTitle>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={data.length >= 3 ? 6 : 12}>
            <Stack spacing={2.5}>
              {categories.map((category) => (
                <Box key={category.key}>
                  <Stack direction="row" justifyContent="space-between" spacing={2}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{category.label}</Typography>
                    <Typography variant="body2" color="text.secondary">{formatPoints(category)}</Typography>
                  </Stack>
                  {category.applicable ? (
                    <LinearProgress
                      variant="determinate"
                      value={Math.round((category.ratio || 0) * 100)}
                      color={scoreColor((category.ratio || 0) * 100)}
                      aria-label={`${category.label} match`}
                      sx={{ height: 8, borderRadius: 4, mt: 0.75 }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      This job description gave nothing to measure here, so it was left out.
                    </Typography>
                  )}
                </Box>
              ))}
            </Stack>
          </Grid>
          {data.length >= 3 && (
            <Grid item xs={12} md={6}>
              <Box role="img" aria-label={`Match by category: ${summary}.`} sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={data} outerRadius="70%">
                    <PolarGrid stroke={theme.palette.divider} />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      dataKey="value"
                      stroke={theme.palette.primary.main}
                      fill={theme.palette.primary.main}
                      fillOpacity={0.3}
                      isAnimationActive={false}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </Box>
            </Grid>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
}

function RequirementRow({ item }) {
  const meta = STATUS_META[item.status] || { label: item.status, color: 'default' };
  const confidence = formatConfidence(item.confidence);
  return (
    <Box
      component="li"
      sx={{ listStyle: 'none', py: 1.5, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}
    >
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Typography variant="subtitle2" sx={{ flexGrow: 1, minWidth: 140 }}>{item.requirement}</Typography>
        <Chip size="small" variant="outlined" label={IMPORTANCE_LABELS[item.importance] || item.importance} />
        <Chip size="small" color={meta.color} label={meta.label} />
      </Stack>
      {item.explanation && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.explanation}</Typography>
      )}
      {item.evidence && (
        <Box sx={{ mt: 1, pl: 1.5, borderLeft: '3px solid', borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {evidenceLabel(item.evidenceSection)}{confidence ? ` · ${confidence}` : ''}
          </Typography>
          <Typography variant="body2" sx={{ fontStyle: 'italic', overflowWrap: 'anywhere' }}>{item.evidence}</Typography>
        </Box>
      )}
    </Box>
  );
}

/** Every requirement with its status, evidence and a plain-language explanation, filterable by status. */
export function RequirementsSection({ requirements = [], categories = [] }) {
  const [status, setStatus] = useState('ALL');
  const counts = useMemo(() => countByStatus(requirements), [requirements]);
  const groups = useMemo(
    () => groupByCategory(filterByStatus(requirements, status), categories),
    [requirements, categories, status],
  );

  return (
    <Card>
      <CardContent>
        <SectionTitle caption="Matched means we found evidence in your resume. Not found means we did not find it in the text you supplied. It does not mean you lack the skill.">
          Requirements checked
        </SectionTitle>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={status}
          onChange={(_, value) => value && setStatus(value)}
          aria-label="Filter requirements by status"
          sx={{ mb: 2, flexWrap: 'wrap' }}
        >
          <ToggleButton value="ALL">All ({requirements.length})</ToggleButton>
          {STATUS_ORDER.map((key) => (
            <ToggleButton key={key} value={key}>{STATUS_META[key].label} ({counts[key]})</ToggleButton>
          ))}
        </ToggleButtonGroup>

        {groups.length === 0 && (
          <Typography color="text.secondary">No requirements with this status.</Typography>
        )}
        {groups.map((group) => (
          <Accordion key={group.key} defaultExpanded disableGutters variant="outlined" sx={{ '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />} aria-label={`${group.label}, ${group.items.length} requirements`}>
              <Typography sx={{ fontWeight: 600 }}>{group.label}</Typography>
              <Typography color="text.secondary" sx={{ ml: 1 }}>({group.items.length})</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0 }}>
              <Box component="ul" sx={{ m: 0, p: 0 }}>
                {group.items.map((item) => <RequirementRow key={item.id} item={item} />)}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </CardContent>
    </Card>
  );
}

export function SkillsOverview({ report }) {
  return (
    <Card>
      <CardContent>
        <SectionTitle caption="Skills from the job description, compared with your resume.">Skills overview</SectionTitle>
        <ChipGroup label="Matched" items={report.matchedSkills || []} color="success" emptyText="No skills matched yet." />
        <ChipGroup label="Partially matched" items={report.partialMatches || []} color="warning" emptyText="None." />
        <ChipGroup
          label="Not found in your resume"
          items={report.missingSkills || []}
          color="error"
          variant="outlined"
          emptyText="Every skill from the job description was found."
        />
      </CardContent>
    </Card>
  );
}

const yearsText = (value) => (typeof value === 'number' ? `${value} ${value === 1 ? 'year' : 'years'}` : 'Not detected');

function requiredYearsText(req = {}) {
  if (req.minYears == null && req.maxYears == null) return 'Not specified';
  if (req.minYears != null && req.maxYears != null) return `${req.minYears} to ${req.maxYears} years`;
  return req.minYears != null ? `${req.minYears}+ years` : `Up to ${req.maxYears} years`;
}

function StatusRows({ rows }) {
  if (!rows.length) return null;
  return (
    <Stack spacing={0.75} sx={{ mt: 1.5 }}>
      {rows.map((row) => {
        const meta = STATUS_META[row.status] || { label: row.status, color: 'default' };
        return (
          <Stack key={row.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="body2">{row.requirement}</Typography>
            <Chip size="small" color={meta.color} label={meta.label} />
          </Stack>
        );
      })}
    </Stack>
  );
}

/** Experience and education: what the resume shows next to what the job asks for. */
export function ExperienceEducation({ report }) {
  const profile = report.resumeSummary || {};
  const required = report.extractedRequirements || {};
  const education = required.education || {};
  const rows = report.requirements || [];
  const sourceNote = profile.yearsSource === 'dates'
    ? 'calculated from the dates in your resume'
    : 'estimated from your resume text';

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <SectionTitle>Relevant experience</SectionTitle>
            <Typography variant="body2" color="text.secondary">Your resume</Typography>
            <Typography sx={{ fontWeight: 600 }}>{yearsText(profile.yearsOfExperience)}</Typography>
            {typeof profile.yearsOfExperience === 'number' && (
              <Typography variant="caption" color="text.secondary">{sourceNote}</Typography>
            )}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>This job asks for</Typography>
            <Typography sx={{ fontWeight: 600 }}>{requiredYearsText(required)}</Typography>
            <StatusRows rows={rows.filter((r) => r.category === 'experience')} />
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card sx={{ height: '100%' }}>
          <CardContent>
            <SectionTitle>Education match</SectionTitle>
            <Typography variant="body2" color="text.secondary">Highest level found in your resume</Typography>
            <Typography sx={{ fontWeight: 600 }}>{profile.highestEducation || 'Not detected'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>This job asks for</Typography>
            <Typography sx={{ fontWeight: 600 }}>
              {education.requiredLabel
                ? `${education.requiredLabel}${education.acceptsEquivalentExperience ? ' or equivalent experience' : ''}`
                : 'No degree requirement found'}
            </Typography>
            {education.preferredLabel && (
              <Typography variant="body2" color="text.secondary">Preferred: {education.preferredLabel}</Typography>
            )}
            <StatusRows rows={rows.filter((r) => r.category === 'education')} />
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

export function KeywordRelevance({ report }) {
  const keywordRows = (report.requirements || []).filter((r) => r.category === 'keywords');
  const category = (report.categoryScores || []).find((c) => c.key === 'keywords');
  const named = (status) => keywordRows.filter((r) => r.status === status).map((r) => r.requirement);

  return (
    <Card>
      <CardContent>
        <SectionTitle caption="Other terms from the job description that applicant tracking systems often search for.">
          Keyword relevance
        </SectionTitle>
        {keywordRows.length === 0 ? (
          <Typography color="text.secondary">No additional keywords were found in this job description.</Typography>
        ) : (
          <>
            {category?.applicable && (
              <Typography variant="body2" sx={{ mb: 1.5 }}>
                Your resume contains {Math.round((category.ratio || 0) * 100)}% of these keywords.
              </Typography>
            )}
            <ChipGroup label="Found" items={named('MATCHED')} color="success" emptyText="None found." />
            <ChipGroup label="Related terms found" items={named('PARTIAL_MATCH')} color="warning" emptyText="None." />
            <ChipGroup label="Not found" items={named('NOT_FOUND')} color="error" variant="outlined" emptyText="None missing." />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function StructureChecklist({ checks = [], category }) {
  if (!checks.length) return null;
  return (
    <Card>
      <CardContent>
        <SectionTitle caption={category ? `${formatPoints(category)}. These checks look at how easy your resume is for software to read.` : undefined}>
          Resume structure and readability
        </SectionTitle>
        <List dense disablePadding>
          {checks.map((check) => (
            <ListItem key={check.id} alignItems="flex-start" disableGutters>
              <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                {check.passed
                  ? <CheckCircleIcon color="success" titleAccess="Passed" />
                  : <CancelOutlinedIcon color="error" titleAccess="Needs attention" />}
              </ListItemIcon>
              <ListItemText primary={check.label} secondary={check.passed ? null : check.hint} />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export function Recommendations({ items = [] }) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3)),
    [items],
  );
  return (
    <Card>
      <CardContent>
        <SectionTitle caption="Only add something to your resume if it is true. Never claim a skill or experience you do not have.">
          Recommendations
        </SectionTitle>
        {sorted.length === 0 ? (
          <Typography color="text.secondary">No improvements suggested. Nice work.</Typography>
        ) : (
          <List disablePadding>
            {sorted.map((item) => {
              const meta = PRIORITY_META[item.priority] || PRIORITY_META.low;
              return (
                <ListItem key={`${item.category}-${item.text}`} alignItems="flex-start" disableGutters sx={{ gap: 1.5 }}>
                  <Chip size="small" color={meta.color} label={meta.label} sx={{ mt: 0.25, flexShrink: 0 }} />
                  <ListItemText primary={item.text} />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalysisNote({ report }) {
  const note = report.semanticAnalysis?.note;
  if (!note) return null;
  return (
    <Typography variant="caption" color="text.secondary" component="p">
      How this was analyzed: {note}
      {report.engineVersion ? ` (scoring engine v${report.engineVersion})` : ''}
    </Typography>
  );
}

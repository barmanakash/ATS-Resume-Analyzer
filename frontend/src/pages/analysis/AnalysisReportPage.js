import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Divider, LinearProgress, Skeleton, Stack, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import analysisService from '../../services/analysisService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../config';

const RECOMMENDATIONS = {
  READY_TO_APPLY: { label: 'Ready to apply', color: 'success', text: 'Your resume matches this job well.' },
  IMPROVE_BEFORE_APPLYING: { label: 'Improve before applying', color: 'warning', text: 'Your resume partly matches. Address the gaps below before you apply.' },
  LOW_COMPATIBILITY: { label: 'Low compatibility', color: 'error', text: 'Your resume matches few of this job\'s requirements.' },
};
const STATUS = {
  MATCHED: { label: 'Matched', color: 'success' },
  PARTIAL_MATCH: { label: 'Partial match', color: 'warning' },
  NOT_FOUND: { label: 'Not found', color: 'error' },
  UNVERIFIED: { label: 'Unverified', color: 'default' },
};
const IMPORTANCE = { MANDATORY: 'Required', PREFERRED: 'Preferred', OPTIONAL: 'Optional' };
const KIND_LABELS = {
  skill: 'Skill', soft_skill: 'Soft skill', certification: 'Certification', experience: 'Experience', title: 'Role',
  education: 'Education', responsibility: 'Duty', keyword: 'Keyword',
};
const SECTION_LABELS = {
  experience: 'work experience', projects: 'projects', summary: 'summary', skills: 'skills list', education: 'education',
  certifications: 'certifications', achievements: 'achievements',
};
const PRIORITY_COLORS = { high: 'error', medium: 'warning', low: 'default' };

const scoreColor = (score) => (score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error');
const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '');

function ScoreCircle({ score }) {
  return (
    <Box sx={{ position: 'relative', display: 'inline-flex' }} role="img" aria-label={`Overall compatibility score ${score} out of 100`}>
      <CircularProgress variant="determinate" value={100} size={140} thickness={4} sx={{ color: 'action.hover', position: 'absolute' }} />
      <CircularProgress variant="determinate" value={score} size={140} thickness={4} color={scoreColor(score)} />
      <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="h3" component="span" sx={{ lineHeight: 1 }}>{score}</Typography>
        <Typography variant="caption" color="text.secondary">out of 100</Typography>
      </Box>
    </Box>
  );
}

function SummaryCard({ report }) {
  const rec = RECOMMENDATIONS[report.recommendation];
  return (
    <Card>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ sm: 'center' }}>
          <ScoreCircle score={report.overallScore} />
          <Box>
            <Typography variant="overline" color="text.secondary">Estimated compatibility</Typography>
            {rec ? (
              <>
                <Box><Chip color={rec.color} label={rec.label} sx={{ fontWeight: 600 }} /></Box>
                <Typography sx={{ mt: 1 }}>{rec.text}</Typography>
              </>
            ) : null}
            {report.disclaimer && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5, maxWidth: 560 }}>
                {report.disclaimer}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function GapsAlert({ gaps }) {
  if (!gaps.length) {
    return <Alert severity="success">No required items are missing from your resume.</Alert>;
  }
  return (
    <Alert severity="error" icon={<ErrorOutlineIcon />}>
      <Typography variant="subtitle2" component="p">
        {gaps.length} required {gaps.length === 1 ? 'item was' : 'items were'} not found in your resume
      </Typography>
      <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.5 }}>
        {gaps.map((gap) => <li key={`${gap.kind}-${gap.requirement}`}>{gap.requirement}</li>)}
      </Box>
    </Alert>
  );
}

function CategoryBreakdown({ categories }) {
  const theme = useTheme();
  const radarData = categories.filter((c) => c.applicable).map((c) => ({ name: c.label, value: Math.round((c.ratio || 0) * 100) }));
  const summary = radarData.map((d) => `${d.name} ${d.value}%`).join(', ');
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Score breakdown</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
          <Stack spacing={2} sx={{ flex: 1 }}>
            {categories.map((c) => {
              const percent = Math.round((c.ratio || 0) * 100);
              return (
                <Box key={c.key}>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline">
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{c.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {c.applicable ? `${c.points} / ${c.effectiveWeight} points` : 'Not scored'}
                    </Typography>
                  </Stack>
                  {c.applicable ? (
                    <LinearProgress
                      variant="determinate"
                      value={percent}
                      color={scoreColor(percent)}
                      aria-label={`${c.label} ${percent} percent`}
                      sx={{ height: 8, borderRadius: 4, mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">
                      The job description does not specify this, so its weight is shared by the other categories.
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Stack>
          {radarData.length >= 3 && (
            <Box role="img" aria-label={`Match by category: ${summary}`} sx={{ flex: 1, height: 280, minWidth: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="70%">
                  <PolarGrid stroke={theme.palette.divider} />
                  <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke={theme.palette.primary.main} fill={theme.palette.primary.main} fillOpacity={0.3} isAnimationActive={false} />
                </RadarChart>
              </ResponsiveContainer>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

function RequirementRow({ item }) {
  const status = STATUS[item.status] || STATUS.UNVERIFIED;
  return (
    <Box sx={{ py: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>{item.requirement}</Typography>
        <Chip size="small" variant="outlined" label={KIND_LABELS[item.kind] || item.kind} />
        <Chip size="small" variant="outlined" label={IMPORTANCE[item.importance] || item.importance} />
        <Chip size="small" color={status.color} label={status.label} />
        {typeof item.confidence === 'number' && (
          <Typography variant="caption" color="text.secondary">Confidence {Math.round(item.confidence * 100)}%</Typography>
        )}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{item.explanation}</Typography>
      {item.evidence && (
        <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic', overflowWrap: 'anywhere' }}>
          {item.evidenceSection ? `From your ${SECTION_LABELS[item.evidenceSection] || item.evidenceSection}: ` : 'From your resume: '}
          &ldquo;{item.evidence}&rdquo;
        </Typography>
      )}
    </Box>
  );
}

function Requirements({ items, categories }) {
  const [filter, setFilter] = useState('ALL');
  const counts = useMemo(() => {
    const result = { ALL: items.length, MATCHED: 0, PARTIAL_MATCH: 0, NOT_FOUND: 0, UNVERIFIED: 0 };
    items.forEach((i) => { result[i.status] = (result[i.status] || 0) + 1; });
    return result;
  }, [items]);
  const visible = items.filter((i) => filter === 'ALL' || i.status === filter);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>Requirements in detail</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={(_, value) => { if (value) setFilter(value); }}
          aria-label="Filter requirements by status"
          sx={{ mb: 2, flexWrap: 'wrap' }}
        >
          <ToggleButton value="ALL">All ({counts.ALL})</ToggleButton>
          <ToggleButton value="MATCHED">Matched ({counts.MATCHED})</ToggleButton>
          <ToggleButton value="PARTIAL_MATCH">Partial ({counts.PARTIAL_MATCH})</ToggleButton>
          <ToggleButton value="NOT_FOUND">Not found ({counts.NOT_FOUND})</ToggleButton>
          {counts.UNVERIFIED > 0 && <ToggleButton value="UNVERIFIED">Unverified ({counts.UNVERIFIED})</ToggleButton>}
        </ToggleButtonGroup>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
          &ldquo;Not found&rdquo; means the item was not found in the resume you supplied, not that you lack the skill.
        </Typography>
        {visible.length === 0 && <Typography color="text.secondary" sx={{ py: 2 }}>Nothing to show for this filter.</Typography>}
        {categories.map((category) => {
          const rows = visible.filter((i) => i.category === category.key);
          if (!rows.length) return null;
          return (
            <Box key={category.key} sx={{ mt: 2 }}>
              <Typography variant="overline" color="text.secondary">{category.label}</Typography>
              <Divider />
              {rows.map((item, index) => (
                <Box key={item.id} sx={index ? { borderTop: 1, borderColor: 'divider' } : undefined}>
                  <RequirementRow item={item} />
                </Box>
              ))}
            </Box>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Recommendations({ items }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>How to improve</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Only add skills and experience you genuinely have.
        </Typography>
        <Stack component="ol" spacing={1.5} sx={{ m: 0, pl: 2.5 }}>
          {items.map((rec, index) => (
            <li key={index}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Chip size="small" color={PRIORITY_COLORS[rec.priority] || 'default'} label={`${rec.priority} priority`} sx={{ textTransform: 'capitalize', flexShrink: 0 }} />
                <Typography variant="body2">{rec.text}</Typography>
              </Stack>
            </li>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

function StructureCard({ checks, summary }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>Resume structure</Typography>
        <Stack spacing={1}>
          {checks.map((check) => (
            <Stack key={check.id} direction="row" spacing={1} alignItems="flex-start">
              {check.passed ? <CheckCircleIcon color="success" fontSize="small" /> : <CancelIcon color="error" fontSize="small" />}
              <Box>
                <Typography variant="body2">
                  {check.label}
                  <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    {check.passed ? ' (passed)' : ' (needs attention)'}
                  </Box>
                </Typography>
                {!check.passed && check.hint && <Typography variant="caption" color="text.secondary">{check.hint}</Typography>}
              </Box>
            </Stack>
          ))}
        </Stack>
        {summary && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>What we read from your resume</Typography>
            <Typography variant="body2" color="text.secondary">
              Experience: {summary.yearsOfExperience != null ? `about ${summary.yearsOfExperience} years` : 'could not be determined'}
              {' · '}Highest education: {summary.highestEducation || 'not found'}
              {' · '}Words: {summary.wordCount}
            </Typography>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function DeleteDialog({ onClose, onConfirm, deleting, error }) {
  return (
    <Dialog open onClose={deleting ? undefined : onClose} aria-labelledby="delete-analysis-title">
      <DialogTitle id="delete-analysis-title">Delete this analysis?</DialogTitle>
      <DialogContent>
        <DialogContentText>The report will be permanently deleted. Your resume and job description are not affected.</DialogContentText>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={deleting}>Delete</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AnalysisReportPage() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const { success } = useNotification();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await analysisService.get(analysisId));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this report.'));
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => { load(); }, [load]);

  const remove = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await analysisService.remove(analysisId);
      success('Analysis deleted.');
      navigate(ROUTES.dashboard, { replace: true });
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete this analysis.'));
      setDeleting(false);
    }
  };

  const header = (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={2} sx={{ mb: 3 }}>
      <Box sx={{ minWidth: 0 }}>
        <Button component={RouterLink} to={ROUTES.dashboard} size="small" startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>Dashboard</Button>
        <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
          {report ? (report.jobTitle || 'Analysis report') : 'Analysis report'}
        </Typography>
        {report && (
          <Typography color="text.secondary">
            {[report.companyName, report.resumeName, formatDate(report.createdAt)].filter(Boolean).join(' · ')}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={1}>
        <Button component={RouterLink} to={ROUTES.newAnalysis} variant="contained" startIcon={<AddIcon />}>New analysis</Button>
        {report && <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmDelete(true)}>Delete</Button>}
      </Stack>
    </Stack>
  );

  if (loading) {
    return (
      <Box>
        {header}
        <Stack spacing={3}><Skeleton variant="rounded" height={200} /><Skeleton variant="rounded" height={280} /><Skeleton variant="rounded" height={200} /></Stack>
      </Box>
    );
  }
  if (error) {
    return (
      <Box>
        {header}
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{error}</Alert>
      </Box>
    );
  }

  const detailed = Boolean(report.engineVersion && report.categoryScores);

  return (
    <Box sx={{ maxWidth: 1000 }}>
      {header}
      <Stack spacing={3}>
        {detailed ? (
          <>
            <SummaryCard report={report} />
            {(report.warnings || []).map((warning) => <Alert key={warning} severity="warning">{warning}</Alert>)}
            <GapsAlert gaps={report.mandatoryGaps || []} />
            <CategoryBreakdown categories={report.categoryScores} />
            <Requirements items={report.requirements || []} categories={report.categoryScores} />
            <Recommendations items={report.improvementRecommendations || []} />
            <StructureCard checks={report.structureChecks || []} summary={report.resumeSummary} />
            {report.semanticAnalysis && !report.semanticAnalysis.enabled && (
              <Typography variant="caption" color="text.secondary">{report.semanticAnalysis.note}</Typography>
            )}
          </>
        ) : (
          <>
            <Alert severity="info">
              This analysis was created with an older version of the scoring engine and has no detailed report.
              Run a new analysis for the full breakdown.
            </Alert>
            <Card><CardContent><ScoreCircle score={Math.round(report.overallScore || 0)} /></CardContent></Card>
          </>
        )}
      </Stack>
      {confirmDelete && (
        <DeleteDialog onClose={() => setConfirmDelete(false)} onConfirm={remove} deleting={deleting} error={deleteError} />
      )}
    </Box>
  );
}

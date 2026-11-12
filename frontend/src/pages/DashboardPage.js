import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, LinearProgress, Link, List, ListItem, ListItemText, Skeleton, Stack, Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import AddIcon from '@mui/icons-material/Add';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useAuth } from '../context/AuthContext';
import dashboardService from '../services/dashboardService';
import { getErrorMessage } from '../services/apiClient';
import { ROUTES } from '../config';

const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');
const formatShortDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

/** Visual banding only. The recommendation thresholds that matter live in the scoring engine. */
const scoreColor = (score) => (score >= 75 ? 'success' : score >= 50 ? 'warning' : 'error');

function StatCard({ icon, label, value, loading, hint }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ bgcolor: 'primary.main', '& svg': { color: '#fff' }, width: 44, height: 44, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            {loading ? <Skeleton width={60} height={36} /> : <Typography variant="h4" component="p">{value}</Typography>}
            {hint && !loading && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function RecentList({ title, items, loading, emptyText, emptyAction, renderPrimary, renderSecondary, trailing, actionTo, actionLabel }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="h6" component="h2">{title}</Typography>
          <Button component={RouterLink} to={actionTo} size="small">{actionLabel}</Button>
        </Stack>
        {loading ? (
          <Stack spacing={1}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={44} />)}</Stack>
        ) : items.length === 0 ? (
          <Box sx={{ py: 3 }}>
            <Typography color="text.secondary">{emptyText}</Typography>
            {emptyAction}
          </Box>
        ) : (
          <List disablePadding>
            {items.map((item) => (
              <ListItem key={item.id} divider disableGutters secondaryAction={trailing ? trailing(item) : null}>
                <ListItemText
                  sx={{ pr: 8 }}
                  primary={renderPrimary(item)}
                  secondary={renderSecondary(item)}
                  primaryTypographyProps={{ noWrap: true }}
                  secondaryTypographyProps={{ noWrap: true }}
                />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

function ChecklistRow({ done, label }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {done ? <CheckCircleIcon color="success" fontSize="small" /> : <RadioButtonUncheckedIcon color="disabled" fontSize="small" />}
      <Typography variant="body2" color={done ? 'text.primary' : 'text.secondary'}>
        {label}
        <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {done ? ' (done)' : ' (not done yet)'}
        </Box>
      </Typography>
    </Stack>
  );
}

/** Tells the user the next useful step: upload a resume, add a job, or start an analysis. */
function QuickAnalysisCard({ data, loading }) {
  const hasResume = (data?.totalResumes ?? 0) > 0;
  const hasJob = (data?.totalJobDescriptions ?? 0) > 0;
  let action = { to: ROUTES.newAnalysis, label: 'Start analysis', text: 'Pick a resume and a job description to see how well they match.' };
  if (!hasResume) action = { to: ROUTES.resumes, label: 'Upload a resume', text: 'Upload your resume first. PDF and DOCX files are supported.' };
  else if (!hasJob) action = { to: ROUTES.jobs, label: 'Add a job description', text: 'Save the job description you want to apply for.' };

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>Quick analysis</Typography>
        {loading ? (
          <Stack spacing={1}><Skeleton width="80%" /><Skeleton width="60%" /><Skeleton variant="rounded" height={40} /></Stack>
        ) : (
          <Stack spacing={2}>
            <Stack spacing={0.5}>
              <ChecklistRow done={hasResume} label="Resume uploaded" />
              <ChecklistRow done={hasJob} label="Job description saved" />
            </Stack>
            <Typography variant="body2" color="text.secondary">{action.text}</Typography>
            <Button component={RouterLink} to={action.to} variant="contained" startIcon={<AddIcon />} sx={{ alignSelf: 'flex-start' }}>
              {action.label}
            </Button>
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function UsageRow({ label, used, limit }) {
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">{limit ? `${used} of ${limit}` : used}</Typography>
      </Stack>
      {limit ? (
        <LinearProgress
          variant="determinate"
          value={percent}
          color={percent >= 90 ? 'warning' : 'primary'}
          aria-label={`${label} used`}
          sx={{ mt: 0.5, height: 6, borderRadius: 3 }}
        />
      ) : null}
    </Box>
  );
}

function UsageCard({ usage, loading }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Usage</Typography>
        {loading ? (
          <Stack spacing={2}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={32} />)}</Stack>
        ) : (
          <Stack spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">Analyses this month</Typography>
              <Typography variant="h5" component="p">{usage.analysesThisMonth}</Typography>
            </Box>
            <UsageRow label="Stored resumes" used={usage.resumes.used} limit={usage.resumes.limit} />
            <UsageRow label="Saved job descriptions" used={usage.jobDescriptions.used} limit={usage.jobDescriptions.limit} />
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

function ScoreTrendCard({ trend, loading }) {
  const theme = useTheme();
  const points = trend.map((p, index) => ({ name: formatShortDate(p.createdAt) || `#${index + 1}`, score: Math.round(p.score) }));
  const summary = points.length ? `Compatibility scores of your last ${points.length} analyses: ${points.map((p) => `${p.score}%`).join(', ')}.` : '';

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="h6" component="h2" sx={{ mb: 1 }}>Score trend</Typography>
        {loading ? (
          <Skeleton variant="rounded" height={220} />
        ) : points.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 3 }}>Your compatibility scores will appear here after your first analysis.</Typography>
        ) : (
          <Box role="img" aria-label={summary} sx={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`${value}%`, 'Score']} />
                <Line type="monotone" dataKey="score" stroke={theme.palette.primary.main} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await dashboardService.getOverview());
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load your dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const average = data?.averageCompatibilityScore;
  const firstName = (user?.fullName || '').split(' ')[0];
  const showContent = !error || data; // keep showing the last good data if a refresh fails

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">Welcome{firstName ? `, ${firstName}` : ''}</Typography>
          <Typography color="text.secondary">Here is an overview of your resumes and analyses.</Typography>
        </Box>
        <Button component={RouterLink} to={ROUTES.newAnalysis} variant="contained" size="large" startIcon={<AddIcon />}>
          New analysis
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {showContent && (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard icon={<DescriptionOutlinedIcon />} label="Resumes uploaded" value={data?.totalResumes ?? 0} loading={loading && !data} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard icon={<WorkOutlineIcon />} label="Job descriptions" value={data?.totalJobDescriptions ?? 0} loading={loading && !data} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard icon={<AnalyticsOutlinedIcon />} label="Analyses completed" value={data?.totalAnalyses ?? 0} loading={loading && !data} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StatCard
                icon={<SpeedOutlinedIcon />}
                label="Avg. compatibility score"
                value={typeof average === 'number' ? `${Math.round(average)}%` : '—'}
                loading={loading && !data}
                hint={typeof average === 'number' ? 'Estimated match, not an ATS guarantee' : 'Run an analysis to see your average'}
              />
            </Grid>
          </Grid>

          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <QuickAnalysisCard data={data} loading={loading && !data} />
            </Grid>
            <Grid item xs={12} md={5}>
              <ScoreTrendCard trend={data?.scoreTrend || []} loading={loading && !data} />
            </Grid>
            <Grid item xs={12} md={3}>
              <UsageCard
                usage={data?.usage || { analysesThisMonth: 0, resumes: { used: 0, limit: null }, jobDescriptions: { used: 0, limit: null } }}
                loading={loading && !data}
              />
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <RecentList
                title="Recent analyses"
                items={data?.recentAnalyses || []}
                loading={loading && !data}
                emptyText="No analyses yet. Start one to see how your resume matches a job."
                renderPrimary={(a) => (
                  <Link component={RouterLink} to={ROUTES.analysisDetail(a.id)} underline="hover" color="inherit">
                    {a.jobTitle || 'Job description removed'}
                  </Link>
                )}
                renderSecondary={(a) => [a.companyName, a.resumeName || 'Resume removed', formatDate(a.createdAt)].filter(Boolean).join(' · ')}
                trailing={(a) => (typeof a.overallScore === 'number'
                  ? <Chip size="small" color={scoreColor(a.overallScore)} label={`${Math.round(a.overallScore)}%`} />
                  : <Chip size="small" label={a.status || 'PENDING'} />)}
                actionTo={ROUTES.history}
                actionLabel="View all"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <RecentList
                title="Recent resumes"
                items={data?.recentResumes || []}
                loading={loading && !data}
                emptyText="No resumes uploaded yet."
                emptyAction={(
                  <Button component={RouterLink} to={ROUTES.resumes} size="small" sx={{ mt: 1 }}>Upload your first resume</Button>
                )}
                renderPrimary={(r) => r.displayName || r.originalFileName}
                renderSecondary={(r) => `Uploaded ${formatDate(r.createdAt)}`}
                trailing={(r) => <Chip size="small" variant="outlined" label={(r.fileType || '').toUpperCase()} />}
                actionTo={ROUTES.resumes}
                actionLabel="Manage"
              />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}

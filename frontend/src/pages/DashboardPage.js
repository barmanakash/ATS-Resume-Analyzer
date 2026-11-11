import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, List, ListItem, ListItemText, Skeleton, Stack, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import { useAuth } from '../context/AuthContext';
import dashboardService from '../services/dashboardService';
import { getErrorMessage } from '../services/apiClient';
import { ROUTES } from '../config';

function StatCard({ icon, label, value, loading, hint }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box sx={{ color: 'primary.main', bgcolor: 'primary.main', '& svg': { color: '#fff' }, width: 44, height: 44, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            {loading ? <Skeleton width={60} height={36} /> : <Typography variant="h4" component="p">{value}</Typography>}
            {hint && !loading && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

function RecentList({ title, items, loading, emptyText, renderPrimary, renderSecondary, trailing, actionTo, actionLabel }) {
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
          <Typography color="text.secondary" sx={{ py: 3 }}>{emptyText}</Typography>
        ) : (
          <List disablePadding>
            {items.map((item) => (
              <ListItem key={item.id || item._id} divider disableGutters secondaryAction={trailing ? trailing(item) : null}>
                <ListItemText primary={renderPrimary(item)} secondary={renderSecondary(item)} />
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

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

  const scored = (data?.analyses || []).filter((a) => typeof a.overallScore === 'number');
  const avg = scored.length ? Math.round(scored.reduce((s, a) => s + a.overallScore, 0) / scored.length) : null;
  const firstName = (user?.fullName || '').split(' ')[0];

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

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatCard icon={<DescriptionOutlinedIcon />} label="Resumes uploaded" value={data?.resumesTotal ?? 0} loading={loading} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard icon={<AnalyticsOutlinedIcon />} label="Analyses completed" value={data?.analysesTotal ?? 0} loading={loading} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard icon={<SpeedOutlinedIcon />} label="Avg. compatibility score" value={avg === null ? '—' : `${avg}%`} loading={loading} hint="Based on your recent analyses" />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <RecentList
            title="Recent analyses"
            items={data?.analyses || []}
            loading={loading}
            emptyText="No analyses yet. Start one to see how your resume matches a job."
            renderPrimary={(a) => a.jobTitle || a.jobDescriptionTitle || 'Untitled job'}
            renderSecondary={(a) => `${a.resumeName || 'Resume'} · ${formatDate(a.createdAt)}`}
            trailing={(a) => (typeof a.overallScore === 'number' ? <Chip size="small" color="primary" label={`${Math.round(a.overallScore)}%`} /> : <Chip size="small" label={a.status || 'PENDING'} />)}
            actionTo={ROUTES.history}
            actionLabel="View all"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <RecentList
            title="Recent resumes"
            items={data?.resumes || []}
            loading={loading}
            emptyText="No resumes uploaded yet."
            renderPrimary={(r) => r.originalFileName}
            renderSecondary={(r) => `Uploaded ${formatDate(r.createdAt)}`}
            trailing={(r) => <Chip size="small" variant="outlined" label={(r.fileType || '').toUpperCase()} />}
            actionTo={ROUTES.resumes}
            actionLabel="Manage"
          />
        </Grid>
      </Grid>
    </Box>
  );
}

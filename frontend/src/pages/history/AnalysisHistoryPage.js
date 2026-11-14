import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, Pagination, Skeleton, Stack, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import analysisService from '../../services/analysisService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../config';
import { RECOMMENDATION_META, formatDate, scoreColor } from '../../utils/analysis';
import {
  PAGE_SIZE, STATE_NOTES, analysisState, pageAfterDelete, pageFromParam, rangeLabel,
} from './historyUtils';

const titleOf = (item) => item.jobTitle || 'Untitled job';

function ScoreBadge({ item, state }) {
  const hasScore = typeof item.overallScore === 'number' && state !== 'failed' && state !== 'running';
  const color = hasScore ? `${scoreColor(item.overallScore)}.main` : 'divider';
  return (
    <Box
      role="img"
      aria-label={hasScore ? `Score ${Math.round(item.overallScore)} out of 100` : 'No score'}
      sx={{
        width: 60, height: 60, flexShrink: 0, borderRadius: '50%', border: 4, borderColor: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }} color={hasScore ? 'text.primary' : 'text.secondary'}>
        {hasScore ? Math.round(item.overallScore) : '\u2014'}
      </Typography>
    </Box>
  );
}

function HistoryRow({ item, onDelete }) {
  const state = analysisState(item);
  const recommendation = RECOMMENDATION_META[item.recommendation];
  const gaps = item.mandatoryGapCount;
  const note = state === 'failed' ? (item.errorMessage || STATE_NOTES.failed) : STATE_NOTES[state];
  const details = [item.companyName, item.resumeName, formatDate(item.completedAt || item.createdAt)].filter(Boolean);

  return (
    <Card component="li" sx={{ listStyle: 'none' }}>
      <CardContent>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
          <ScoreBadge item={item} state={state} />

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
              {state === 'ready' ? (
                <Box component={RouterLink} to={ROUTES.analysisDetail(item.id)} sx={{ color: 'inherit', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                  {titleOf(item)}
                </Box>
              ) : titleOf(item)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {details.join(' \u00b7 ')}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
              {state === 'ready' && recommendation && <Chip size="small" color={recommendation.color} label={recommendation.label} />}
              {state === 'ready' && typeof gaps === 'number' && (
                <Chip
                  size="small"
                  variant="outlined"
                  color={gaps ? 'warning' : 'success'}
                  label={gaps ? `${gaps} required ${gaps === 1 ? 'item' : 'items'} not found` : 'No required items missing'}
                />
              )}
              {state === 'legacy' && <Chip size="small" variant="outlined" label="Older version" />}
              {state === 'failed' && <Chip size="small" color="error" label="Failed" />}
              {state === 'running' && <Chip size="small" label="Running" />}
            </Stack>
            {note && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 0.75 }}>{note}</Typography>}
          </Box>

          <Stack direction="row" spacing={1} alignItems="center">
            {state === 'ready' ? (
              <Button
                component={RouterLink}
                to={ROUTES.analysisDetail(item.id)}
                variant="outlined"
                aria-label={`View report for ${titleOf(item)}`}
              >
                View report
              </Button>
            ) : (
              <Button variant="outlined" disabled aria-label={`View report for ${titleOf(item)}`}>View report</Button>
            )}
            <Tooltip title="Delete">
              <IconButton color="error" aria-label={`Delete analysis of ${titleOf(item)}`} onClick={() => onDelete(item)}>
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function AnalysisHistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = pageFromParam(searchParams.get('page'));
  const { success, error: notifyError } = useNotification();

  const [data, setData] = useState({ items: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = latestRequest.current + 1;
    latestRequest.current = requestId;
    setLoading(true);
    setError('');
    try {
      const result = await analysisService.list(page, PAGE_SIZE);
      if (requestId !== latestRequest.current) return; // a newer page was requested meanwhile
      setData(result);
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(getErrorMessage(err, 'Could not load your analysis history.'));
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  // A link to a page that no longer exists (for example after deleting items elsewhere) lands on the last page.
  useEffect(() => {
    if (!loading && !error && data.total > 0 && page > data.totalPages) {
      setSearchParams({ page: String(data.totalPages) }, { replace: true });
    }
  }, [loading, error, data.total, data.totalPages, page, setSearchParams]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await analysisService.remove(toDelete.id);
      success('Analysis deleted.');
      const nextPage = pageAfterDelete(page, data.items.length);
      setToDelete(null);
      if (nextPage !== page) setSearchParams({ page: String(nextPage) });
      else await load();
    } catch (err) {
      notifyError(getErrorMessage(err, 'Could not delete this analysis. Please try again.'));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const showEmpty = !loading && !error && data.total === 0;
  const showList = !error && data.items.length > 0;

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">Analysis history</Typography>
          <Typography color="text.secondary">Your previous analyses, newest first. Open one to see the full report.</Typography>
        </Box>
        <Button component={RouterLink} to={ROUTES.newAnalysis} variant="contained" startIcon={<AddIcon />}>
          New analysis
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {loading && !showList && !error && (
        <Stack spacing={2} aria-busy="true" aria-label="Loading analysis history">
          {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={110} />)}
        </Stack>
      )}

      {showEmpty && (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <HistoryIcon color="primary" sx={{ fontSize: 56, mb: 1 }} />
            <Typography variant="h6">No analyses yet</Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Compare a resume with a job description and your results will be kept here.
            </Typography>
            <Button component={RouterLink} to={ROUTES.newAnalysis} variant="contained" startIcon={<AddIcon />}>
              Start your first analysis
            </Button>
          </CardContent>
        </Card>
      )}

      {showList && (
        <Stack spacing={2} sx={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s' }}>
          <Stack component="ul" spacing={2} sx={{ p: 0, m: 0 }} aria-label="Previous analyses">
            {data.items.map((item) => <HistoryRow key={item.id} item={item} onDelete={setToDelete} />)}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary">{rangeLabel(page, PAGE_SIZE, data.items.length, data.total)}</Typography>
            {data.totalPages > 1 && (
              <Pagination
                count={data.totalPages}
                page={Math.min(page, data.totalPages)}
                onChange={(_, value) => setSearchParams({ page: String(value) })}
                color="primary"
                disabled={loading}
              />
            )}
          </Stack>
        </Stack>
      )}

      <Dialog open={Boolean(toDelete)} onClose={deleting ? undefined : () => setToDelete(null)} aria-labelledby="delete-history-title">
        <DialogTitle id="delete-history-title">Delete this analysis?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The report for {toDelete ? `"${titleOf(toDelete)}"` : 'this analysis'} will be permanently deleted. Your resume and job description are not affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setToDelete(null)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting\u2026' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

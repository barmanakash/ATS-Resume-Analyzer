import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, Pagination, Skeleton, Stack, Tooltip, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import jobService from '../../services/jobService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../config';
import JobFormDialog from './JobFormDialog';

const PAGE_SIZE = 10;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

function DeleteJobDialog({ job, onClose, onDeleted }) {
  const { success } = useNotification();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setDeleting(true);
    setError('');
    try {
      await jobService.remove(job.id);
      success('Job description deleted.');
      onDeleted();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete this job description.'));
      setDeleting(false);
    }
  };

  return (
    <Dialog open onClose={deleting ? undefined : onClose} aria-labelledby="delete-job-title">
      <DialogTitle id="delete-job-title">Delete this job description?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          &quot;{job.jobTitle}&quot; will be permanently deleted. Analyses already created with it are kept, but will show the
          job as removed.
        </DialogContentText>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>Cancel</Button>
        <Button color="error" variant="contained" onClick={remove} disabled={deleting}>Delete</Button>
      </DialogActions>
    </Dialog>
  );
}

function JobRow({ job, onEdit, onDelete }) {
  const subtitle = [job.companyName, `Saved ${formatDate(job.createdAt)}`].filter(Boolean).join(' · ');
  return (
    <Card>
      <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' } }}>
        <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ flexGrow: 1, minWidth: 0 }}>
          <WorkOutlineIcon color="primary" sx={{ mt: 0.5 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>{job.jobTitle}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{subtitle}</Typography>
            {job.descriptionPreview && (
              <Typography
                variant="body2"
                sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
              >
                {job.descriptionPreview}
              </Typography>
            )}
          </Box>
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button component={RouterLink} to={`${ROUTES.newAnalysis}?jobId=${job.id}`} size="small" variant="outlined">
            Analyze
          </Button>
          <Tooltip title="View or edit">
            <IconButton aria-label={`Edit ${job.jobTitle}`} onClick={() => onEdit(job)}><EditOutlinedIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton aria-label={`Delete ${job.jobTitle}`} color="error" onClick={() => onDelete(job)}><DeleteOutlineIcon /></IconButton>
          </Tooltip>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function JobsPage() {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // undefined = closed, null = creating a new job, object = editing that job
  const [formTarget, setFormTarget] = useState(undefined);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async (targetPage) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await jobService.list(targetPage, PAGE_SIZE);
      if (result.items.length === 0 && targetPage > 1) {
        setPage(targetPage - 1); // the last item on this page was removed
        return;
      }
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your job descriptions.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const afterCreate = () => {
    setFormTarget(undefined);
    if (page === 1) load(1);
    else setPage(1); // new items appear first
  };

  const afterEdit = () => {
    setFormTarget(undefined);
    load(page);
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" component="h1">Job descriptions</Typography>
          <Typography color="text.secondary">Save the jobs you are applying for and reuse them in any analysis.</Typography>
        </Box>
        <Button variant="contained" size="large" startIcon={<AddIcon />} onClick={() => setFormTarget(null)}>
          Add job description
        </Button>
      </Stack>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => load(page)}>Retry</Button>}>
          {loadError}
        </Alert>
      )}

      {!loading && total > 0 && (
        <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Saved ({total})</Typography>
      )}

      {loading ? (
        <Stack spacing={2}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={96} />)}</Stack>
      ) : !loadError && items.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <WorkOutlineIcon color="disabled" sx={{ fontSize: 48 }} />
            <Typography variant="h6">No job descriptions yet</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Paste a job posting or upload it as a PDF, DOCX or TXT file.
            </Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setFormTarget(null)}>Add your first job description</Button>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {items.map((job) => (
            <JobRow key={job.id} job={job} onEdit={(j) => setFormTarget(j)} onDelete={setDeleteTarget} />
          ))}
          {totalPages > 1 && (
            <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} sx={{ alignSelf: 'center', mt: 1 }} />
          )}
        </Stack>
      )}

      {formTarget !== undefined && (
        <JobFormDialog
          jobId={formTarget ? formTarget.id : null}
          onClose={() => setFormTarget(undefined)}
          onSaved={formTarget ? afterEdit : afterCreate}
        />
      )}
      {deleteTarget && (
        <DeleteJobDialog
          job={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); load(page); }}
        />
      )}
    </Box>
  );
}

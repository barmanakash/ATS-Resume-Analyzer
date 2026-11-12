import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  IconButton, LinearProgress, Pagination, Skeleton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import resumeService from '../../services/resumeService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../config';
import { defaultResumeName, formatBytes, validateResumeFile } from '../../utils/resumeFile';
import UploadDropzone from './UploadDropzone';
import ResumeDetailDialog from './ResumeDetailDialog';

const PAGE_SIZE = 10;
const formatDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '');

function StagedFile({ staged, setStaged, uploading, progress, error, onUpload, onCancel }) {
  const processing = uploading && progress >= 100;
  return (
    <Card sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <InsertDriveFileOutlinedIcon color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap>{staged.file.name}</Typography>
            <Typography variant="caption" color="text.secondary">{formatBytes(staged.file.size)}</Typography>
          </Box>
        </Stack>
        <TextField
          label="Resume name"
          helperText="How this resume is listed in your account. Optional."
          value={staged.name}
          onChange={(e) => setStaged({ ...staged, name: e.target.value })}
          disabled={uploading}
          inputProps={{ maxLength: 200 }}
        />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {uploading && (
          <Box sx={{ mt: 2 }} role="status">
            <LinearProgress
              variant={processing ? 'indeterminate' : 'determinate'}
              value={progress}
              aria-label={processing ? 'Reading your document' : 'Upload progress'}
            />
            <Typography variant="caption" color="text.secondary">
              {processing ? 'Reading your document…' : `Uploading… ${progress}%`}
            </Typography>
          </Box>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={onUpload} disabled={uploading}>Upload resume</Button>
          <Button onClick={onCancel} disabled={uploading}>Cancel</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function RenameDialog({ resume, onClose, onSaved }) {
  const { success } = useNotification();
  const [name, setName] = useState(resume.displayName || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Enter a name.'); return; }
    setSaving(true);
    setError('');
    try {
      await resumeService.rename(resume.id, trimmed);
      success('Resume renamed.');
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not rename this resume.'));
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs" aria-labelledby="rename-title">
      <DialogTitle id="rename-title">Rename resume</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Resume name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
          error={Boolean(error)}
          helperText={error || 'The original file name is not changed.'}
          inputProps={{ maxLength: 200 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteDialog({ resume, onClose, onDeleted }) {
  const { success } = useNotification();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setDeleting(true);
    setError('');
    try {
      await resumeService.remove(resume.id);
      success('Resume deleted.');
      onDeleted();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete this resume.'));
      setDeleting(false);
    }
  };

  return (
    <Dialog open onClose={deleting ? undefined : onClose} aria-labelledby="delete-title">
      <DialogTitle id="delete-title">Delete this resume?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          &quot;{resume.displayName}&quot; will be permanently deleted, together with its stored file and every analysis and
          optimized version created from it. This cannot be undone.
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

function ResumeRow({ resume, onView, onRename, onDownload, onDelete, downloading }) {
  const failed = resume.processingStatus === 'FAILED';
  return (
    <Card>
      <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' } }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ flexGrow: 1, minWidth: 0 }}>
          <DescriptionOutlinedIcon color="primary" />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>{resume.displayName}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {[resume.originalFileName, formatBytes(resume.fileSize), `Uploaded ${formatDate(resume.createdAt)}`].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
          <Chip size="small" variant="outlined" label={(resume.fileType || '').toUpperCase()} />
          {failed && <Chip size="small" color="error" label="Failed" />}
        </Stack>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <Button
            component={RouterLink}
            to={`${ROUTES.newAnalysis}?resumeId=${resume.id}`}
            size="small"
            variant="outlined"
            disabled={failed}
          >
            Analyze
          </Button>
          <Tooltip title="View details"><IconButton aria-label={`View ${resume.displayName}`} onClick={() => onView(resume)}><VisibilityOutlinedIcon /></IconButton></Tooltip>
          <Tooltip title="Rename"><IconButton aria-label={`Rename ${resume.displayName}`} onClick={() => onRename(resume)}><EditOutlinedIcon /></IconButton></Tooltip>
          <Tooltip title="Download original">
            <span>
              <IconButton aria-label={`Download ${resume.displayName}`} onClick={() => onDownload(resume)} disabled={downloading}><DownloadOutlinedIcon /></IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete"><IconButton aria-label={`Delete ${resume.displayName}`} color="error" onClick={() => onDelete(resume)}><DeleteOutlineIcon /></IconButton></Tooltip>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ResumesPage() {
  const { success, error: notifyError } = useNotification();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [staged, setStaged] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const [viewId, setViewId] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(async (targetPage) => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await resumeService.list(targetPage, PAGE_SIZE);
      if (result.items.length === 0 && targetPage > 1) {
        setPage(targetPage - 1); // the last item on this page was removed
        return;
      }
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your resumes.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const handleFiles = (files) => {
    setUploadError('');
    if (files.length > 1) {
      notifyError('Upload one resume at a time.');
      return;
    }
    const problem = validateResumeFile(files[0]);
    if (problem) {
      setStaged(null);
      setUploadError(problem);
      return;
    }
    setStaged({ file: files[0], name: defaultResumeName(files[0].name) });
  };

  const handleUpload = async () => {
    setUploading(true);
    setProgress(0);
    setUploadError('');
    try {
      await resumeService.upload(staged.file, staged.name.trim(), setProgress);
      success('Resume uploaded and processed.');
      setStaged(null);
      if (page === 1) await load(1);
      else setPage(1);
    } catch (err) {
      setUploadError(getErrorMessage(err, 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (resume) => {
    setDownloadingId(resume.id);
    try {
      await resumeService.download(resume.id, resume.originalFileName);
    } catch (err) {
      notifyError(getErrorMessage(err, 'Could not download this file. It may no longer be available.'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <Box>
      <Typography variant="h4" component="h1">My resumes</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Upload your resumes once and reuse them for any job analysis.
      </Typography>

      <UploadDropzone onFile={handleFiles} disabled={uploading} />
      {uploadError && !staged && <Alert severity="error" sx={{ mt: 2 }}>{uploadError}</Alert>}
      {staged && (
        <StagedFile
          staged={staged}
          setStaged={setStaged}
          uploading={uploading}
          progress={progress}
          error={uploadError}
          onUpload={handleUpload}
          onCancel={() => { setStaged(null); setUploadError(''); }}
        />
      )}

      <Typography variant="h6" component="h2" sx={{ mt: 4, mb: 2 }}>
        Your resumes{!loading && total > 0 ? ` (${total})` : ''}
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => load(page)}>Retry</Button>}>
          {loadError}
        </Alert>
      )}

      {loading ? (
        <Stack spacing={2}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={76} />)}</Stack>
      ) : !loadError && items.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <DescriptionOutlinedIcon color="disabled" sx={{ fontSize: 48 }} />
            <Typography variant="h6">No resumes yet</Typography>
            <Typography color="text.secondary">Upload a PDF or DOCX file above to get started.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {items.map((resume) => (
            <ResumeRow
              key={resume.id}
              resume={resume}
              onView={(r) => setViewId(r.id)}
              onRename={setRenameTarget}
              onDownload={handleDownload}
              onDelete={setDeleteTarget}
              downloading={downloadingId === resume.id}
            />
          ))}
          {totalPages > 1 && (
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              sx={{ alignSelf: 'center', mt: 1 }}
            />
          )}
        </Stack>
      )}

      {viewId && <ResumeDetailDialog resumeId={viewId} onClose={() => setViewId(null)} />}
      {renameTarget && (
        <RenameDialog
          resume={renameTarget}
          onClose={() => setRenameTarget(null)}
          onSaved={() => { setRenameTarget(null); load(page); }}
        />
      )}
      {deleteTarget && (
        <DeleteDialog
          resume={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => { setDeleteTarget(null); load(page); }}
        />
      )}
    </Box>
  );
}

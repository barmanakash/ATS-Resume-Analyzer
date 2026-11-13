import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  LinearProgress, Radio, RadioGroup, Skeleton, Step, StepLabel, Stepper, Stack, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import analysisService from '../../services/analysisService';
import jobService from '../../services/jobService';
import resumeService from '../../services/resumeService';
import { getErrorMessage } from '../../services/apiClient';
import { ROUTES, analysisPath } from '../../config';
import { formatDate } from '../../utils/analysis';
import { defaultResumeName, formatBytes, validateResumeFile } from '../../utils/resumeFile';
import UploadDropzone from '../resumes/UploadDropzone';
import JobFormDialog from '../jobs/JobFormDialog';

const STEPS = ['Choose resume', 'Choose job description', 'Confirm', 'Analyze'];
const LIST_SIZE = 100; // the API's maximum page size
const EMPTY_LIST = { items: [], total: 0, loading: true, error: '' };

/** One selectable card per item. A radio group gives keyboard and screen-reader support for free. */
function ChoiceList({ label, items, value, onChange, renderItem }) {
  return (
    <RadioGroup aria-label={label} value={value || ''} onChange={(event) => onChange(event.target.value)}>
      <Stack spacing={1.5}>
        {items.map((item) => {
          const { primary, secondary, extra, chip, disabled } = renderItem(item);
          const selected = item.id === value;
          return (
            <Card
              key={item.id}
              variant="outlined"
              sx={{ borderColor: selected ? 'primary.main' : 'divider', borderWidth: selected ? 2 : 1, opacity: disabled ? 0.6 : 1 }}
            >
              <FormControlLabel
                value={item.id}
                disabled={disabled}
                control={<Radio />}
                sx={{ m: 0, p: 1.5, width: '100%', alignItems: 'flex-start' }}
                label={(
                  <Box sx={{ minWidth: 0, pt: 0.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{primary}</Typography>
                      {chip}
                    </Stack>
                    {secondary && <Typography variant="body2" color="text.secondary">{secondary}</Typography>}
                    {extra && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mt: 0.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {extra}
                      </Typography>
                    )}
                  </Box>
                )}
              />
            </Card>
          );
        })}
      </Stack>
    </RadioGroup>
  );
}

function ListState({ list, onRetry, empty, children }) {
  if (list.loading) {
    return <Stack spacing={1.5}>{[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={72} />)}</Stack>;
  }
  if (list.error) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>
        {list.error}
      </Alert>
    );
  }
  if (list.items.length === 0) return empty;
  return children;
}

function UploadResumeDialog({ onClose, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const processing = uploading && progress >= 100;

  const handleFiles = async (files) => {
    setError('');
    if (files.length > 1) { setError('Upload one resume at a time.'); return; }
    const file = files[0];
    const problem = validateResumeFile(file);
    if (problem) { setError(problem); return; }
    setUploading(true);
    setProgress(0);
    try {
      const resume = await resumeService.upload(file, defaultResumeName(file.name), setProgress);
      onUploaded(resume); // the parent closes this dialog
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed. Please try again.'));
      setUploading(false);
    }
  };

  return (
    <Dialog open onClose={uploading ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="upload-resume-title">
      <DialogTitle id="upload-resume-title">Upload a new resume</DialogTitle>
      <DialogContent>
        <UploadDropzone onFile={handleFiles} disabled={uploading} />
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {uploading && (
          <Box sx={{ mt: 2 }} role="status">
            <LinearProgress variant={processing ? 'indeterminate' : 'determinate'} value={progress} aria-label={processing ? 'Reading your document' : 'Upload progress'} />
            <Typography variant="caption" color="text.secondary">
              {processing ? 'Reading your document…' : `Uploading… ${progress}%`}
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

function SummaryCard({ icon, title, primary, lines }) {
  return (
    <Card variant="outlined" sx={{ flex: 1 }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          {icon}
          <Typography variant="overline" color="text.secondary">{title}</Typography>
        </Stack>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{primary}</Typography>
        {lines.filter(Boolean).map((line) => (
          <Typography key={line} variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{line}</Typography>
        ))}
      </CardContent>
    </Card>
  );
}

export default function NewAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetResumeId = searchParams.get('resumeId');
  const presetJobId = searchParams.get('jobId');

  const [resumes, setResumes] = useState(EMPTY_LIST);
  const [jobs, setJobs] = useState(EMPTY_LIST);
  const [resumeId, setResumeId] = useState('');
  const [jobId, setJobId] = useState('');
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const initialised = useRef(false);

  const loadResumes = useCallback(async () => {
    setResumes((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const { items, total } = await resumeService.list(1, LIST_SIZE);
      setResumes({ items, total, loading: false, error: '' });
      return items;
    } catch (err) {
      setResumes({ items: [], total: 0, loading: false, error: getErrorMessage(err, 'Could not load your resumes.') });
      return [];
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setJobs((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const { items, total } = await jobService.list(1, LIST_SIZE);
      setJobs({ items, total, loading: false, error: '' });
      return items;
    } catch (err) {
      setJobs({ items: [], total: 0, loading: false, error: getErrorMessage(err, 'Could not load your job descriptions.') });
      return [];
    }
  }, []);

  useEffect(() => { loadResumes(); loadJobs(); }, [loadResumes, loadJobs]);

  // Links such as "Analyze" on a resume pre-select it and skip ahead. Runs once, after both lists have loaded.
  useEffect(() => {
    if (initialised.current || resumes.loading || jobs.loading) return;
    initialised.current = true;
    const presetResume = resumes.items.find((r) => r.id === presetResumeId && r.processingStatus !== 'FAILED');
    const presetJob = jobs.items.find((j) => j.id === presetJobId);
    if (presetResume) setResumeId(presetResume.id);
    if (presetJob) setJobId(presetJob.id);
    setStep(presetResume && presetJob ? 2 : presetResume ? 1 : 0);
  }, [resumes, jobs, presetResumeId, presetJobId]);

  const selectedResume = resumes.items.find((r) => r.id === resumeId);
  const selectedJob = jobs.items.find((j) => j.id === jobId);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setRunError('');
    try {
      const report = await analysisService.create(resumeId, jobId);
      navigate(analysisPath(report.id));
    } catch (err) {
      setRunError(getErrorMessage(err, 'The analysis could not be completed. Please try again.'));
      setRunning(false);
    }
  };

  const startAnalysis = () => {
    setStep(3);
    run();
  };

  const handleResumeUploaded = (resume) => {
    setUploadOpen(false);
    setResumes((prev) => ({ ...prev, items: [resume, ...prev.items], total: prev.total + 1 }));
    setResumeId(resume.id);
  };

  const handleJobSaved = async () => {
    setJobDialogOpen(false);
    const items = await loadJobs();
    if (items[0]) setJobId(items[0].id); // newest first, so this is the one just added
  };

  const truncatedNote = (list, noun) => (list.total > list.items.length ? (
    <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
      Showing your {list.items.length} most recent {noun}. Manage older ones from the sidebar.
    </Typography>
  ) : null);

  return (
    <Box>
      <Typography variant="h4" component="h1">New analysis</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Compare one of your resumes with a job description to see how well they match.
      </Typography>

      <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {step === 0 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" component="h2">Which resume do you want to analyze?</Typography>
            <Button startIcon={<AddIcon />} onClick={() => setUploadOpen(true)}>Upload new resume</Button>
          </Stack>
          <ListState
            list={resumes}
            onRetry={loadResumes}
            empty={(
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 5 }}>
                  <DescriptionOutlinedIcon color="disabled" sx={{ fontSize: 48 }} />
                  <Typography variant="h6">You have no resumes yet</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>Upload a PDF or DOCX file to get started.</Typography>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setUploadOpen(true)}>Upload a resume</Button>
                </CardContent>
              </Card>
            )}
          >
            <ChoiceList
              label="Resumes"
              items={resumes.items}
              value={resumeId}
              onChange={setResumeId}
              renderItem={(r) => ({
                primary: r.displayName,
                secondary: [r.originalFileName, formatBytes(r.fileSize), `Uploaded ${formatDate(r.createdAt)}`].filter(Boolean).join(' · '),
                chip: r.processingStatus === 'FAILED'
                  ? <Chip size="small" color="error" label="Could not be read" />
                  : <Chip size="small" variant="outlined" label={(r.fileType || '').toUpperCase()} />,
                disabled: r.processingStatus === 'FAILED',
              })}
            />
            {truncatedNote(resumes, 'resumes')}
          </ListState>
        </Box>
      )}

      {step === 1 && (
        <Box>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6" component="h2">Which job are you applying for?</Typography>
            <Button startIcon={<AddIcon />} onClick={() => setJobDialogOpen(true)}>Add job description</Button>
          </Stack>
          <ListState
            list={jobs}
            onRetry={loadJobs}
            empty={(
              <Card variant="outlined">
                <CardContent sx={{ textAlign: 'center', py: 5 }}>
                  <WorkOutlineIcon color="disabled" sx={{ fontSize: 48 }} />
                  <Typography variant="h6">You have no job descriptions yet</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>Paste a job posting to compare your resume with it.</Typography>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setJobDialogOpen(true)}>Add a job description</Button>
                </CardContent>
              </Card>
            )}
          >
            <ChoiceList
              label="Job descriptions"
              items={jobs.items}
              value={jobId}
              onChange={setJobId}
              renderItem={(j) => ({
                primary: j.jobTitle,
                secondary: [j.companyName, `Added ${formatDate(j.createdAt)}`].filter(Boolean).join(' · '),
                extra: j.descriptionPreview,
              })}
            />
            {truncatedNote(jobs, 'job descriptions')}
          </ListState>
        </Box>
      )}

      {step === 2 && selectedResume && selectedJob && (
        <Box>
          <Typography variant="h6" component="h2" sx={{ mb: 2 }}>Check your selection</Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <SummaryCard
              icon={<DescriptionOutlinedIcon color="primary" />}
              title="Resume"
              primary={selectedResume.displayName}
              lines={[selectedResume.originalFileName, `Uploaded ${formatDate(selectedResume.createdAt)}`]}
            />
            <SummaryCard
              icon={<WorkOutlineIcon color="primary" />}
              title="Job description"
              primary={selectedJob.jobTitle}
              lines={[selectedJob.companyName, selectedJob.descriptionPreview]}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            The score is an estimate of how well your resume matches this job description. It does not predict whether any
            employer&apos;s system will select you.
          </Typography>
        </Box>
      )}

      {step === 3 && (
        <Card variant="outlined">
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            {runError ? (
              <>
                <Alert severity="error" sx={{ textAlign: 'left', mb: 3 }}>{runError}</Alert>
                <Stack direction="row" spacing={1} justifyContent="center">
                  <Button variant="contained" onClick={run}>Try again</Button>
                  <Button onClick={() => setStep(2)}>Back</Button>
                </Stack>
              </>
            ) : (
              <Box role="status">
                <Typography variant="h6" gutterBottom>Analyzing your resume…</Typography>
                <Typography color="text.secondary" sx={{ mb: 3 }}>
                  Matching your resume with the job requirements. This usually takes a few seconds.
                </Typography>
                <LinearProgress aria-label="Analysis in progress" sx={{ maxWidth: 420, mx: 'auto' }} />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {step < 3 && (
        <Stack direction="row" spacing={1} justifyContent="space-between" sx={{ mt: 4 }}>
          {step === 0 ? (
            <Button component={RouterLink} to={ROUTES.dashboard}>Cancel</Button>
          ) : (
            <Button onClick={() => setStep((s) => s - 1)}>Back</Button>
          )}
          {step < 2 ? (
            <Button variant="contained" onClick={() => setStep((s) => s + 1)} disabled={step === 0 ? !resumeId : !jobId}>
              Next
            </Button>
          ) : (
            <Button variant="contained" onClick={startAnalysis} disabled={!selectedResume || !selectedJob}>
              Run analysis
            </Button>
          )}
        </Stack>
      )}

      {uploadOpen && <UploadResumeDialog onClose={() => setUploadOpen(false)} onUploaded={handleResumeUploaded} />}
      {jobDialogOpen && <JobFormDialog onClose={() => setJobDialogOpen(false)} onSaved={handleJobSaved} />}
    </Box>
  );
}

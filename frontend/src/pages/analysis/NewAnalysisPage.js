import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, LinearProgress, Skeleton, Stack, Step, StepLabel, Stepper, TextField, ToggleButton,
  ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import resumeService from '../../services/resumeService';
import jobService from '../../services/jobService';
import analysisService from '../../services/analysisService';
import { getErrorMessage } from '../../services/apiClient';
import { JOB_DESCRIPTION_MAX_CHARS, ROUTES } from '../../config';
import { jobSchema } from '../jobs/jobSchema';
import { formatBytes } from '../../utils/resumeFile';
import UploadResumeDialog from './UploadResumeDialog';

const STEPS = ['Choose resume', 'Choose job description', 'Confirm', 'Analyze'];

const LIST_SIZE = 100; // the largest page the API allows

function SelectedCard({ icon, title, lines }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          {icon}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>{title}</Typography>
            {lines.filter(Boolean).map((line) => (
              <Typography key={line} variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{line}</Typography>
            ))}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function NewAnalysisPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [resumes, setResumes] = useState([]);
  const [resumeTotal, setResumeTotal] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [jobTotal, setJobTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [resumeId, setResumeId] = useState('');
  const [jobMode, setJobMode] = useState('saved');
  const [jobId, setJobId] = useState('');
  const [newJob, setNewJob] = useState({ jobTitle: '', companyName: '', description: '' });
  const [fieldErrors, setFieldErrors] = useState({});

  const [stage, setStage] = useState(''); // '', 'saving', 'analyzing'
  const [error, setError] = useState('');
  const [createdJobId, setCreatedJobId] = useState(''); // reused if the analysis fails after the job was saved
  const [confirming, setConfirming] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [resumeResult, jobResult] = await Promise.all([resumeService.list(1, LIST_SIZE), jobService.list(1, LIST_SIZE)]);
      const usable = resumeResult.items.filter((r) => r.processingStatus !== 'FAILED');
      setResumes(usable);
      setResumeTotal(resumeResult.total);
      setJobs(jobResult.items);
      setJobTotal(jobResult.total);

      // Pre-select from the link the user came from (the Analyze buttons on the resume and job pages).
      const wantedResume = params.get('resumeId');
      const wantedJob = params.get('jobId');
      if (wantedResume && usable.some((r) => r.id === wantedResume)) setResumeId(wantedResume);
      else if (usable.length === 1) setResumeId(usable[0].id);
      if (wantedJob && jobResult.items.some((j) => j.id === wantedJob)) {
        setJobId(wantedJob);
        setJobMode('saved');
      } else if (jobResult.items.length === 0) {
        setJobMode('new');
      }
    } catch (err) {
      setLoadError(getErrorMessage(err, 'Could not load your resumes and job descriptions.'));
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const resume = useMemo(() => resumes.find((r) => r.id === resumeId), [resumes, resumeId]);
  const job = useMemo(() => jobs.find((j) => j.id === jobId), [jobs, jobId]);
  const busy = Boolean(stage);
  const locked = busy || confirming; // the selection cannot change while it is being confirmed or run
  const activeStep = busy ? 3 : confirming ? 2 : resumeId ? 1 : 0;
  const confirmJobTitle = jobMode === 'saved' ? job?.jobTitle : newJob.jobTitle.trim();

  const setField = (field) => (event) => {
    setNewJob({ ...newJob, [field]: event.target.value });
    if (fieldErrors[field]) setFieldErrors({ ...fieldErrors, [field]: undefined });
  };

  const handleUploaded = (uploaded) => {
    setUploadOpen(false);
    setResumes((prev) => [uploaded, ...prev]);
    setResumeTotal((count) => count + 1);
    setResumeId(uploaded.id);
    setError('');
  };

  const start = async (confirmed = false) => {
    setError('');
    if (!resumeId) { setError('Choose a resume to analyze.'); return; }

    let targetJobId = jobId;
    let toSave = null;
    if (jobMode === 'saved') {
      if (!jobId) { setError('Choose a job description, or switch to "New job" to paste one.'); return; }
    } else if (!createdJobId) {
      const parsed = jobSchema.safeParse(newJob);
      if (!parsed.success) {
        const errors = {};
        parsed.error.issues.forEach((issue) => { if (!errors[issue.path[0]]) errors[issue.path[0]] = issue.message; });
        setFieldErrors(errors);
        return;
      }
      toSave = parsed.data;
    } else {
      targetJobId = createdJobId;
    }

    if (!confirmed) {
      setConfirming(true); // step 3: show what will be analyzed and ask the user to confirm
      return;
    }

    try {
      if (toSave) {
        setStage('saving');
        const saved = await jobService.create(toSave);
        targetJobId = saved.id;
        setCreatedJobId(saved.id);
      }
      setStage('analyzing');
      const report = await analysisService.create(resumeId, targetJobId);
      navigate(ROUTES.analysisDetail(report.id));
    } catch (err) {
      setError(getErrorMessage(err, 'The analysis could not be completed. Please try again.'));
      setStage('');
    }
  };

  if (loading) {
    return (
      <Box>
        <Typography variant="h4" component="h1" sx={{ mb: 3 }}>New analysis</Typography>
        <Stack spacing={2}><Skeleton variant="rounded" height={56} /><Skeleton variant="rounded" height={56} /><Skeleton variant="rounded" height={160} /></Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h4" component="h1">New analysis</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Compare one of your resumes with a job description to see how well they match.
      </Typography>

      {!loadError && resumes.length > 0 && (
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
        </Stepper>
      )}

      {loadError && (
        <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>{loadError}</Alert>
      )}

      {!loadError && resumes.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <DescriptionOutlinedIcon color="disabled" sx={{ fontSize: 48 }} />
            <Typography variant="h6">Upload a resume first</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>You need at least one resume to run an analysis.</Typography>
            <Button variant="contained" onClick={() => setUploadOpen(true)}>Upload a resume</Button>
          </CardContent>
        </Card>
      ) : !loadError && (
        <Stack spacing={4}>
          <Box component="section" aria-labelledby="step-resume">
            <Typography id="step-resume" variant="h6" component="h2" sx={{ mb: 1.5 }}>1. Choose a resume</Typography>
            <TextField
              select
              fullWidth
              label="Resume"
              value={resumeId}
              onChange={(e) => { setResumeId(e.target.value); setError(''); }}
              disabled={locked}
              SelectProps={{ native: true }}
              InputLabelProps={{ shrink: true }}
              helperText={resumeTotal > resumes.length ? `Showing your ${resumes.length} most recent resumes.` : undefined}
            >
              <option value="">Select a resume</option>
              {resumes.map((r) => <option key={r.id} value={r.id}>{r.displayName}</option>)}
            </TextField>
            <Button startIcon={<AddIcon />} onClick={() => setUploadOpen(true)} disabled={locked} sx={{ mt: 1 }}>
              Upload a new resume
            </Button>
            {resume && (
              <Box sx={{ mt: 2 }}>
                <SelectedCard
                  icon={<DescriptionOutlinedIcon color="primary" />}
                  title={resume.displayName}
                  lines={[`${resume.originalFileName} · ${formatBytes(resume.fileSize)}`]}
                />
              </Box>
            )}
          </Box>

          <Box component="section" aria-labelledby="step-job">
            <Typography id="step-job" variant="h6" component="h2" sx={{ mb: 1.5 }}>2. Choose a job description</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={jobMode}
              onChange={(_, value) => { if (value) { setJobMode(value); setError(''); } }}
              disabled={locked}
              aria-label="Job description source"
              sx={{ mb: 2 }}
            >
              <ToggleButton value="saved" disabled={jobs.length === 0}>Saved job</ToggleButton>
              <ToggleButton value="new">New job</ToggleButton>
            </ToggleButtonGroup>

            {jobMode === 'saved' ? (
              <>
                <TextField
                  select
                  fullWidth
                  label="Saved job description"
                  value={jobId}
                  onChange={(e) => { setJobId(e.target.value); setError(''); }}
                  disabled={locked}
                  SelectProps={{ native: true }}
                  InputLabelProps={{ shrink: true }}
                  helperText={jobTotal > jobs.length ? `Showing your ${jobs.length} most recent job descriptions.` : undefined}
                >
                  <option value="">Select a job description</option>
                  {jobs.map((j) => <option key={j.id} value={j.id}>{j.companyName ? `${j.jobTitle} · ${j.companyName}` : j.jobTitle}</option>)}
                </TextField>
                {job && (
                  <Box sx={{ mt: 2 }}>
                    <SelectedCard
                      icon={<WorkOutlineIcon color="primary" />}
                      title={job.jobTitle}
                      lines={[job.companyName, job.descriptionPreview]}
                    />
                  </Box>
                )}
              </>
            ) : (
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Job title" required fullWidth value={newJob.jobTitle} onChange={setField('jobTitle')} disabled={locked || Boolean(createdJobId)}
                    error={Boolean(fieldErrors.jobTitle)} helperText={fieldErrors.jobTitle} inputProps={{ maxLength: 200 }}
                  />
                  <TextField
                    label="Company name" fullWidth value={newJob.companyName} onChange={setField('companyName')} disabled={locked || Boolean(createdJobId)}
                    error={Boolean(fieldErrors.companyName)} helperText={fieldErrors.companyName || 'Optional'} inputProps={{ maxLength: 200 }}
                  />
                </Stack>
                <TextField
                  label="Job description" required multiline minRows={8} maxRows={16} fullWidth value={newJob.description}
                  onChange={setField('description')} disabled={locked || Boolean(createdJobId)}
                  error={Boolean(fieldErrors.description)}
                  helperText={fieldErrors.description || `${newJob.description.length.toLocaleString('en-US')} / ${JOB_DESCRIPTION_MAX_CHARS.toLocaleString('en-US')} characters. It is saved to your job descriptions.`}
                />
                {createdJobId && <Alert severity="info">This job description was saved. Retrying will reuse it.</Alert>}
              </Stack>
            )}
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {busy && (
            <Box role="status">
              <LinearProgress aria-label="Analysis in progress" />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {stage === 'saving' ? 'Saving your job description…' : 'Analyzing your resume against the job description…'}
              </Typography>
            </Box>
          )}

          {confirming ? (
            <Card variant="outlined" component="section" aria-labelledby="step-confirm">
              <CardContent>
                <Typography id="step-confirm" variant="h6" component="h2" sx={{ mb: 1.5 }}>3. Confirm</Typography>
                <Typography sx={{ mb: 1 }}>
                  Analyze <strong>{resume?.displayName}</strong> against <strong>{confirmJobTitle || 'the new job description'}</strong>?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  The score is an estimate of how well your resume matches this job description. It does not predict whether
                  any employer&apos;s system will select you.
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="large" startIcon={<PlayArrowIcon />} onClick={() => start(true)} disabled={busy}>
                    Run analysis
                  </Button>
                  <Button onClick={() => { setConfirming(false); setError(''); }} disabled={busy}>Back</Button>
                </Stack>
              </CardContent>
            </Card>
          ) : (
            <Box>
              <Button variant="contained" size="large" onClick={() => start(false)} disabled={busy}>
                Continue
              </Button>
            </Box>
          )}
        </Stack>
      )}

      {uploadOpen && <UploadResumeDialog onClose={() => setUploadOpen(false)} onUploaded={handleUploaded} />}
    </Box>
  );
}

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, FormControlLabel, LinearProgress, Radio, RadioGroup, Skeleton, Stack,
  Step, StepLabel, Stepper, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import analysisService from '../../services/analysisService';
import jobService from '../../services/jobService';
import resumeService from '../../services/resumeService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { analysisPath } from '../../config';
import { defaultResumeName, formatBytes, validateResumeFile } from '../../utils/resumeFile';
import { formatDate } from '../../utils/analysis';
import UploadDropzone from '../resumes/UploadDropzone';
import JobFormDialog from '../jobs/JobFormDialog';

const STEPS = ['Select resume', 'Select job', 'Confirm', 'Analyze'];
const NOT_READY = ['FAILED', 'PENDING', 'PROCESSING'];

const resumeStatus = (resume) => String(resume?.processingStatus || resume?.status || 'COMPLETED').toUpperCase();
const isReady = (resume) => !NOT_READY.includes(resumeStatus(resume));
const resumeTitle = (resume) => resume?.displayName || resume?.originalFileName || 'Untitled resume';

function OptionCard({ value, selected, disabled, title, subtitle, chip }) {
  return (
    <Card
      variant="outlined"
      sx={{ borderColor: selected ? 'primary.main' : 'divider', borderWidth: selected ? 2 : 1, opacity: disabled ? 0.65 : 1 }}
    >
      <FormControlLabel
        value={value}
        disabled={disabled}
        control={<Radio />}
        sx={{ m: 0, p: 1, width: '100%', alignItems: 'flex-start' }}
        label={(
          <Box sx={{ pt: 0.5 }}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Typography fontWeight={600}>{title}</Typography>
              {chip}
            </Stack>
            {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
          </Box>
        )}
      />
    </Card>
  );
}

export default function NewAnalysisPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { success } = useNotification();

  const [resumes, setResumes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [resumeId, setResumeId] = useState('');
  const [jobId, setJobId] = useState('');
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [showJobDialog, setShowJobDialog] = useState(false);
  const [runError, setRunError] = useState('');

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const wantedResume = params.get('resumeId');
  const wantedJob = params.get('jobId');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [resumeData, jobData] = await Promise.all([resumeService.list(1, 100), jobService.list(1, 100)]);
      if (!mounted.current) return;
      setResumes(resumeData.items);
      setJobs(jobData.items);
      // Links from the resume and job pages preselect items, so skip the steps that are already answered.
      const preResume = resumeData.items.find((r) => r.id === wantedResume && isReady(r));
      const preJob = jobData.items.find((j) => j.id === wantedJob);
      if (preResume) setResumeId(preResume.id);
      if (preJob) setJobId(preJob.id);
      setStep(preResume && preJob ? 2 : preResume ? 1 : 0);
    } catch (err) {
      if (mounted.current) setLoadError(getErrorMessage(err, 'Could not load your resumes and job descriptions.'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [wantedResume, wantedJob]);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (files) => {
    if (files.length > 1) { setUploadError('Upload one resume at a time.'); return; }
    const file = files[0];
    const problem = validateResumeFile(file);
    if (problem) { setUploadError(problem); return; }

    setUploadError('');
    setUploading(true);
    setUploadProgress(0);
    try {
      const created = await resumeService.upload(file, defaultResumeName(file.name), setUploadProgress);
      if (!mounted.current) return;
      setResumes((prev) => [created, ...prev]);
      if (isReady(created)) {
        setResumeId(created.id);
        success('Resume uploaded.');
      } else {
        setUploadError('We could not read text from this file. Try a different version of the resume.');
      }
    } catch (err) {
      if (mounted.current) setUploadError(getErrorMessage(err, 'Could not upload this resume. Please try again.'));
    } finally {
      if (mounted.current) setUploading(false);
    }
  };

  const handleJobSaved = async () => {
    setShowJobDialog(false);
    try {
      const data = await jobService.list(1, 100);
      if (!mounted.current) return;
      setJobs(data.items);
      if (data.items[0]) setJobId(data.items[0].id); // lists are newest first, so this is the one just added
    } catch (err) {
      if (mounted.current) setLoadError(getErrorMessage(err, 'Could not refresh your job descriptions.'));
    }
  };

  const start = async () => {
    setRunError('');
    setStep(3);
    try {
      const report = await analysisService.create(resumeId, jobId);
      if (mounted.current) navigate(analysisPath(report.id), { replace: true });
    } catch (err) {
      if (mounted.current) setRunError(getErrorMessage(err, 'The analysis could not be completed. Please try again.'));
    }
  };

  const selectedResume = resumes.find((r) => r.id === resumeId);
  const selectedJob = jobs.find((j) => j.id === jobId);

  return (
    <Box>
      <Typography variant="h4" component="h1">New analysis</Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Compare one of your resumes with a job description to see how well they match.
      </Typography>

      <Stepper activeStep={step} alternativeLabel sx={{ mb: 4 }}>
        {STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}
      </Stepper>

      {loadError && (
        <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {loadError}
        </Alert>
      )}

      {loading ? (
        <Stack spacing={1.5}><Skeleton variant="rounded" height={64} /><Skeleton variant="rounded" height={64} /><Skeleton variant="rounded" height={64} /></Stack>
      ) : (
        <>
          {/* Step 1: resume */}
          {step === 0 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="h6" component="h2" gutterBottom>Choose a resume</Typography>
                {resumes.length === 0 ? (
                  <Typography color="text.secondary">You have not uploaded a resume yet. Upload one below.</Typography>
                ) : (
                  <RadioGroup name="resume" value={resumeId} onChange={(e) => setResumeId(e.target.value)} aria-label="Resume">
                    <Stack spacing={1} sx={{ maxHeight: 360, overflowY: 'auto', pr: 0.5 }}>
                      {resumes.map((resume) => (
                        <OptionCard
                          key={resume.id}
                          value={resume.id}
                          selected={resume.id === resumeId}
                          disabled={!isReady(resume)}
                          title={resumeTitle(resume)}
                          subtitle={[(resume.fileType || '').toUpperCase(), formatBytes(resume.fileSize), `Uploaded ${formatDate(resume.createdAt)}`].filter(Boolean).join(' · ')}
                          chip={!isReady(resume) ? <Chip size="small" color={resumeStatus(resume) === 'FAILED' ? 'error' : 'default'} label={resumeStatus(resume) === 'FAILED' ? 'Could not be read' : 'Processing'} /> : null}
                        />
                      ))}
                    </Stack>
                  </RadioGroup>
                )}
              </Box>
              <Box>
                <Typography variant="h6" component="h2" gutterBottom>{resumes.length ? 'Or upload a new resume' : 'Upload a resume'}</Typography>
                <UploadDropzone onFile={handleFiles} disabled={uploading} />
                {uploading && (
                  <Box sx={{ mt: 2 }} role="status">
                    <Typography variant="body2" color="text.secondary">
                      {uploadProgress < 100 ? `Uploading… ${uploadProgress}%` : 'Reading your resume…'}
                    </Typography>
                    <LinearProgress
                      variant={uploadProgress < 100 ? 'determinate' : 'indeterminate'}
                      value={uploadProgress}
                      aria-label="Upload progress"
                      sx={{ mt: 0.5, borderRadius: 4 }}
                    />
                  </Box>
                )}
                {uploadError && <Alert severity="error" sx={{ mt: 2 }} onClose={() => setUploadError('')}>{uploadError}</Alert>}
              </Box>
              <Stack direction="row" justifyContent="flex-end">
                <Button variant="contained" disabled={!resumeId || uploading} onClick={() => setStep(1)}>Next</Button>
              </Stack>
            </Stack>
          )}

          {/* Step 2: job description */}
          {step === 1 && (
            <Stack spacing={3}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" component="h2">Choose a job description</Typography>
                  <Button startIcon={<AddIcon />} onClick={() => setShowJobDialog(true)}>Add new</Button>
                </Stack>
                {jobs.length === 0 ? (
                  <Alert severity="info" action={<Button color="inherit" size="small" onClick={() => setShowJobDialog(true)}>Add job description</Button>}>
                    You have not saved a job description yet. Paste the one you are applying for.
                  </Alert>
                ) : (
                  <RadioGroup name="job" value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Job description">
                    <Stack spacing={1} sx={{ maxHeight: 420, overflowY: 'auto', pr: 0.5 }}>
                      {jobs.map((job) => (
                        <OptionCard
                          key={job.id}
                          value={job.id}
                          selected={job.id === jobId}
                          title={job.jobTitle || 'Untitled job'}
                          subtitle={[job.companyName, `Saved ${formatDate(job.createdAt)}`].filter(Boolean).join(' · ')}
                        />
                      ))}
                    </Stack>
                  </RadioGroup>
                )}
              </Box>
              <Stack direction="row" justifyContent="space-between">
                <Button onClick={() => setStep(0)}>Back</Button>
                <Button variant="contained" disabled={!jobId} onClick={() => setStep(2)}>Next</Button>
              </Stack>
            </Stack>
          )}

          {/* Step 3: confirm */}
          {step === 2 && (
            <Stack spacing={3}>
              <Typography variant="h6" component="h2">Confirm your selection</Typography>
              <Card>
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Resume</Typography>
                      <Typography fontWeight={600}>{selectedResume ? resumeTitle(selectedResume) : 'Not selected'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Job</Typography>
                      <Typography fontWeight={600}>
                        {selectedJob ? [selectedJob.jobTitle, selectedJob.companyName].filter(Boolean).join(' at ') : 'Not selected'}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
              <Typography variant="body2" color="text.secondary">
                Your resume text is compared with the job description on our server. The result is an estimate to help you improve your resume, not a guarantee.
              </Typography>
              <Stack direction="row" justifyContent="space-between">
                <Button onClick={() => setStep(1)}>Back</Button>
                <Button variant="contained" size="large" disabled={!selectedResume || !selectedJob} onClick={start}>Start analysis</Button>
              </Stack>
            </Stack>
          )}

          {/* Step 4: running */}
          {step === 3 && (
            <Card>
              <CardContent sx={{ py: 6, textAlign: 'center' }}>
                {runError ? (
                  <Stack spacing={2} alignItems="center">
                    <Alert severity="error" sx={{ width: '100%', textAlign: 'left' }}>{runError}</Alert>
                    <Stack direction="row" spacing={1}>
                      <Button onClick={() => setStep(2)}>Back</Button>
                      <Button variant="contained" onClick={start}>Try again</Button>
                    </Stack>
                  </Stack>
                ) : (
                  <Box role="status">
                    <Typography variant="h6" gutterBottom>Analyzing your resume…</Typography>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                      Comparing it with the job description. This usually takes a few seconds.
                    </Typography>
                    <LinearProgress aria-label="Analysis in progress" sx={{ maxWidth: 420, mx: 'auto', borderRadius: 4 }} />
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {showJobDialog && <JobFormDialog onClose={() => setShowJobDialog(false)} onSaved={handleJobSaved} />}
    </Box>
  );
}

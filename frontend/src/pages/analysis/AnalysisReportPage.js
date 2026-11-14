import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Skeleton, Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import analysisService from '../../services/analysisService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../config';
import { formatDate } from '../../utils/analysis';
import {
  AnalysisNote, CategoryBreakdown, ExperienceEducation, KeywordRelevance, MandatoryGaps, Recommendations,
  ReportWarnings, RequirementsSection, ScoreHero, SkillsOverview, StructureChecklist,
} from './ReportSections';

function ReportSkeleton() {
  return (
    <Stack spacing={3} aria-busy="true" aria-label="Loading report">
      <Skeleton variant="rounded" height={210} />
      <Skeleton variant="rounded" height={80} />
      <Skeleton variant="rounded" height={320} />
    </Stack>
  );
}

export default function AnalysisReportPage() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const { success, error: notifyError } = useNotification();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReport(await analysisService.get(analysisId));
    } catch (err) {
      setReport(null);
      setError(getErrorMessage(err, 'Could not load this report.'));
    } finally {
      setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await analysisService.remove(analysisId);
      success('Analysis deleted.');
      navigate(ROUTES.dashboard, { replace: true });
    } catch (err) {
      notifyError(getErrorMessage(err, 'Could not delete this analysis. Please try again.'));
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  const rerunLink = report?.resumeId && report?.jobDescriptionId
    ? `${ROUTES.newAnalysis}?resumeId=${encodeURIComponent(report.resumeId)}&jobId=${encodeURIComponent(report.jobDescriptionId)}`
    : ROUTES.newAnalysis;

  const categories = report?.categoryScores || [];
  const structureCategory = categories.find((c) => c.key === 'structure');

  return (
    <Box>
      <Button component={RouterLink} to={ROUTES.history} startIcon={<ArrowBackIcon />} sx={{ mb: 1 }}>
        All analyses
      </Button>

      {loading && <ReportSkeleton />}

      {!loading && error && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={load}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {!loading && report && (
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography variant="h4" component="h1">{report.jobTitle || 'Untitled job'}</Typography>
              <Typography color="text.secondary">
                {[report.companyName, report.resumeName, formatDate(report.completedAt || report.createdAt)]
                  .filter(Boolean)
                  .join(' · ')}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Button component={RouterLink} to={rerunLink} variant="outlined" startIcon={<AddIcon />}>
                Analyze again
              </Button>
              <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmOpen(true)}>
                Delete
              </Button>
            </Stack>
          </Stack>

          <ScoreHero report={report} />
          <ReportWarnings warnings={report.warnings} />
          {report.mandatoryGaps?.length ? (
            <MandatoryGaps gaps={report.mandatoryGaps} />
          ) : (
            <Alert severity="success">No required items are missing from your resume.</Alert>
          )}
          <CategoryBreakdown categories={categories} />
          <RequirementsSection requirements={report.requirements || []} categories={categories} />
          <SkillsOverview report={report} />
          <ExperienceEducation report={report} />
          <KeywordRelevance report={report} />
          <StructureChecklist checks={report.structureChecks} category={structureCategory} />
          <Recommendations items={report.improvementRecommendations} />
          <AnalysisNote report={report} />
        </Stack>
      )}

      <Dialog open={confirmOpen} onClose={deleting ? undefined : () => setConfirmOpen(false)} aria-labelledby="delete-analysis-title">
        <DialogTitle id="delete-analysis-title">Delete this analysis?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            The report will be permanently deleted. Your resume and job description are not affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

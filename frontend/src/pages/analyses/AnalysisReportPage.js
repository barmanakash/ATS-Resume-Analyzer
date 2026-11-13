import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  Skeleton, Stack, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ReplayIcon from '@mui/icons-material/Replay';
import analysisService from '../../services/analysisService';
import { getErrorMessage } from '../../services/apiClient';
import { useNotification } from '../../context/NotificationContext';
import { ROUTES } from '../../config';
import { formatDate } from '../../utils/analysis';
import {
  AnalysisNote,
  CategoryBreakdown,
  ExperienceEducation,
  KeywordRelevance,
  MandatoryGaps,
  Recommendations,
  ReportWarnings,
  RequirementsSection,
  ScoreHero,
  SkillsOverview,
  StructureChecklist,
} from './ReportSections';

function DeleteAnalysisDialog({ analysisId, onClose, onDeleted }) {
  const { success } = useNotification();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const remove = async () => {
    setDeleting(true);
    setError('');
    try {
      await analysisService.remove(analysisId);
      success('Analysis deleted.');
      onDeleted();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not delete this analysis.'));
      setDeleting(false);
    }
  };

  return (
    <Dialog open onClose={deleting ? undefined : onClose} aria-labelledby="delete-analysis-title">
      <DialogTitle id="delete-analysis-title">Delete this analysis?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This report will be permanently deleted. Your resume and job description are not affected.
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

function ReportSkeleton() {
  return (
    <Stack spacing={3} aria-busy="true" aria-label="Loading report">
      <Skeleton variant="rounded" height={220} />
      <Skeleton variant="rounded" height={260} />
      <Skeleton variant="rounded" height={320} />
    </Stack>
  );
}

export default function AnalysisReportPage() {
  const { analysisId } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async (isCurrent = () => true) => {
    setLoading(true);
    setError(null);
    try {
      const data = await analysisService.get(analysisId);
      if (isCurrent()) setReport(data);
    } catch (err) {
      if (isCurrent()) {
        setReport(null);
        setError({
          notFound: err?.response?.status === 404,
          message: getErrorMessage(err, 'Could not load this report.'),
        });
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [analysisId]);

  useEffect(() => {
    let current = true;
    load(() => current);
    return () => { current = false; };
  }, [load]);

  const backButton = (
    <Button component={RouterLink} to={ROUTES.dashboard} startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
      Back to dashboard
    </Button>
  );

  if (loading) {
    return <Box>{backButton}<ReportSkeleton /></Box>;
  }

  if (error) {
    return (
      <Box>
        {backButton}
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" component="h1" gutterBottom>
              {error.notFound ? 'We could not find this analysis' : 'Could not load this report'}
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {error.notFound
                ? 'It may have been deleted, or the link may be wrong.'
                : error.message}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="center">
              {!error.notFound && <Button variant="contained" onClick={() => load()}>Try again</Button>}
              <Button component={RouterLink} to={ROUTES.newAnalysis} variant={error.notFound ? 'contained' : 'outlined'}>
                Start a new analysis
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const detailed = Array.isArray(report.categoryScores) && report.categoryScores.length > 0;
  const subtitle = [
    report.companyName,
    report.resumeName ? `Resume: ${report.resumeName}` : '',
    formatDate(report.createdAt),
  ].filter(Boolean).join(' · ');
  const rerunPath = `${ROUTES.newAnalysis}?resumeId=${report.resumeId}&jobId=${report.jobDescriptionId}`;
  const structureCategory = report.categoryScores?.find((c) => c.key === 'structure');

  return (
    <Box>
      {backButton}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 3 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h4" component="h1" sx={{ overflowWrap: 'anywhere' }}>
            {report.jobTitle || 'Analysis report'}
          </Typography>
          {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
        </Box>
        <Stack direction="row" spacing={1} alignSelf={{ md: 'flex-start' }} flexShrink={0}>
          <Button component={RouterLink} to={rerunPath} variant="outlined" startIcon={<ReplayIcon />}>
            Run again
          </Button>
          <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />} onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        </Stack>
      </Stack>

      {!detailed ? (
        <Alert severity="info">
          This analysis was created with an older version of the analyzer and has no detailed report
          {typeof report.overallScore === 'number' ? ` (it scored ${Math.round(report.overallScore)} out of 100)` : ''}.
          Run a new analysis to get the full report.
        </Alert>
      ) : (
        <Stack spacing={3}>
          <ScoreHero report={report} />
          <ReportWarnings warnings={report.warnings} />
          <MandatoryGaps gaps={report.mandatoryGaps} />
          <CategoryBreakdown categories={report.categoryScores} />
          <SkillsOverview report={report} />
          <RequirementsSection requirements={report.requirements} categories={report.categoryScores} />
          <ExperienceEducation report={report} />
          <KeywordRelevance report={report} />
          <StructureChecklist checks={report.structureChecks} category={structureCategory} />
          <Recommendations items={report.improvementRecommendations} />
          <AnalysisNote report={report} />
        </Stack>
      )}

      {confirmDelete && (
        <DeleteAnalysisDialog
          analysisId={analysisId}
          onClose={() => setConfirmDelete(false)}
          onDeleted={() => navigate(ROUTES.dashboard)}
        />
      )}
    </Box>
  );
}

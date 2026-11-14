import React from 'react';
import { Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

const CATEGORY_LABELS = {
  terminology: 'Matches job wording',
  skills_order: 'Skill order',
  wording: 'Stronger wording',
  ai_rewrite: 'AI rewrite',
  gap: 'Gap',
  evidence: 'Needs evidence',
};
const EVIDENCE_LABELS = {
  SUPPORTED_BY_RESUME: { label: 'Supported by your resume', color: 'success' },
  WORDING_ONLY: { label: 'Wording only', color: 'info' },
  GAP_NOT_SUPPORTED: { label: 'Not supported by your resume', color: 'warning' },
};

function TextBlock({ title, text, tone }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0, p: 1.5, borderRadius: 1, bgcolor: tone === 'after' ? 'action.selected' : 'action.hover' }}>
      <Typography variant="caption" color="text.secondary">{title}</Typography>
      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{text}</Typography>
    </Box>
  );
}

/** One suggestion. Text changes can be accepted or rejected; gap notes describe a problem and can only be dismissed. */
export default function SuggestionCard({ suggestion, busy, onSet }) {
  const evidence = EVIDENCE_LABELS[suggestion.evidenceStatus];
  const label = suggestion.relatedRequirement || suggestion.category;
  const { applicable, status } = suggestion;

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center" sx={{ mb: 1 }}>
          <Chip size="small" label={CATEGORY_LABELS[suggestion.category] || suggestion.category} />
          {evidence && <Chip size="small" variant="outlined" color={evidence.color} label={evidence.label} />}
          <Chip size="small" variant="outlined" label={suggestion.source === 'ai' ? 'AI' : 'Rules'} />
          {typeof suggestion.confidence === 'number' && (
            <Typography variant="caption" color="text.secondary">Confidence {Math.round(suggestion.confidence * 100)}%</Typography>
          )}
          {suggestion.relatedRequirement && applicable && (
            <Typography variant="caption" color="text.secondary">For: {suggestion.relatedRequirement}</Typography>
          )}
        </Stack>

        {applicable ? (
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
            <TextBlock title="Before" text={suggestion.original} />
            <TextBlock title="After" text={suggestion.proposed} tone="after" />
          </Stack>
        ) : (
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{suggestion.original}</Typography>
        )}

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{suggestion.reason}</Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          {applicable && status === 'PENDING' && (
            <>
              <Button size="small" variant="contained" disabled={busy} onClick={() => onSet(suggestion, 'ACCEPTED')} aria-label={`Accept: ${label}`}>
                Accept
              </Button>
              <Button size="small" variant="outlined" disabled={busy} onClick={() => onSet(suggestion, 'REJECTED')} aria-label={`Reject: ${label}`}>
                Reject
              </Button>
            </>
          )}
          {applicable && status === 'ACCEPTED' && (
            <>
              <Chip size="small" color="success" label="Accepted" />
              <Button size="small" disabled={busy} onClick={() => onSet(suggestion, 'PENDING')} aria-label={`Undo: ${label}`}>Undo</Button>
            </>
          )}
          {applicable && status === 'REJECTED' && (
            <>
              <Chip size="small" label="Rejected" />
              <Button size="small" disabled={busy} onClick={() => onSet(suggestion, 'PENDING')} aria-label={`Reconsider: ${label}`}>Reconsider</Button>
            </>
          )}
          {!applicable && status !== 'REJECTED' && (
            <Button size="small" disabled={busy} onClick={() => onSet(suggestion, 'REJECTED')} aria-label={`Dismiss: ${label}`}>Dismiss</Button>
          )}
          {!applicable && status === 'REJECTED' && (
            <>
              <Chip size="small" label="Dismissed" />
              <Button size="small" disabled={busy} onClick={() => onSet(suggestion, 'PENDING')} aria-label={`Show again: ${label}`}>Show again</Button>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

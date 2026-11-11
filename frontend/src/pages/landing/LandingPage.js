import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, CardContent, Chip, Container, Grid,
  LinearProgress, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PublicNavbar from '../../components/layout/PublicNavbar';
import Footer from '../../components/layout/Footer';
import { ROUTES, TAGLINE } from '../../config';

const FEATURES = [
  { icon: <FactCheckOutlinedIcon />, title: 'Explainable scoring', text: 'See exactly which requirements matched, partially matched, or were not found, with the resume evidence behind each one.' },
  { icon: <RuleOutlinedIcon />, title: 'Requirement gap analysis', text: 'Mandatory gaps are highlighted separately so you know what matters most before you apply.' },
  { icon: <AutoFixHighOutlinedIcon />, title: 'AI wording suggestions', text: 'Get suggestions that rephrase your existing experience for a specific job. You accept or reject every change.' },
  { icon: <ShieldOutlinedIcon />, title: 'Truthful by design', text: 'We never add skills, employers, certifications or metrics you do not have. Gaps stay gaps.' },
  { icon: <DownloadOutlinedIcon />, title: 'ATS-friendly export', text: 'Edit with a live preview and download clean, single-column PDF and DOCX resumes.' },
  { icon: <UploadFileOutlinedIcon />, title: 'Private and reusable', text: 'Keep your resumes and job descriptions in one place and reuse them for new analyses.' },
];

const STEPS = [
  { n: 1, title: 'Upload your resume', text: 'Add a PDF or DOCX, or reuse one you saved earlier.' },
  { n: 2, title: 'Add a job description', text: 'Paste the posting you are targeting.' },
  { n: 3, title: 'Review your report', text: 'Understand matches, gaps and what to improve.' },
  { n: 4, title: 'Optimize and download', text: 'Accept suggestions, edit, and export your resume.' },
];

// Illustrative content only, clearly labeled on the page.
const SAMPLE_CATEGORIES = [
  { label: 'Technical skills', value: 78 },
  { label: 'Experience relevance', value: 70 },
  { label: 'Responsibilities', value: 64 },
  { label: 'Keyword relevance', value: 72 },
  { label: 'Education', value: 100 },
  { label: 'Structure and readability', value: 85 },
];

const FAQS = [
  { q: 'Is this the same as the ATS an employer uses?', a: 'No. Every employer’s system works differently and none publish their scoring. Our score is an estimate from a transparent method that compares your resume to the job description. It does not guarantee interviews or job offers.' },
  { q: 'Will the AI add skills I do not have?', a: 'No. The optimizer only rewords and reorganizes evidence already in your resume. If something is missing, it is reported as a gap rather than added.' },
  { q: 'Which file types can I upload?', a: 'PDF and DOCX resumes. Scanned PDFs are supported through text recognition (OCR).' },
  { q: 'Who can see my resume?', a: 'Only you. Files are stored privately and are never exposed publicly. You can delete your resumes and account data at any time.' },
  { q: 'Why does a requirement say “not found” instead of “missing”?', a: 'Our system can only judge what appears in your resume text. “Not found” means we did not see evidence, not that you definitely lack the skill. You may simply need to add it if it is true.' },
];

function Section({ id, title, subtitle, children, bg }) {
  return (
    <Box id={id} sx={{ py: { xs: 7, md: 10 }, bgcolor: bg || 'transparent', scrollMarginTop: '64px' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', maxWidth: 680, mx: 'auto', mb: 6 }}>
          <Typography variant="h2" component="h2" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }} gutterBottom>{title}</Typography>
          {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
        </Box>
        {children}
      </Container>
    </Box>
  );
}

export default function LandingPage() {
  return (
    <Box>
      <PublicNavbar />

      {/* Hero */}
      <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ py: { xs: 8, md: 12 } }}>
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <Chip label={TAGLINE} color="primary" variant="outlined" sx={{ mb: 2 }} />
              <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '2.25rem', md: '3.25rem' }, mb: 2 }}>
                Know how well your resume fits the job before you apply
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mb: 4, maxWidth: 560 }}>
                Compare your resume with any job description, see matched and missing requirements with evidence, and improve your wording without inventing anything.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Button component={RouterLink} to={ROUTES.register} variant="contained" size="large">Analyze my resume</Button>
                <Button href="#sample-report" variant="outlined" size="large">See a sample report</Button>
              </Stack>
            </Grid>
            <Grid item xs={12} md={5}>
              <Card sx={{ boxShadow: '0 8px 30px rgba(17,24,39,0.08)' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="overline" color="text.secondary">Example result</Typography>
                  <Typography variant="h2" color="primary" sx={{ my: 1 }}>74%</Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>Compatibility with the job description</Typography>
                  <LinearProgress variant="determinate" value={74} sx={{ height: 10, borderRadius: 5 }} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Features */}
      <Section id="features" title="Everything you need to tailor your resume" subtitle="Built to be useful and honest, not a keyword-stuffing trick.">
        <Grid container spacing={3}>
          {FEATURES.map((f) => (
            <Grid item xs={12} sm={6} md={4} key={f.title}>
              <Card sx={{ height: '100%' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>{f.icon}</Box>
                  <Typography variant="h6" gutterBottom>{f.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{f.text}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Section>

      {/* How it works */}
      <Section id="how-it-works" title="How it works" bg="background.paper">
        <Grid container spacing={3}>
          {STEPS.map((s) => (
            <Grid item xs={12} sm={6} md={3} key={s.n}>
              <Box sx={{ textAlign: 'center', px: 1 }}>
                <Box sx={{ width: 48, height: 48, mx: 'auto', mb: 2, borderRadius: '50%', bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{s.n}</Box>
                <Typography variant="h6" gutterBottom>{s.title}</Typography>
                <Typography variant="body2" color="text.secondary">{s.text}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Section>

      {/* Sample report */}
      <Section id="sample-report" title="A sample analysis report" subtitle="Illustrative example only. Your report is generated from your own resume and job description.">
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Category scores</Typography>
                <Stack spacing={2}>
                  {SAMPLE_CATEGORIES.map((c) => (
                    <Box key={c.label}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">{c.label}</Typography>
                        <Typography variant="body2" fontWeight={600}>{c.value}%</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={c.value} sx={{ height: 8, borderRadius: 4 }} />
                    </Box>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom>Requirement checks</Typography>
                <Stack spacing={2}>
                  <Box>
                    <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="Matched" sx={{ mb: 0.5 }} />
                    <Typography variant="body2"><strong>Python</strong> (required): found in “Built data pipelines in Python” under Experience.</Typography>
                  </Box>
                  <Box>
                    <Chip size="small" color="warning" label="Partial match" sx={{ mb: 0.5 }} />
                    <Typography variant="body2"><strong>Cloud platforms</strong>: AWS appears, but the job also asks for Azure.</Typography>
                  </Box>
                  <Box>
                    <Chip size="small" color="error" variant="outlined" label="Not found (mandatory)" sx={{ mb: 0.5 }} />
                    <Typography variant="body2"><strong>Kubernetes</strong>: no mention in the resume. If you have this experience, consider adding it.</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Section>

      {/* Pricing */}
      <Section id="pricing" title="Simple plans" subtitle="Pricing is not final yet. Start free today." bg="background.paper">
        <Grid container spacing={3} justifyContent="center">
          {[
            { name: 'Free', price: 'Free', items: ['Upload and store resumes', 'ATS compatibility analysis', 'Explainable report', 'Limited optimizations'], cta: 'Get started', primary: false },
            { name: 'Pro', price: 'Coming soon', items: ['Higher analysis limits', 'Unlimited optimization versions', 'PDF and DOCX export', 'Priority processing'], cta: 'Join with a free account', primary: true },
          ].map((p) => (
            <Grid item xs={12} sm={6} md={4} key={p.name}>
              <Card sx={{ height: '100%', borderColor: p.primary ? 'primary.main' : undefined, borderWidth: p.primary ? 2 : 1 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h5">{p.name}</Typography>
                  <Typography variant="h4" sx={{ my: 1.5 }}>{p.price}</Typography>
                  <Stack spacing={1} sx={{ mb: 3 }}>
                    {p.items.map((i) => (
                      <Stack direction="row" spacing={1} key={i} alignItems="center">
                        <CheckCircleOutlineIcon color="success" fontSize="small" />
                        <Typography variant="body2">{i}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button component={RouterLink} to={ROUTES.register} variant={p.primary ? 'contained' : 'outlined'} fullWidth>{p.cta}</Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Section>

      {/* FAQ */}
      <Section id="faq" title="Frequently asked questions">
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          {FAQS.map((f) => (
            <Accordion key={f.q} variant="outlined" disableGutters sx={{ '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>{f.q}</Typography>
              </AccordionSummary>
              <AccordionDetails><Typography color="text.secondary">{f.a}</Typography></AccordionDetails>
            </Accordion>
          ))}
        </Box>
      </Section>

      <Footer />
    </Box>
  );
}

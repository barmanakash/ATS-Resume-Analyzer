import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, CardContent, Chip, Container, GlobalStyles, Grid,
  LinearProgress, Stack, Typography,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AutoFixHighOutlinedIcon from '@mui/icons-material/AutoFixHighOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PublicNavbar from '../../components/layout/PublicNavbar';
import Footer from '../../components/layout/Footer';
import Reveal from '../../components/motion/Reveal';
import HeroScene from './HeroScene';
import useCountUp from '../../hooks/useCountUp';
import useInView from '../../hooks/useInView';
import { ROUTES, TAGLINE } from '../../config';

/* ------------------------------------------------------------------ content */

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

const SAMPLE_CHECKS = [
  { chip: <Chip size="small" color="success" icon={<CheckCircleOutlineIcon />} label="Matched" />, body: <><strong>Python</strong> (required): found in “Built data pipelines in Python” under Experience.</> },
  { chip: <Chip size="small" color="warning" label="Partial match" />, body: <><strong>Cloud platforms</strong>: AWS appears, but the job also asks for Azure.</> },
  { chip: <Chip size="small" color="error" variant="outlined" label="Not found (mandatory)" />, body: <><strong>Kubernetes</strong>: no mention in the resume. If you have this experience, consider adding it.</> },
];

const PLANS = [
  { name: 'Free', price: 'Free', items: ['Upload and store resumes', 'ATS compatibility analysis', 'Explainable report', 'Limited optimizations'], cta: 'Get started', primary: false },
  { name: 'Pro', price: 'Coming soon', items: ['Higher analysis limits', 'Unlimited optimization versions', 'PDF and DOCX export', 'Priority processing'], cta: 'Join with a free account', primary: true },
];

const FAQS = [
  { q: 'Is this the same as the ATS an employer uses?', a: 'No. Every employer’s system works differently and none publish their scoring. Our score is an estimate from a transparent method that compares your resume to the job description. It does not guarantee interviews or job offers.' },
  { q: 'Will the AI add skills I do not have?', a: 'No. The optimizer only rewords and reorganizes evidence already in your resume. If something is missing, it is reported as a gap rather than added.' },
  { q: 'Which file types can I upload?', a: 'PDF and DOCX resumes. Scanned PDFs are supported through text recognition (OCR).' },
  { q: 'Who can see my resume?', a: 'Only you. Files are stored privately and are never exposed publicly. You can delete your resumes and account data at any time.' },
  { q: 'Why does a requirement say “not found” instead of “missing”?', a: 'Our system can only judge what appears in your resume text. “Not found” means we did not see evidence, not that you definitely lack the skill. You may simply need to add it if it is true.' },
];

const TRUST = ['Evidence behind every match', 'Never invents skills or experience', 'PDF and DOCX supported'];

/* ------------------------------------------------------------------ motion styles */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: none; }
`;
const drift = keyframes`
  0%   { transform: translate(0, 0) scale(1); }
  50%  { transform: translate(34px, -22px) scale(1.08); }
  100% { transform: translate(-22px, 24px) scale(1); }
`;
const underline = keyframes`
  from { transform: scaleX(0); }
  to   { transform: scaleX(1); }
`;
const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(30, 79, 216, 0.45); }
  70%  { box-shadow: 0 0 0 8px rgba(30, 79, 216, 0); }
  100% { box-shadow: 0 0 0 0 rgba(30, 79, 216, 0); }
`;
const glow = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 rgba(30, 79, 216, 0); }
  50%      { box-shadow: 0 0 0 8px rgba(30, 79, 216, 0.1); }
`;

const STILL = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

/** Entrance for hero content on page load. Content stays visible if motion is reduced. */
const enter = (delayMs) => ({
  animation: `${fadeUp} 700ms cubic-bezier(0.2, 0.7, 0.2, 1) ${delayMs}ms backwards`,
  ...STILL,
});

const visuallyHidden = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

/** Button hover: lift, glow and a sliding arrow. Movement only when the visitor allows motion. */
const ctaSx = {
  transition: 'box-shadow 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease',
  '&:hover': { boxShadow: '0 10px 24px rgba(30, 79, 216, 0.28)' },
  '& .cta-arrow': { transition: 'transform 0.2s ease' },
  '@media (prefers-reduced-motion: no-preference)': {
    '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 10px 24px rgba(30, 79, 216, 0.28)' },
    '&:active': { transform: 'translateY(0)' },
    '&:hover .cta-arrow': { transform: 'translateX(5px)' },
  },
};

/** Card hover: border highlight and shadow, plus a lift when motion is allowed. */
const liftCard = {
  transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
  '&:hover': { borderColor: 'primary.main', boxShadow: '0 14px 30px rgba(17, 24, 39, 0.1)' },
  '@media (prefers-reduced-motion: no-preference)': { '&:hover': { transform: 'translateY(-6px)' } },
};

/* ------------------------------------------------------------------ pieces */

function Section({ id, title, subtitle, children, bg }) {
  return (
    <Box id={id} sx={{ py: { xs: 7, md: 10 }, bgcolor: bg || 'transparent', scrollMarginTop: '64px' }}>
      <Container maxWidth="lg">
        <Reveal sx={{ textAlign: 'center', maxWidth: 680, mx: 'auto', mb: 6 }}>
          <Typography variant="h2" component="h2" sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' } }} gutterBottom>{title}</Typography>
          {subtitle && <Typography color="text.secondary">{subtitle}</Typography>}
        </Reveal>
        {children}
      </Container>
    </Box>
  );
}

function Hero() {
  return (
    <Box component="section" sx={{ position: 'relative', overflow: 'hidden', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      {/* Soft moving colour behind the content */}
      <Box aria-hidden="true" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <Box sx={{ position: 'absolute', top: -140, right: -80, width: 460, height: 460, borderRadius: '50%', bgcolor: 'primary.light', opacity: 0.18, filter: 'blur(80px)', animation: `${drift} 18s ease-in-out infinite alternate`, ...STILL }} />
        <Box sx={{ position: 'absolute', bottom: -180, left: -120, width: 420, height: 420, borderRadius: '50%', bgcolor: 'secondary.main', opacity: 0.1, filter: 'blur(90px)', animation: `${drift} 22s ease-in-out infinite alternate-reverse`, ...STILL }} />
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'radial-gradient(rgba(30, 79, 216, 0.14) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
            maskImage: 'radial-gradient(ellipse at 70% 40%, #000 0%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 70% 40%, #000 0%, transparent 70%)',
          }}
        />
      </Box>

      <Container maxWidth="lg" sx={{ position: 'relative', py: { xs: 8, md: 12 } }}>
        <Grid container spacing={{ xs: 8, md: 6 }} alignItems="center">
          <Grid item xs={12} md={7}>
            <Box sx={enter(0)}>
              <Chip
                variant="outlined"
                color="primary"
                sx={{ mb: 2.5, bgcolor: 'background.paper' }}
                label={(
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Box aria-hidden="true" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', animation: `${pulse} 2s ease-out infinite`, ...STILL }} />
                    <span>{TAGLINE}</span>
                  </Stack>
                )}
              />
            </Box>

            <Typography variant="h1" component="h1" sx={{ fontSize: { xs: '2.25rem', md: '3.4rem' }, mb: 2.5, ...enter(100) }}>
              Know how well your resume fits the job{' '}
              <Box
                component="span"
                sx={{
                  position: 'relative',
                  display: 'inline-block',
                  zIndex: 0,
                  color: 'primary.main',
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '0.06em',
                    height: '0.3em',
                    zIndex: -1,
                    borderRadius: 1,
                    bgcolor: 'primary.light',
                    opacity: 0.28,
                    transformOrigin: 'left',
                    animation: `${underline} 800ms cubic-bezier(0.2, 0.7, 0.2, 1) 900ms backwards`,
                    ...STILL,
                  },
                }}
              >
                before you apply
              </Box>
            </Typography>

            <Typography variant="h6" color="text.secondary" sx={{ fontWeight: 400, mb: 4, maxWidth: 560, ...enter(220) }}>
              Compare your resume with any job description, see matched and missing requirements with evidence, and improve your wording without inventing anything.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 4, ...enter(340) }}>
              <Button component={RouterLink} to={ROUTES.register} variant="contained" size="large" endIcon={<ArrowForwardIcon className="cta-arrow" />} sx={ctaSx}>
                Analyze my resume
              </Button>
              <Button href="#sample-report" variant="outlined" size="large" sx={ctaSx}>See a sample report</Button>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }} sx={enter(460)} component="ul" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {TRUST.map((text) => (
                <Stack component="li" key={text} direction="row" spacing={0.75} alignItems="center">
                  <CheckCircleOutlineIcon color="success" fontSize="small" />
                  <Typography variant="body2" color="text.secondary">{text}</Typography>
                </Stack>
              ))}
            </Stack>
          </Grid>

          <Grid item xs={12} md={5} sx={enter(300)}>
            <Box sx={visuallyHidden}>
              Illustration: an example resume is scanned, matched skills are highlighted, a missing skill is flagged, and an example score of 74 out of 100 appears.
            </Box>
            <HeroScene />
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function FeatureCard({ feature, index }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Reveal delay={(index % 3) * 90} sx={{ height: '100%' }}>
        <Card
          sx={{
            height: '100%',
            ...liftCard,
            '@media (prefers-reduced-motion: no-preference)': {
              '&:hover': { transform: 'translateY(-6px)' },
              '&:hover .feature-icon': { transform: 'rotate(-8deg) scale(1.12)' },
            },
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Box
              className="feature-icon"
              sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: 'primary.main', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2, transition: 'transform 0.3s ease' }}
            >
              {feature.icon}
            </Box>
            <Typography variant="h6" gutterBottom>{feature.title}</Typography>
            <Typography variant="body2" color="text.secondary">{feature.text}</Typography>
          </CardContent>
        </Card>
      </Reveal>
    </Grid>
  );
}

function Steps() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  return (
    <Box ref={ref} sx={{ position: 'relative' }}>
      {/* Line that draws itself between the numbered steps (wide screens only) */}
      <Box aria-hidden="true" sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', top: 23, left: '12.5%', right: '12.5%', height: 2, bgcolor: 'divider' }}>
        <Box
          sx={{
            height: '100%',
            bgcolor: 'primary.main',
            transformOrigin: 'left',
            transform: inView ? 'scaleX(1)' : 'scaleX(0)',
            transition: 'transform 1.4s cubic-bezier(0.2, 0.7, 0.2, 1) 0.3s',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      </Box>
      <Grid container spacing={3}>
        {STEPS.map((step, index) => (
          <Grid item xs={12} sm={6} md={3} key={step.n}>
            <Reveal delay={index * 120}>
              <Box sx={{ textAlign: 'center', px: 1, '&:hover .step-number': { boxShadow: '0 0 0 6px rgba(30, 79, 216, 0.18)' }, '@media (prefers-reduced-motion: no-preference)': { '&:hover .step-number': { transform: 'scale(1.12)' } } }}>
                <Box
                  className="step-number"
                  sx={{
                    position: 'relative',
                    zIndex: 1,
                    width: 48,
                    height: 48,
                    mx: 'auto',
                    mb: 2,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    boxShadow: '0 0 0 6px #ffffff',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                >
                  {step.n}
                </Box>
                <Typography variant="h6" gutterBottom>{step.title}</Typography>
                <Typography variant="body2" color="text.secondary">{step.text}</Typography>
              </Box>
            </Reveal>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function SampleBar({ category, active, index }) {
  const shown = useCountUp(category.value, { start: active, delay: index * 120, duration: 1200 });
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2">{category.label}</Typography>
        <Typography variant="body2" fontWeight={600}>{shown}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={active ? category.value : 0}
        aria-label={`${category.label}: ${category.value}%`}
        sx={{
          height: 8,
          borderRadius: 4,
          '& .MuiLinearProgress-bar': { transition: `transform 1.2s cubic-bezier(0.2, 0.7, 0.2, 1) ${index * 120}ms` },
          '@media (prefers-reduced-motion: reduce)': { '& .MuiLinearProgress-bar': { transition: 'none' } },
        }}
      />
    </Box>
  );
}

function SampleReport() {
  const [ref, inView] = useInView({ threshold: 0.25 });
  return (
    <Grid container spacing={3} ref={ref}>
      <Grid item xs={12} md={6}>
        <Reveal sx={{ height: '100%' }}>
          <Card sx={{ height: '100%', ...liftCard }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Category scores</Typography>
              <Stack spacing={2}>
                {SAMPLE_CATEGORIES.map((category, index) => (
                  <SampleBar key={category.label} category={category} active={inView} index={index} />
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Reveal>
      </Grid>
      <Grid item xs={12} md={6}>
        <Reveal delay={120} sx={{ height: '100%' }}>
          <Card sx={{ height: '100%', ...liftCard }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Requirement checks</Typography>
              <Stack spacing={1}>
                {SAMPLE_CHECKS.map((check, index) => (
                  <Reveal key={index} direction="left" distance={24} delay={300 + index * 160}>
                    <Box sx={{ p: 1.5, borderRadius: 2, transition: 'background-color 0.2s ease', '&:hover': { bgcolor: 'action.hover' } }}>
                      <Box sx={{ mb: 0.5 }}>{check.chip}</Box>
                      <Typography variant="body2">{check.body}</Typography>
                    </Box>
                  </Reveal>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Reveal>
      </Grid>
    </Grid>
  );
}

function PlanCard({ plan, index }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Reveal delay={index * 140} sx={{ height: '100%' }}>
        <Card
          sx={{
            height: '100%',
            ...liftCard,
            borderColor: plan.primary ? 'primary.main' : undefined,
            borderWidth: plan.primary ? 2 : 1,
            ...(plan.primary && { animation: `${glow} 3.2s ease-in-out infinite`, ...STILL }),
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h5">{plan.name}</Typography>
            <Typography variant="h4" sx={{ my: 1.5 }}>{plan.price}</Typography>
            <Stack spacing={1} sx={{ mb: 3 }}>
              {plan.items.map((item) => (
                <Stack direction="row" spacing={1} key={item} alignItems="center">
                  <CheckCircleOutlineIcon color="success" fontSize="small" />
                  <Typography variant="body2">{item}</Typography>
                </Stack>
              ))}
            </Stack>
            <Button component={RouterLink} to={ROUTES.register} variant={plan.primary ? 'contained' : 'outlined'} fullWidth sx={ctaSx}>{plan.cta}</Button>
          </CardContent>
        </Card>
      </Reveal>
    </Grid>
  );
}

/* ------------------------------------------------------------------ page */

export default function LandingPage() {
  return (
    <Box>
      {/* Smooth anchor scrolling on this page only, and not for people who prefer reduced motion */}
      <GlobalStyles styles={{ html: { scrollBehavior: 'smooth' }, '@media (prefers-reduced-motion: reduce)': { html: { scrollBehavior: 'auto' } } }} />
      <PublicNavbar />
      <Hero />

      <Section id="features" title="Everything you need to tailor your resume" subtitle="Built to be useful and honest, not a keyword-stuffing trick.">
        <Grid container spacing={3}>
          {FEATURES.map((feature, index) => <FeatureCard key={feature.title} feature={feature} index={index} />)}
        </Grid>
      </Section>

      <Section id="how-it-works" title="How it works" bg="background.paper">
        <Steps />
      </Section>

      <Section id="sample-report" title="A sample analysis report" subtitle="Illustrative example only. Your report is generated from your own resume and job description.">
        <SampleReport />
      </Section>

      <Section id="pricing" title="Simple plans" subtitle="Pricing is not final yet. Start free today." bg="background.paper">
        <Grid container spacing={3} justifyContent="center">
          {PLANS.map((plan, index) => <PlanCard key={plan.name} plan={plan} index={index} />)}
        </Grid>
      </Section>

      <Section id="faq" title="Frequently asked questions">
        <Box sx={{ maxWidth: 800, mx: 'auto' }}>
          {FAQS.map((faq, index) => (
            <Reveal key={faq.q} delay={index * 70}>
              <Accordion
                variant="outlined"
                disableGutters
                sx={{
                  transition: 'background-color 0.2s ease, border-color 0.2s ease',
                  '&:before': { display: 'none' },
                  '&:hover': { bgcolor: 'rgba(30, 79, 216, 0.03)' },
                  '&.Mui-expanded': { borderColor: 'primary.main' },
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={600}>{faq.q}</Typography>
                </AccordionSummary>
                <AccordionDetails><Typography color="text.secondary">{faq.a}</Typography></AccordionDetails>
              </Accordion>
            </Reveal>
          ))}
        </Box>
      </Section>

      <Footer />
    </Box>
  );
}

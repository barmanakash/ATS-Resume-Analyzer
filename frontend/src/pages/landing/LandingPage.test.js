import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';

jest.mock('../../context/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));

const renderPage = () => render(<MemoryRouter><LandingPage /></MemoryRouter>);

const setReducedMotion = (reduced) => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(), // MUI's responsive hooks still use the older API
    removeListener: jest.fn(),
  }));
};

afterEach(() => {
  delete window.matchMedia;
});

describe('LandingPage', () => {
  it('shows the headline and the main calls to action', () => {
    renderPage();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Know how well your resume fits the job');
    expect(heading).toHaveTextContent('before you apply');
    expect(screen.getByRole('link', { name: /analyze my resume/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /see a sample report/i })).toHaveAttribute('href', '#sample-report');
  });

  it('has every section, so the animation never hides content', () => {
    renderPage();
    [
      'Everything you need to tailor your resume',
      'How it works',
      'A sample analysis report',
      'Simple plans',
      'Frequently asked questions',
    ].forEach((name) => expect(screen.getByRole('heading', { name })).toBeInTheDocument());
    expect(screen.getByText('Truthful by design')).toBeInTheDocument();
    expect(screen.getByText(/not found \(mandatory\)/i)).toBeInTheDocument();
  });

  it('keeps the decorative hero illustration away from screen readers but describes it in words', () => {
    renderPage();
    expect(screen.getByText('Example match').closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText(/Illustration: an example resume is scanned/i)).toBeInTheDocument();
  });

  it('labels the illustration and the sample report as examples, not real results', () => {
    renderPage();
    expect(screen.getByText('Illustration only')).toBeInTheDocument();
    expect(screen.getByText(/Illustrative example only/i)).toBeInTheDocument();
  });

  it('shows final numbers straight away when the visitor prefers reduced motion', () => {
    setReducedMotion(true);
    renderPage();
    expect(screen.getByText('74')).toBeInTheDocument(); // hero example score
    expect(screen.getByText('78%')).toBeInTheDocument(); // first sample category
    expect(screen.getByText('100%')).toBeInTheDocument(); // education
  });
});

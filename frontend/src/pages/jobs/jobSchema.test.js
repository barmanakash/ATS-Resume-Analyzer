import { jobSchema, validateJobFile } from './jobSchema';

const valid = {
  jobTitle: 'Backend Engineer',
  companyName: 'Acme',
  description: 'We need a backend engineer with strong Python and MongoDB skills.',
};

describe('jobSchema', () => {
  it('accepts a complete job and trims whitespace', () => {
    const result = jobSchema.safeParse({ ...valid, jobTitle: '  Backend Engineer  ' });
    expect(result.success).toBe(true);
    expect(result.data.jobTitle).toBe('Backend Engineer');
  });

  it('allows an empty company name', () => {
    expect(jobSchema.safeParse({ ...valid, companyName: '' }).success).toBe(true);
  });

  it('requires a job title, even if it is only spaces', () => {
    const result = jobSchema.safeParse({ ...valid, jobTitle: '   ' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toMatch(/enter the job title/i);
  });

  it('rejects a description shorter than 30 characters after trimming', () => {
    expect(jobSchema.safeParse({ ...valid, description: 'too short' }).success).toBe(false);
    expect(jobSchema.safeParse({ ...valid, description: `   ${'a'.repeat(29)}   ` }).success).toBe(false);
    expect(jobSchema.safeParse({ ...valid, description: 'a'.repeat(30) }).success).toBe(true);
  });

  it('rejects descriptions over 20,000 characters but accepts exactly 20,000', () => {
    expect(jobSchema.safeParse({ ...valid, description: 'a'.repeat(20000) }).success).toBe(true);
    expect(jobSchema.safeParse({ ...valid, description: 'a'.repeat(20001) }).success).toBe(false);
  });

  it('rejects overly long titles and company names', () => {
    expect(jobSchema.safeParse({ ...valid, jobTitle: 'a'.repeat(201) }).success).toBe(false);
    expect(jobSchema.safeParse({ ...valid, companyName: 'a'.repeat(201) }).success).toBe(false);
  });
});

describe('validateJobFile', () => {
  const file = (name, size = 1000) => ({ name, size });

  it.each(['jd.pdf', 'JD.DOCX', 'jd.txt'])('accepts %s', (name) => {
    expect(validateJobFile(file(name))).toBe('');
  });

  it.each(['jd.doc', 'jd.png', 'jd', 'jd.txt.exe'])('rejects %s', (name) => {
    expect(validateJobFile(file(name))).toMatch(/unsupported file type/i);
  });

  it('rejects empty and oversized files', () => {
    expect(validateJobFile(file('jd.pdf', 0))).toMatch(/empty/i);
    expect(validateJobFile(file('jd.pdf', 5 * 1024 * 1024 + 1))).toMatch(/too large/i);
    expect(validateJobFile(file('jd.pdf', 5 * 1024 * 1024))).toBe('');
  });
});

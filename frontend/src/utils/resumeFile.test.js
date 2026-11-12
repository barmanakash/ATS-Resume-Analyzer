import { defaultResumeName, formatBytes, validateResumeFile } from './resumeFile';

const file = (name, size = 1000) => ({ name, size });

describe('validateResumeFile', () => {
  it('accepts PDF and DOCX files, case-insensitively', () => {
    expect(validateResumeFile(file('cv.pdf'))).toBe('');
    expect(validateResumeFile(file('CV.DOCX'))).toBe('');
    expect(validateResumeFile(file('my.cv.final.pdf'))).toBe('');
  });

  it.each(['cv.txt', 'cv.doc', 'cv.exe', 'cv', 'pdf', 'cv.pdf.exe'])('rejects %s', (name) => {
    expect(validateResumeFile(file(name))).toMatch(/unsupported file type/i);
  });

  it('rejects empty files', () => {
    expect(validateResumeFile(file('cv.pdf', 0))).toMatch(/empty/i);
  });

  it('rejects files over the size limit but accepts exactly the limit', () => {
    const limit = 5 * 1024 * 1024;
    expect(validateResumeFile(file('cv.pdf', limit))).toBe('');
    expect(validateResumeFile(file('cv.pdf', limit + 1))).toMatch(/too large/i);
  });

  it('asks for a file when none is given', () => {
    expect(validateResumeFile(null)).toMatch(/choose a file/i);
  });
});

describe('formatBytes', () => {
  it('formats sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
    expect(formatBytes(undefined)).toBe('');
  });
});

describe('defaultResumeName', () => {
  it('drops only the final extension', () => {
    expect(defaultResumeName('Jane Doe CV.pdf')).toBe('Jane Doe CV');
    expect(defaultResumeName('v2.final.docx')).toBe('v2.final');
  });
});

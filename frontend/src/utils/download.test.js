import { filenameFromDisposition, saveBlob } from './download';

describe('filenameFromDisposition', () => {
  it('reads a plain quoted or unquoted file name', () => {
    expect(filenameFromDisposition('attachment; filename="Jane_Doe_Resume.pdf"', 'x.pdf')).toBe('Jane_Doe_Resume.pdf');
    expect(filenameFromDisposition('attachment; filename=Resume.docx', 'x.docx')).toBe('Resume.docx');
  });

  it('uses the fallback when there is no usable name', () => {
    expect(filenameFromDisposition(undefined, 'Resume.pdf')).toBe('Resume.pdf');
    expect(filenameFromDisposition('attachment', 'Resume.pdf')).toBe('Resume.pdf');
    expect(filenameFromDisposition('attachment; filename=""', 'Resume.pdf')).toBe('Resume.pdf');
  });

  it('never accepts a name that could point to another folder or hide the file', () => {
    expect(filenameFromDisposition('attachment; filename="../../evil.exe"', 'Resume.pdf')).toBe('Resume.pdf');
    expect(filenameFromDisposition('attachment; filename="a/b.pdf"', 'Resume.pdf')).toBe('Resume.pdf');
    expect(filenameFromDisposition('attachment; filename="..\\\\evil.pdf"', 'Resume.pdf')).toBe('Resume.pdf');
    expect(filenameFromDisposition('attachment; filename=".htaccess"', 'Resume.pdf')).toBe('Resume.pdf');
    expect(filenameFromDisposition('attachment; filename="my resume.pdf"', 'Resume.pdf')).toBe('Resume.pdf');
  });
});

describe('saveBlob', () => {
  afterEach(() => {
    jest.useRealTimers();
    delete URL.createObjectURL;
    delete URL.revokeObjectURL;
  });

  it('clicks a temporary download link and cleans it up', () => {
    jest.useFakeTimers();
    URL.createObjectURL = jest.fn(() => 'blob:resume');
    URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function recordClick() {
      expect(this.download).toBe('Jane_Doe_Resume.pdf');
      expect(this.getAttribute('href')).toBe('blob:resume');
    });

    saveBlob(new Blob(['x']), 'Jane_Doe_Resume.pdf');

    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull(); // link removed again
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:resume');
    click.mockRestore();
  });
});

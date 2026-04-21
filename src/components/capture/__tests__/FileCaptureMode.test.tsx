import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FileCaptureMode } from '../FileCaptureMode';

describe('FileCaptureMode', () => {
  it('renders drop zone when no file selected', () => {
    render(
      <FileCaptureMode onFileSelect={vi.fn()} selectedFile={null} isUploading={false} uploadError={null} />,
    );
    expect(screen.getByText('Drop a file here, or click to browse')).toBeInTheDocument();
    expect(screen.getByText('PDF · DOCX · TXT · Max 10MB')).toBeInTheDocument();
  });

  it('shows file name when file is selected', () => {
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    render(
      <FileCaptureMode onFileSelect={vi.fn()} selectedFile={file} isUploading={false} uploadError={null} />,
    );
    expect(screen.getByText(/report\.pdf/)).toBeInTheDocument();
  });

  it('calls onFileSelect(null) when clear button clicked', () => {
    const onFileSelect = vi.fn();
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    render(
      <FileCaptureMode onFileSelect={onFileSelect} selectedFile={file} isUploading={false} uploadError={null} />,
    );
    fireEvent.click(screen.getByLabelText('Clear file'));
    expect(onFileSelect).toHaveBeenCalledWith(null);
  });

  it('calls onFileSelect with file when input changes', () => {
    const onFileSelect = vi.fn();
    render(
      <FileCaptureMode onFileSelect={onFileSelect} selectedFile={null} isUploading={false} uploadError={null} />,
    );
    const file = new File(['content'], 'notes.txt', { type: 'text/plain' });
    const input = screen.getByTestId('file-input');
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    expect(onFileSelect).toHaveBeenCalledWith(file);
  });

  it('hides clear button when isUploading is true', () => {
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
    render(
      <FileCaptureMode onFileSelect={vi.fn()} selectedFile={file} isUploading={true} uploadError={null} />,
    );
    expect(screen.queryByLabelText('Clear file')).not.toBeInTheDocument();
  });

  it('shows error message when uploadError is set', () => {
    render(
      <FileCaptureMode onFileSelect={vi.fn()} selectedFile={null} isUploading={false} uploadError="Upload failed — try again" />,
    );
    expect(screen.getByText('Upload failed — try again')).toBeInTheDocument();
  });
});

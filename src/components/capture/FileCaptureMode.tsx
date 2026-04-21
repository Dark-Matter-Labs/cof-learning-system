'use client';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileCaptureModePros {
  readonly onFileSelect: (file: File | null) => void;
  readonly selectedFile: File | null;
  readonly isUploading: boolean;
  readonly uploadError: string | null;
}

export function FileCaptureMode({ onFileSelect, selectedFile, isUploading, uploadError }: FileCaptureModePros) {
  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onFileSelect(files[0]);
  }

  return (
    <div>
      {selectedFile ? (
        <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
          <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">
            {selectedFile.name} ({formatBytes(selectedFile.size)})
          </span>
          {!isUploading && (
            <button
              type="button"
              onClick={() => onFileSelect(null)}
              aria-label="Clear file"
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      ) : (
        <label
          className="block border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        >
          <input
            type="file"
            className="sr-only"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            onChange={e => handleFiles(e.target.files)}
            data-testid="file-input"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400">Drop a file here, or click to browse</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">PDF · DOCX · TXT · Max 10MB</p>
        </label>
      )}
      {uploadError && <p className="mt-2 text-sm text-red-400">{uploadError}</p>}
    </div>
  );
}

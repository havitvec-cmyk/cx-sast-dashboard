import { useCallback, useState } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { parseCSV, extractTimestampFromFilename, formatTimestamp } from '../utils/csvParser';
import { useExtracts } from '../context/ExtractContext';

export default function FileUpload({ onClose }: { onClose?: () => void }) {
  const { addExtract, extracts, removeExtract } = useExtracts();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Only .csv files are supported.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await parseCSV(file);
      if (rows.length === 0) throw new Error('CSV file contains no data rows.');
      addExtract({
        name: file.name.replace(/\.csv$/i, ''),
        timestamp: extractTimestampFromFilename(file.name),
        rows,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse CSV.');
    } finally {
      setLoading(false);
    }
  }, [addExtract]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    files.forEach(processFile);
  }, [processFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach(processFile);
    e.target.value = '';
  }, [processFile]);

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <label
        className={`relative flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200
          ${dragging
            ? 'border-cyber-cyan bg-cyber-cyan/10 shadow-glow'
            : 'border-cyber-border hover:border-cyber-cyan/50 hover:bg-cyber-border/20'
          }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <input
          type="file"
          accept=".csv"
          multiple
          className="sr-only"
          onChange={onInputChange}
          disabled={loading}
        />
        <div className={`p-3 rounded-full ${dragging ? 'bg-cyber-cyan/20' : 'bg-cyber-border/40'}`}>
          <Upload size={24} className={dragging ? 'text-cyber-cyan' : 'text-slate-400'} />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-slate-300">
            {loading ? 'Processing…' : 'Drop extract CSV files here'}
          </p>
          <p className="text-xs text-slate-500 mt-1">or click to browse — multiple files supported</p>
        </div>
      </label>

      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Loaded extracts */}
      {extracts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Loaded extracts</p>
          {extracts.map((ext) => (
            <div
              key={ext.id}
              className="flex items-center gap-3 bg-cyber-surface border border-cyber-border rounded-lg px-3 py-2"
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ext.color }} />
              <FileText size={14} className="text-slate-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-300 font-mono truncate">{ext.name}</p>
                <p className="text-xs text-slate-600">{formatTimestamp(ext.timestamp)} · {ext.rows.length.toLocaleString()} vulns</p>
              </div>
              <button
                onClick={() => removeExtract(ext.id)}
                className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {onClose && (
        <button
          onClick={onClose}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors self-end mt-1"
        >
          Close
        </button>
      )}
    </div>
  );
}

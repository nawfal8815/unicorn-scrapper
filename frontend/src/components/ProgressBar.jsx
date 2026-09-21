export default function ProgressBar({ percent, indeterminate = false }) {
  return (
    <div className={`progress-track ${indeterminate ? 'indeterminate' : ''}`}>
      <div
        className="progress-fill"
        style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}

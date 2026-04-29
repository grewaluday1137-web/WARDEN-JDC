import { getSeverity, timeAgo, formatLocation } from '../utils';

export default function AlertCard({ alert, selected, onClick }) {
  const score = alert.score ?? 50;
  const { tier } = getSeverity(score);
  const isCritical = tier === 'critical';
  const status = alert.status || 'pending';

  return (
    <div
      id={`alert-card-${alert.id}`}
      className={[
        'alert-card',
        selected && 'alert-card--selected',
        isCritical && 'alert-card--critical',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onClick(alert)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick(alert)}
    >
      {/* Severity badge */}
      <div className={`alert-card__severity-badge alert-card__severity-badge--${tier}`}>
        {score}
      </div>

      {/* Body */}
      <div className="alert-card__body">
        <div className="alert-card__source">
          {alert.source === 'camera' ? '📷' : alert.source === 'sensor' ? '🔬' : alert.source === 'guest' ? '🙋' : '⚠️'}
          {' '}{alert.source} Alert
        </div>

        <div className="alert-card__reason">
          {alert.ai_summary || alert.reason || alert.metadata?.event_msg || 'Processing…'}
        </div>

        <div className="alert-card__meta">
          <span>📍 {formatLocation(alert.location)}</span>
          <span>⏱ {timeAgo(alert.timestamp)}</span>
        </div>

        <span className={`alert-card__status-pill alert-card__status-pill--${status}`}>
          ● {status}
        </span>
      </div>
    </div>
  );
}

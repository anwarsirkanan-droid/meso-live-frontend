import { useEffect, useState } from 'react';
import { getLevels } from '../api.js';
import { Card, Loading, Page } from '../components/UI.jsx';

function LevelProgress({ title, level }) {
  const progress = Math.max(0, Math.min(100, Number(level?.progress ?? level?.percentage ?? 0)));
  const points = Number(level?.points ?? level?.value ?? 0).toLocaleString();
  return (
    <Card>
      <p className="eyebrow">{title}</p>
      <h2>Level {level?.level || 1}</h2>
      <p className="muted">{points} points</p>
      <div className="profile-progress-track" role="progressbar" aria-label={`${title} progress`} aria-valuemin="0" aria-valuemax="100" aria-valuenow={progress}>
        <span style={{ width: `${progress}%` }} />
      </div>
    </Card>
  );
}

export default function LevelDetailsPage() {
  const [levels, setLevels] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getLevels().then(setLevels).catch((requestError) => setError(requestError.response?.data?.message || requestError.message || 'Could not load levels.'));
  }, []);

  return (
    <Page title="Levels" eyebrow="YOUR PROGRESS">
      {error ? <p className="form-error" role="alert">{error}</p> : !levels ? <Loading>Loading levels…</Loading> : (
        <div className="profile-level-grid">
          <LevelProgress title="WEALTH LEVEL" level={levels.wealth || levels.wealthLevel} />
          <LevelProgress title="CHARM LEVEL" level={levels.charm || levels.charmLevel} />
        </div>
      )}
    </Page>
  );
}

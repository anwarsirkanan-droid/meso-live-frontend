import { useEffect, useMemo, useState } from 'react';
import { claimCrownReward, claimMicReward, claimTask, claimWelcomeReward, getTaskCenter } from '../api.js';
import { Card, Loading, Page } from '../components/UI.jsx';

const formatNumber = (value) => (Number(value) || 0).toLocaleString();
const taskProgress = (task) => Math.min(Number(task.requirementTarget) || 0, Number(task.progress) || 0);

function Progress({ task }) {
  const target = Number(task.requirementTarget) || 0;
  const progress = taskProgress(task);
  const percentage = target ? Math.min(100, (progress / target) * 100) : 0;
  return <div className="task-progress"><div className="task-progress-copy"><span>{progress}/{target}</span><span>{Math.round(percentage)}%</span></div><div className="profile-progress-track"><span style={{ width: `${percentage}%` }} /></div></div>;
}

function TaskRow({ task, onClaim, claiming }) {
  return (
    <div className="task-row">
      <div className="task-row-copy"><h3>{task.title}</h3><p className="muted">{task.description}</p><strong>{formatNumber(task.reward)} coins</strong><Progress task={task} /></div>
      <button className="button button-primary button-small" type="button" disabled={task.claimed || claiming} onClick={() => onClaim(task.id)}>{task.claimed ? 'Claimed ✓' : claiming ? 'Claiming…' : 'Claim'}</button>
    </div>
  );
}

function HostRewardCard({ title, description, rewardLabel, buttonText, claimable, claimed, claiming, onClaim }) {
  return <Card className="host-reward-card"><div><p className="eyebrow">HOST REWARD</p><h3>{title}</h3><p className="muted">{description}</p><strong>{rewardLabel}</strong></div><button className="button button-primary button-small" type="button" disabled={!claimable || claimed || claiming} onClick={onClaim}>{claimed ? 'Claimed ✓' : claiming ? 'Claiming…' : buttonText}</button></Card>;
}

export default function TaskCenterScreen({ initialTab = 'daily' }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(initialTab);
  const [claiming, setClaiming] = useState('');
  const [error, setError] = useState('');

  const loadTasks = () => getTaskCenter().then(setData).catch((requestError) => setError(requestError.response?.data?.message || requestError.message || 'Could not load task center.'));
  useEffect(() => { loadTasks(); }, []);

  const isHost = data?.role === 'HOST' || data?.role === 'AGENT';
  const currentTasks = useMemo(() => data?.[tab === 'daily' ? 'dailyTasks' : 'weeklyTasks'] || [], [data, tab]);

  useEffect(() => {
    if (data && !isHost && tab === 'host') setTab('daily');
  }, [data, isHost, tab]);

  const runClaim = async (key, action) => {
    setClaiming(key);
    setError('');
    try {
      await action();
      await loadTasks();
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not claim reward.');
    } finally {
      setClaiming('');
    }
  };

  if (!data) return <Page title="Task Center"><Loading>Loading tasks…</Loading></Page>;

  return (
    <Page title="Task Center">
      <div className="task-center-balance"><span>Total coins</span><strong>{formatNumber(data.coins)}</strong></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="task-tabs" role="tablist" aria-label="Task categories">
        {['daily', 'weekly', ...(isHost ? ['host'] : [])].map((item) => <button key={item} className={tab === item ? 'is-active' : ''} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
      {tab !== 'host' ? <Card title={`${tab[0].toUpperCase()} tasks`} className="task-list-card">{currentTasks.length ? currentTasks.map((task) => <TaskRow key={task.id || task._id} task={task} claiming={claiming === (task.id || task._id)} onClaim={(id) => runClaim(id, () => claimTask(id))} />) : <p className="muted">No tasks available.</p>}</Card> : (
        <div className="host-task-center">
          <HostRewardCard title="On Mic Reward" description="Stay on mic for 60 minutes." rewardLabel={data.hostRewards?.micRewardLabel} buttonText={data.hostRewards?.micBtnText} claimable={data.hostRewards?.micSeconds >= 3600} claimed={data.hostRewards?.micClaimed} claiming={claiming === 'mic'} onClaim={() => runClaim('mic', claimMicReward)} />
          <HostRewardCard title="Crown Mic Reward" description="Stay on crown mic for 60 minutes." rewardLabel={data.hostRewards?.crownRewardLabel} buttonText={data.hostRewards?.crownBtnText} claimable={data.hostRewards?.crownSeconds >= 3600} claimed={data.hostRewards?.crownClaimed} claiming={claiming === 'crown'} onClaim={() => runClaim('crown', claimCrownReward)} />
          <HostRewardCard title="Welcome Reward" description="Claim your host welcome bonus once." rewardLabel={data.hostRewards?.welcomeRewardLabel} buttonText={data.hostRewards?.welcomeBtnText} claimable={!data.hostRewards?.welcomeClaimed} claimed={data.hostRewards?.welcomeClaimed} claiming={claiming === 'welcome'} onClaim={() => runClaim('welcome', claimWelcomeReward)} />
          <Card title="Host Task Levels" className="host-levels-card"><div className="host-levels-table"><div className="host-levels-row host-levels-heading"><span>Level</span><span>Target (7d)</span><span>Reward/H</span><span>Max H</span><span>Total</span></div>{(data.hostLevels || []).map((level) => <div className="host-levels-row" key={level.level}><span>{level.level}</span><span>{level.targetHours}</span><span>{level.rewardPerHour}</span><span>{level.maxHours}</span><span>{level.totalReward}</span></div>)}</div></Card>
        </div>
      )}
    </Page>
  );
}

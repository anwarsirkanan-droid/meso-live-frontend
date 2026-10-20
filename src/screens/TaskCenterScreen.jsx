import { Crown, Gift, Mic, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claimCrownReward, claimMicReward, claimTask, claimWelcomeReward, getTaskCenter } from '../api.js';
import { Card, Loading, Page } from '../components/UI.jsx';

const formatNumber = (value) => (Number(value) || 0).toLocaleString();
const taskProgress = (task) => Math.min(Number(task.requirementTarget) || 0, Number(task.progress) || 0);
const progressPercent = (value, target) => (target ? Math.min(100, (Number(value) / Number(target)) * 100) : 0);

const rewardCardStyle = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 14,
  margin: 0,
  borderColor: 'color-mix(in srgb, var(--accent) 24%, var(--border))'
};

const actionButtonStyle = {
  minWidth: 74,
  borderRadius: 999,
  color: '#221735',
  background: '#d9c7ff',
  boxShadow: 'none'
};

function Progress({ task }) {
  const target = Number(task.requirementTarget) || 0;
  const progress = taskProgress(task);
  const percentage = progressPercent(progress, target);
  return <div className="task-progress"><div className="task-progress-copy"><span>{progress}/{target}</span><span>{Math.round(percentage)}%</span></div><div className="profile-progress-track"><span style={{ width: `${percentage}%` }} /></div></div>;
}

function TaskRow({ task, onClaim, onGo, claiming }) {
  const target = Number(task.requirementTarget) || 0;
  const completed = Boolean(task.completed) || (target > 0 && taskProgress(task) >= target);
  const actionLabel = task.claimed ? 'Claimed ✓' : claiming ? 'Claiming…' : completed ? 'Claim' : 'Go';
  return (
    <div className="task-row">
      <div className="task-row-copy"><h3>{task.title}</h3><p className="muted">{task.description}</p><strong>{formatNumber(task.reward)} coins</strong><Progress task={task} /></div>
      <button className="button button-primary button-small" type="button" disabled={task.claimed || claiming} onClick={() => (completed ? onClaim(task.id) : onGo())}>{actionLabel}</button>
    </div>
  );
}

function RewardProgress({ label, value, target }) {
  const percentage = progressPercent(value, target);
  return <div style={{ marginTop: 10 }}><div className="task-progress-copy"><span>{label} {formatNumber(value)}/{formatNumber(target)}</span><span>{Math.round(percentage)}%</span></div><div className="profile-progress-track"><span style={{ width: `${percentage}%` }} /></div></div>;
}

function HostRewardCard({ icon: Icon, iconColor, iconBackground, title, description, rewardLabel, completed, claimed, claiming, onClaim, onGo, progress }) {
  const actionLabel = claimed ? 'Claimed ✓' : claiming ? 'Claiming…' : completed ? 'Claim' : 'Go';
  return (
    <Card className="host-reward-card" style={rewardCardStyle}>
      <span aria-hidden="true" style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 16, color: iconColor, background: iconBackground }}><Icon size={23} /></span>
      <div style={{ minWidth: 0 }}><p className="eyebrow">HOST REWARD</p><h3>{title}</h3><p className="muted">{description}</p><strong>{rewardLabel}</strong>{progress && <RewardProgress {...progress} />}</div>
      <button className="button button-small" style={actionButtonStyle} type="button" disabled={claimed || claiming} onClick={() => (completed ? onClaim() : onGo())}>{actionLabel}</button>
    </Card>
  );
}

export default function TaskCenterScreen({ initialTab = 'daily' }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState(initialTab);
  const [currency, setCurrency] = useState('points');
  const [claiming, setClaiming] = useState('');
  const [error, setError] = useState('');

  const loadTasks = () => getTaskCenter().then(setData).catch((requestError) => setError(requestError.response?.data?.message || requestError.message || 'Could not load task center.'));
  useEffect(() => { loadTasks(); }, []);

  const currentTasks = useMemo(() => data?.[tab === 'daily' ? 'dailyTasks' : 'weeklyTasks'] || [], [data, tab]);

  const goToHostRoom = () => {
    const roomId = data?.hostRewards?.roomId || data?.hostRewards?.hostRoomId || data?.roomId;
    navigate(roomId ? `/live/${encodeURIComponent(String(roomId))}` : '/');
  };

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

  const hostReward = data.hostRewards || {};
  const daysAsHost = Number(hostReward.daysAsHost) || 1;
  const isNewHost = daysAsHost <= 7;
  const micRewardLabel = hostReward.micRewardType === 'USD' || isNewHost ? '$0.90/day' : '8k Points/Diamonds';
  const crownRewardLabel = '3k Points/Diamonds';
  const pointsBalance = data.points ?? data.diamonds ?? hostReward.points ?? 0;
  const balance = currency === 'points' ? pointsBalance : data.coins;

  return (
    <Page title="Task Center">
      <div className="task-center-balance"><span>{currency === 'points' ? 'Total points' : 'Total coins'}</span><strong>{formatNumber(balance)}</strong></div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }} role="group" aria-label="Reward currency">
        {['points', 'coins'].map((item) => <button key={item} type="button" onClick={() => setCurrency(item)} style={{ flex: 1, padding: '9px 14px', border: `1px solid ${currency === item ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 999, color: currency === item ? 'var(--text)' : 'var(--muted)', background: currency === item ? 'color-mix(in srgb, var(--accent) 18%, var(--surface))' : 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 800 }}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="task-tabs" role="tablist" aria-label="Task categories">
        {['daily', 'weekly', 'host'].map((item) => <button key={item} className={tab === item ? 'is-active' : ''} type="button" role="tab" aria-selected={tab === item} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}
      </div>
      {tab !== 'host' ? <Card title={`${tab[0].toUpperCase()} tasks`} className="task-list-card">{currentTasks.length ? currentTasks.map((task) => <TaskRow key={task.id || task._id} task={task} claiming={claiming === (task.id || task._id)} onClaim={(id) => runClaim(id, () => claimTask(id))} onGo={goToHostRoom} />) : <p className="muted">No tasks available.</p>}</Card> : (
        <div className="host-task-center">
          <HostRewardCard icon={Mic} iconColor="#9ecbff" iconBackground="#233c63" title="On Mic Reward" description={isNewHost ? 'New host reward · Days 1–7' : 'Existing host reward · Day 8+'} rewardLabel={micRewardLabel} completed={hostReward.micSeconds >= 3600} claimed={hostReward.micClaimed} claiming={claiming === 'mic'} onClaim={() => runClaim('mic', claimMicReward)} onGo={goToHostRoom} progress={{ label: 'Live Duration (min)', value: Math.floor((hostReward.micSeconds || 0) / 60), target: 60 }} />
          <HostRewardCard icon={Crown} iconColor="#f5d47b" iconBackground="#59461d" title="Crown Mic Reward" description="Stay on crown mic for 60 minutes." rewardLabel={crownRewardLabel} completed={hostReward.crownSeconds >= 3600} claimed={hostReward.crownClaimed} claiming={claiming === 'crown'} onClaim={() => runClaim('crown', claimCrownReward)} onGo={goToHostRoom} progress={{ label: 'Live Duration (min)', value: Math.floor((hostReward.crownSeconds || 0) / 60), target: 60 }} />
          <HostRewardCard icon={data.hostRewards?.welcomeClaimed ? Sparkles : Gift} iconColor="#d7b6ff" iconBackground="#452a66" title="Welcome Reward" description="Claim your host welcome bonus once." rewardLabel={hostReward.welcomeRewardLabel} completed={!hostReward.welcomeClaimed} claimed={hostReward.welcomeClaimed} claiming={claiming === 'welcome'} onClaim={() => runClaim('welcome', claimWelcomeReward)} onGo={goToHostRoom} progress={{ label: 'Gift Points in last 7 Days', value: hostReward.giftPointsLast7Days || 0, target: hostReward.giftPointsTarget || 500000 }} />
          <Card title="Host Task Levels" className="host-levels-card"><div className="host-levels-table"><div className="host-levels-row host-levels-heading"><span>Level</span><span>Target (7d)</span><span>Reward/H</span><span>Max H</span><span>Total</span></div>{(data.hostLevels || []).map((level) => <div className="host-levels-row" key={level.level}><span>{level.level}</span><span>{level.targetHours}</span><span>{level.rewardPerHour}</span><span>{level.maxHours}</span><span>{level.totalReward}</span></div>)}</div></Card>
        </div>
      )}
    </Page>
  );
}

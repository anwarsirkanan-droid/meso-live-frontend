import { useCallback, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createRoom, getProfile, getHostDailyTasks, claimHostDailyTask, updateProfileAvatar } from '../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import VerificationBadge from '../components/VerificationBadge.jsx';
import { Card, ErrorMessage, Field, Loading, Page, PageLink } from '../components/UI.jsx';

const formatPoints = (points) => (Number(points) || 0).toLocaleString();
const formatPublicId = (value) => {
  const id = String(value ?? '');
  return /^\d{1,6}$/.test(id) ? id.padStart(6, '0') : null;
};
const MAX_AVATAR_BYTES = 600 * 1024;

async function compressAvatar(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 10 MB.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not process this image. Please try another file.');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.85, 0.7, 0.55, 0.4]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      if (!blob) throw new Error('Could not process this image. Please try another file.');
      if (blob.size <= MAX_AVATAR_BYTES) {
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('Could not read the processed image.'));
          reader.readAsDataURL(blob);
        });
      }
    }
    throw new Error('Choose a smaller image; the processed avatar must be under 600 KB.');
  } finally {
    bitmap.close();
  }
}

function LevelCard({ title, icon, level }) {
  if (!level) return null;
  return (
    <Card className="level-card">
      <div className="level-card-heading">
        <span className="level-medal" aria-hidden="true">{icon}</span>
        <div>
          <p className="eyebrow">{title}</p>
          <h3>Level {level.level} · {level.title}</h3>
        </div>
        <span className="medal-label">{level.medal}</span>
      </div>
      <div className="level-progress-copy">
        <span>{formatPoints(level.points)} points</span>
        {level.nextLevel
          ? <span>Level {level.nextLevel}: {formatPoints(level.nextLevelPoints)}</span>
          : <span>Maximum level</span>}
      </div>
      <div
        className="profile-progress-track"
        role="progressbar"
        aria-label={`${title} progress`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={level.progress}
      >
        <span style={{ width: `${level.progress}%` }} />
      </div>
    </Card>
  );
}

function formatDuration(seconds) {
  const minutes = Math.floor((Number(seconds) || 0) / 60);
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function HostTaskCard({ task, busy, onClaim }) {
  const progress = Math.min(100, Math.round((task.progressSeconds / task.targetSeconds) * 100));
  return (
    <div className="host-task">
      <div className="host-task-heading">
        <div>
          <h3>{task.title}</h3>
          <p className="muted">{task.description}</p>
        </div>
        <strong>{task.id === 'onMic' ? '$0.90' : '3,000 diamonds'}</strong>
      </div>
      <div className="host-task-progress-copy">
        <span>{formatDuration(task.progressSeconds)} / {formatDuration(task.targetSeconds)}</span>
        <span>{progress}%</span>
      </div>
      <div
        className="profile-progress-track"
        role="progressbar"
        aria-label={`${task.title} progress`}
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={progress}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      {task.claimed ? (
        <p className="host-task-state" role="status">Reward claimed today</p>
      ) : task.claimable ? (
        <button
          className="button button-primary host-task-claim"
          type="button"
          onClick={() => onClaim(task.id)}
          disabled={busy}
        >
          {busy ? 'Claiming…' : `Claim ${task.rewardDiamonds.toLocaleString()} diamonds`}
        </button>
      ) : (
        <p className="host-task-state">Daily reset at 00:00 EAT</p>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [hostTasks, setHostTasks] = useState(null);
  const [error, setError] = useState('');
  const [taskError, setTaskError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const [claimingTask, setClaimingTask] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [roomTitle, setRoomTitle] = useState('');
  const [roomCategory, setRoomCategory] = useState('For You');
  const [roomBanner, setRoomBanner] = useState('');
  const [roomError, setRoomError] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);

  const loadHostTasks = useCallback(() => {
    getHostDailyTasks()
      .then(setHostTasks)
      .catch((requestError) => {
        setTaskError(requestError.response?.data?.message || requestError.message || 'Could not load daily host tasks.');
      });
  }, []);

  useEffect(() => {
    let active = true;
    getProfile()
      .then((data) => {
        if (active) {
          setProfile({
            ...data,
            ...(user?.hasActiveRoom ? { hasActiveRoom: true, roomId: user.roomId } : {}),
          });
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message);
      });
    return () => {
      active = false;
    };
  }, [user?.hasActiveRoom, user?.roomId]);

  useEffect(() => {
    if (profile?.role !== 'HOST') return undefined;
    loadHostTasks();
    const interval = window.setInterval(loadHostTasks, 15_000);
    return () => window.clearInterval(interval);
  }, [loadHostTasks, profile?.role]);

  const copyUserId = async () => {
    const publicId = formatPublicId(profile?.publicId);
    if (!publicId) return;
    try {
      await navigator.clipboard.writeText(publicId);
      setCopyStatus('User ID copied.');
    } catch (copyError) {
      setCopyStatus(`Could not copy User ID: ${copyError.message}`);
    }
  };

  const uploadAvatar = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const avatar = await compressAvatar(file);
      const result = await updateProfileAvatar(avatar);
      setProfile(result.user);
      localStorage.setItem('user', JSON.stringify(result.user));
    } catch (uploadError) {
      setAvatarError(uploadError.response?.data?.message || uploadError.message);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const claimTask = async (taskId) => {
    setClaimingTask(taskId);
    setTaskError('');
    try {
      const result = await claimHostDailyTask(taskId);
      setHostTasks(result.progress);
      setProfile((current) => current ? { ...current, diamonds: result.diamonds } : current);
    } catch (claimError) {
      setTaskError(claimError.response?.data?.message || claimError.message || 'Could not claim this reward.');
    } finally {
      setClaimingTask('');
    }
  };

  const setupRoom = async (event) => {
    event.preventDefault();
    setRoomError('');
    setCreatingRoom(true);
    try {
      const result = await createRoom({
        title: roomTitle.trim(),
        category: roomCategory,
        banner: roomBanner.trim(),
      });
      const room = result?.room || result;
      const roomId = room?._id || room?.id;
      if (!roomId) throw new Error('The server did not return the created room ID.');
      const updatedProfile = { ...profile, hasActiveRoom: true, roomId: String(roomId) };
      setProfile(updatedProfile);
      updateUser(updatedProfile);
      navigate(`/live/${encodeURIComponent(String(roomId))}`);
    } catch (requestError) {
      setRoomError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setCreatingRoom(false);
    }
  };

  const canOpenAgency = profile?.role === 'AGENT' || profile?.role === 'HOST';
  const isHost = profile?.role === 'HOST';
  const publicId = formatPublicId(profile?.publicId);

  return (
    <Page title="My profile" eyebrow="YOUR MESO LIVE ACCOUNT">
      <Card className="profile-card">
        <label className={`profile-avatar-control${uploadingAvatar ? ' is-uploading' : ''}`}>
          <span className="profile-avatar">
            {profile?.avatar || profile?.profilePicture
              ? <img src={profile.avatar || profile.profilePicture} alt="" />
              : profile?.username?.[0]?.toUpperCase() || 'M'}
          </span>
          <span className="profile-avatar-edit" aria-hidden="true">
            <Camera size={16} />
          </span>
          <input
            className="profile-avatar-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Upload profile picture"
            disabled={!profile || uploadingAvatar}
            onChange={uploadAvatar}
          />
        </label>
        {uploadingAvatar && <p className="muted" role="status">Updating profile picture…</p>}
        {avatarError && <p className="form-error" role="alert">{avatarError}</p>}
        {error ? <p className="form-error" role="alert">{error}</p> : !profile ? <Loading>Loading profile…</Loading> : (
          <>
            <h2>{profile.username || 'Meso Live member'}</h2>
            {publicId != null && (
              <div className="profile-user-id">
                <span>ID: {publicId}</span>
                <button className="button button-quiet button-small" type="button" onClick={copyUserId}>
                  Copy
                </button>
              </div>
            )}
            {copyStatus && <p className="profile-copy-status" role="status">{copyStatus}</p>}
            <p className="muted">{profile.email || 'Email not provided'}</p>
            <VerificationBadge verified={profile.isVerified === true || profile.verified === true} />
            <div className="stats-row">
              <div><strong>{formatPoints(profile.coins)}</strong><span>Coins</span></div>
              <div><strong>{formatPoints(profile.diamonds)}</strong><span>Diamonds</span></div>
            </div>
          </>
        )}
      </Card>

      {profile && (
        <div className="profile-level-grid">
          <LevelCard title="WEALTH LEVEL" icon="🏅" level={profile.wealthLevel} />
          <LevelCard title="CHARM LEVEL" icon="✨" level={profile.charmLevel} />
        </div>
      )}

      {isHost && (
        profile.hasActiveRoom && profile.roomId ? (
          <Card className="profile-room-setup">
            <p className="eyebrow">YOUR HOST ROOM</p>
            <h2>Room setup complete</h2>
            <p className="muted">Your room ID is {profile.roomId}. Your room stays available from Home.</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => navigate(`/live/${encodeURIComponent(String(profile.roomId))}`)}
            >
              Enter My Room
            </button>
          </Card>
        ) : (
          <Card className="profile-room-setup">
            <p className="eyebrow">HOST TOOLS</p>
            <h2>Set up your room</h2>
            <p className="muted">Create your room once. You can return to it anytime from Home.</p>
            <form className="form-stack" onSubmit={setupRoom}>
              <Field
                label="Room name"
                type="text"
                maxLength={100}
                required
                value={roomTitle}
                onChange={(event) => setRoomTitle(event.target.value)}
              />
              <label className="field">
                <span>Category</span>
                <select value={roomCategory} onChange={(event) => setRoomCategory(event.target.value)}>
                  {['For You', 'Party', 'Music', 'Chat', 'Ethiopia'].map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </label>
              <Field
                label="Cover image URL (optional)"
                type="url"
                value={roomBanner}
                onChange={(event) => setRoomBanner(event.target.value)}
              />
              <ErrorMessage>{roomError}</ErrorMessage>
              <button className="button button-primary" type="submit" disabled={creatingRoom}>
                {creatingRoom ? 'Creating room…' : 'Create my room'}
              </button>
            </form>
          </Card>
        )
      )}

      {isHost && (
        <Card title="Daily Host Tasks" className="host-tasks-card">
          <p className="muted host-task-reset">Progress resets daily at 00:00 East Africa Time.</p>
          {taskError && <p className="form-error" role="alert">{taskError}</p>}
          {!hostTasks ? <Loading>Loading host task progress…</Loading> : (
            <div className="host-task-list">
              {hostTasks.tasks.map((task) => (
                <HostTaskCard
                  key={task.id}
                  task={task}
                  busy={claimingTask === task.id}
                  onClaim={claimTask}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="link-card">
        <PageLink to="/profile/settings" icon="⚙️">Settings</PageLink>
        {isHost && <PageLink to="/profile/wallet" icon="💎">Withdraw Earnings</PageLink>}
        {canOpenAgency && <PageLink to="/profile/agency" icon="🏢">Agency Center</PageLink>}
        <PageLink to="/profile/invite" icon="🎁">Invite friends</PageLink>
        <PageLink to="/profile/face-verify" icon="✓">Face verification</PageLink>
        <PageLink to="/profile/recharge" icon="🪙">Recharge coins</PageLink>
      </Card>
    </Page>
  );
}

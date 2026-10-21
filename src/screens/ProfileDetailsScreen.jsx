import { Building2, Copy, Edit3, MessageCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { followUser, getProfile, getUserProfile, unfollowUser } from '../api.js';
import { Card, Loading, Page } from '../components/UI.jsx';

const imageOf = (profile) => profile?.profilePicture || profile?.avatar || '';
const idOf = (profile) => String(profile?._id || profile?.id || profile?.userId || profile?.publicId || '');
const calculateAge = (birthday) => {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

export default function ProfileDetailsScreen() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [viewer, setViewer] = useState(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [followError, setFollowError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getUserProfile(userId), getProfile()])
      .then(([data, current]) => {
        if (active) {
          setProfile(data);
          setViewer(current);
          const profileId = idOf(data);
          const currentId = idOf(current);
          if (profileId && currentId && profileId !== currentId) {
            const followingList = Array.isArray(current.following) ? current.following : [];
            const like = followingList.some((entry) => String(entry?._id || entry?.id || entry?.userId || entry) === String(profileId));
            setIsFollowing(Boolean(like));
          } else {
            setIsFollowing(false);
          }
        }
      })
      .catch((requestError) => {
        if (active) setProfileError(requestError.response?.data?.message || requestError.message || 'Could not load this profile.');
      });
    return () => { active = false; };
  }, [userId]);

  const isOwnProfile = useMemo(() => {
    if (!profile || !viewer) return false;
    return idOf(profile) === idOf(viewer) || (profile.publicId && String(profile.publicId) === String(viewer.publicId));
  }, [profile, userId, viewer]);

  const handleFollowToggle = async () => {
    if (!profile || !viewer || isOwnProfile || followLoading) return;

    const targetUserId = idOf(profile);
    if (!targetUserId) return;

    setFollowLoading(true);
    setFollowError('');

    try {
      if (isFollowing) {
        await unfollowUser(targetUserId);
        setIsFollowing(false);
      } else {
        await followUser(targetUserId);
        setIsFollowing(true);
      }
    } catch (requestError) {
      setFollowError(requestError.response?.data?.message || requestError.message || 'Something went wrong while updating follow status.');
    } finally {
      setFollowLoading(false);
    }
  };

  if (profileError) return <Page title="Profile"><p className="form-error" role="alert">{profileError}</p></Page>;
  if (!profile) return <Page title="Profile"><Loading>Loading profile…</Loading></Page>;

  const picture = imageOf(profile);
  const displayName = profile.name || profile.username || 'Meso Live member';
  const publicId = profile.customId || profile.publicId || profile.id || profile._id;
  const roomId = profile.roomId;
  const age = profile.age ?? calculateAge(profile.birthday);
  const belongsToAgency = Boolean(profile.agencyId) &&
    String(profile.agencyStatus || '').toUpperCase() === 'APPROVED';
  const isAgent = profile.isAgent === true || String(profile.role || '').toLowerCase() === 'agent';
  const isHost = !belongsToAgency && !isAgent &&
    (profile.isHost === true || String(profile.role || '').toLowerCase() === 'host');
  const wealthLevel = profile.wealthLevel?.level || profile.wealthLevel || profile.level || 1;
  const charmLevel = profile.charmLevel?.level || profile.charmLevel || 1;
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(String(publicId));
      setCopyStatus('User ID copied.');
    } catch {
      setCopyStatus('Could not copy User ID.');
    }
  };

  return (
    <Page
      title={displayName}
      eyebrow="PROFILE DETAILS"
      actions={isOwnProfile ? <button className="profile-top-action" type="button" onClick={() => navigate('/profile/edit')} aria-label="Edit profile"><Edit3 size={18} /></button> : null}
    >
      <section className="profile-details-hero card">
        <div className="profile-cover" style={profile.cover ? { backgroundImage: `url(${profile.cover})` } : undefined} />
        <div className="profile-details-identity">
          <span className="profile-details-avatar">
            {picture ? <img src={picture} alt="" /> : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
          </span>
          <div className="profile-details-copy">
            <h2>{displayName}</h2>
            <p className="profile-id-row">ID: <strong>{publicId}</strong><button className="profile-copy-button" type="button" onClick={copyId} aria-label="Copy user ID"><Copy size={13} /></button></p>
            {!isOwnProfile && <span className={`profile-status-badge status-${String(profile.status || 'OFFLINE').toLowerCase()}`}><i /> {profile.status || 'OFFLINE'}</span>}
          </div>
        </div>
        {!isOwnProfile && (
          <button
            className="button button-primary button-small"
            type="button"
            onClick={handleFollowToggle}
            disabled={followLoading}
            aria-label={isFollowing ? 'Unfollow user' : 'Follow user'}
          >
            {followLoading ? 'Please wait…' : isFollowing ? 'Following' : '+ Follow'}
          </button>
        )}
        {followError && <p className="form-error" role="alert">{followError}</p>}
        <div className="profile-badges profile-details-badges">
          {profile.country && <span className="profile-pill">{profile.countryFlag || ''} {profile.country}</span>}
          {profile.gender && <span className="profile-pill">{profile.gender === 'Male' ? '♂️ Male' : profile.gender === 'Female' ? '♀️ Female' : '⚧ Other'}</span>}
          {age !== null && <span className="profile-pill">Age {age}</span>}
          {belongsToAgency && <span className="profile-pill profile-agency-badge"><Building2 size={12} aria-hidden="true" /> AGENCY</span>}
          {isHost && <span className="profile-pill profile-host-badge">Host</span>}
          {profile.isVip && <span className="profile-pill">VIP</span>}
          {profile.isVerified && <span className="profile-pill"><ShieldCheck size={12} /> Verified</span>}
          <span className="profile-pill">Wealth Lv {wealthLevel}</span>
          <span className="profile-pill">Charm Lv {charmLevel}</span>
        </div>
        {copyStatus && <p className="profile-copy-status" role="status">{copyStatus}</p>}
        <p className="profile-signature">{profile.bio || 'No signature yet.'}</p>
      </section>

      {roomId && (
        <Card className="profile-chatroom-card">
          <div className="profile-chatroom-thumb">
            {profile.roomAvatar ? <img src={profile.roomAvatar} alt="" /> : <MessageCircle size={24} />}
          </div>
          <div className="profile-chatroom-copy"><p className="eyebrow">CHATROOM</p><h2>{profile.roomTitle || profile.roomName || 'Live audio room'}</h2><span className="muted">Join the conversation</span></div>
          <button className="button button-primary button-small" type="button" onClick={() => navigate(`/room/${encodeURIComponent(String(roomId))}`)}>Enter</button>
        </Card>
      )}

      {Array.isArray(profile.album) && profile.album.length > 0 && (
        <Card title={`Album (${profile.album.length}/6)`} className="profile-album-card">
          <div className="profile-album-grid">{profile.album.map((image, index) => <img key={`${image}-${index}`} src={image} alt={`Album ${index + 1}`} />)}</div>
        </Card>
      )}
    </Page>
  );
}

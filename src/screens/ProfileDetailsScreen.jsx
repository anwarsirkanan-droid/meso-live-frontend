import { Edit3, MapPin, MessageCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getProfile, getUserProfile } from '../api.js';
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
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getUserProfile(userId), getProfile()])
      .then(([data, current]) => {
        if (active) {
          setProfile(data);
          setViewer(current);
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || requestError.message || 'Could not load this profile.');
      });
    return () => { active = false; };
  }, [userId]);

  const isOwnProfile = useMemo(() => {
    if (!profile || !viewer) return false;
    return idOf(profile) === idOf(viewer) || (profile.publicId && String(profile.publicId) === String(viewer.publicId));
  }, [profile, userId, viewer]);

  if (error) return <Page title="Profile"><p className="form-error" role="alert">{error}</p></Page>;
  if (!profile) return <Page title="Profile"><Loading>Loading profile…</Loading></Page>;

  const picture = imageOf(profile);
  const displayName = profile.name || profile.username || 'Meso Live member';
  const publicId = profile.publicId || profile._id;
  const roomId = profile.roomId;
  const age = calculateAge(profile.birthday);

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
            <p className="profile-id-row">ID: <strong>{publicId}</strong></p>
            {!isOwnProfile && <span className={`profile-status-badge status-${String(profile.status || 'OFFLINE').toLowerCase()}`}><i /> {profile.status || 'OFFLINE'}</span>}
          </div>
        </div>
        <div className="profile-badges profile-details-badges">
          {profile.isVip && <span className="profile-pill">VIP</span>}
          {profile.isVerified && <span className="profile-pill"><ShieldCheck size={12} /> Verified</span>}
          <span className="profile-pill">Level {profile.level || profile.wealthLevel?.level || 1}</span>
          {profile.gender && <span className="profile-pill">{profile.gender}</span>}
          {age !== null && <span className="profile-pill">Age {age}</span>}
          {profile.country && <span className="profile-pill"><MapPin size={12} /> {profile.country}</span>}
        </div>
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

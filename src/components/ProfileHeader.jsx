import { Copy, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const number = (value) => (Number(value) || 0).toLocaleString();

export default function ProfileHeader({ profile, onCopy }) {
  const navigate = useNavigate();
  if (!profile) return null;
  const picture = profile.profilePicture || profile.avatar || profile.picture;
  const publicId = String(profile.publicId || profile.userId || profile._id || profile.id || '');
  const role = String(profile.role || 'USER').toUpperCase();
  return (
    <section className="profile-header card">
      <button className="profile-header-avatar" type="button" onClick={() => navigate('/profile/edit')} aria-label="Change profile picture">
        {picture ? <img src={picture} alt="" /> : <span>{profile.username?.[0]?.toUpperCase() || 'M'}</span>}
        <small>Change</small>
      </button>
      <div className="profile-header-main">
        <div className="profile-header-title"><div><p className="eyebrow">YOUR MESO LIVE PROFILE</p><h2>@{profile.username || 'member'}</h2><p className="muted">{profile.fullName || profile.name || profile.email || 'Meso Live member'}</p></div><button className="button button-quiet button-small" type="button" onClick={() => navigate('/profile/edit')}><Pencil size={14} /> Edit Profile</button></div>
        <div className="profile-badges"><span className={`role-badge role-${role.toLowerCase()}`}>{role}</span><span className="level-badge">Wealth Lv.{profile.wealthLevel?.level || profile.wealthLevel || 1} {profile.wealthLevel?.medal || 'Bronze'}</span><span className="level-badge">Charm Lv.{profile.charmLevel?.level || profile.charmLevel || 1} {profile.charmLevel?.medal || 'Bronze'}</span></div>
        <div className="profile-id-row"><span>Meso Live ID: <strong>{publicId || 'Not assigned'}</strong></span>{publicId && <button className="button button-quiet button-small" type="button" onClick={() => onCopy(publicId)}><Copy size={14} /> Copy</button>}</div>
        <div className="profile-follow-stats"><button type="button" onClick={() => navigate('/profile/followers')}><strong>{number(profile.followersCount ?? profile.followers?.length)}</strong><span>Followers</span></button><button type="button" onClick={() => navigate('/profile/following')}><strong>{number(profile.followingCount ?? profile.following?.length)}</strong><span>Following</span></button></div>
      </div>
    </section>
  );
}

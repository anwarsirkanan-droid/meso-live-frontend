import { Building2, ChevronRight, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const number = (value) => (Number(value) || 0).toLocaleString();

export default function ProfileHeader({ profile, onCopy }) {
  const navigate = useNavigate();
  if (!profile) return null;

  const picture = profile.profilePicture || profile.avatar || profile.picture;
  const publicId = String(profile.publicId || profile.userId || profile._id || profile.id || '');
  const role = String(profile.role || '').toUpperCase();
  const belongsToAgency = Boolean(profile.agencyId || profile.agency);
  const isAgent = profile.isAgent === true || role === 'AGENT';
  const isHost = !isAgent && (profile.isHost === true || role === 'HOST');
  const displayName = profile.fullName || profile.name || profile.username || 'Meso Live member';
  const genderBadge = profile.gender === 'Male' ? '♂️ Male' : profile.gender === 'Female' ? '♀️ Female' : profile.gender ? '⚧ Other' : '';
  const wealthLevel = profile.wealthLevel?.level || profile.wealthLevel || 1;
  const charmLevel = profile.charmLevel?.level || profile.charmLevel || 1;
  const editProfile = () => navigate('/profile/edit');

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      editProfile();
    }
  };

  return (
    <section className="profile-header card">
      <div className="profile-header-content" role="button" tabIndex="0" onClick={editProfile} onKeyDown={handleKeyDown} aria-label="Edit profile">
        <span className="profile-header-avatar">
          {picture ? <img src={picture} alt="" /> : <span>{profile.username?.[0]?.toUpperCase() || 'M'}</span>}
        </span>
        <div className="profile-header-main">
          <h2 className="profile-display-name">{displayName}</h2>
          <div className="profile-id-row">
            <span>ID: <strong>{publicId || 'Not assigned'}</strong></span>
            {publicId && <button className="profile-copy-button" type="button" aria-label="Copy user ID" onClick={(event) => { event.stopPropagation(); onCopy(publicId); }}><Copy size={13} /></button>}
          </div>
          <div className="profile-badges" aria-label="Profile badges">
            {belongsToAgency && <span className="profile-pill profile-agency-badge"><Building2 size={12} aria-hidden="true" /> AGENCY</span>}
            {profile.country && <span className="profile-pill">{profile.countryFlag || ''} {profile.country}</span>}
            {genderBadge && <span className="profile-pill">{genderBadge}</span>}
            {isHost && <span className="profile-pill profile-host-badge">Host</span>}
            <span className="profile-pill">Wealth Lv {wealthLevel}</span>
            <span className="profile-pill">Charm Lv {charmLevel}</span>
          </div>
        </div>
        <button
          className="profile-header-arrow"
          type="button"
          aria-label="Open profile details"
          onClick={(event) => {
            event.stopPropagation();
            navigate(publicId ? `/profile/${encodeURIComponent(publicId)}` : '/profile');
          }}
        >
          <ChevronRight size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="profile-follow-stats" aria-label="Social stats">
        <button type="button" onClick={() => navigate('/profile/followers')}><strong>{number(profile.followersCount ?? profile.followers?.length)}</strong><span>Followed</span></button>
        <button type="button" onClick={() => navigate('/profile/following')}><strong>{number(profile.followingCount ?? profile.following?.length)}</strong><span>Following</span></button>
        <div><strong>{number(profile.friendsCount ?? profile.friends?.length)}</strong><span>Friends</span></div>
      </div>
    </section>
  );
}

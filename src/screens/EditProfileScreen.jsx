import { ImagePlus, Save, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProfile, updateProfile } from '../api.js';
import { Card, Field, Loading, Page } from '../components/UI.jsx';

const toDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

export default function EditProfileScreen() {
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [form, setForm] = useState(null);
  const [state, setState] = useState('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile().then((profile) => {
      setForm({
        username: profile.username || '',
        phoneNumber: profile.phoneNumber || '',
        country: profile.country || '',
        gender: profile.gender || '',
        birthday: profile.birthday ? String(profile.birthday).slice(0, 10) : '',
        bio: profile.bio || '',
        profilePicture: profile.profilePicture || profile.avatar || '',
        cover: profile.cover || '',
        album: Array.isArray(profile.album) ? profile.album : [],
      });
      setState('idle');
    }).catch((requestError) => { setError(requestError.response?.data?.message || 'Could not load your profile.'); setState('error'); });
  }, []);

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const addImages = async (event) => {
    const files = [...event.target.files].slice(0, 6 - form.album.length);
    const images = await Promise.all(files.map(toDataUrl));
    setField('album', [...form.album, ...images]);
    event.target.value = '';
  };
  const save = async (event) => {
    event.preventDefault();
    setState('saving');
    setError('');
    try {
      await updateProfile(form);
      navigate('/profile');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not save your profile.');
      setState('idle');
    }
  };

  if (!form) return <Page title="Edit profile"><Loading>{state === 'error' ? error : 'Loading profile…'}</Loading></Page>;
  return (
    <Page title="Edit profile" actions={<button className="profile-save-action" type="submit" form="edit-profile-form" disabled={state === 'saving'}><Save size={16} /> {state === 'saving' ? 'Saving…' : 'Save'}</button>}>
      <form id="edit-profile-form" className="form-stack profile-edit-form" onSubmit={save}>
        <Card title={`Album (${form.album.length}/6)`}>
          <div className="profile-album-grid profile-edit-album">{form.album.map((image, index) => <div className="profile-album-item" key={`${image}-${index}`}><img src={image} alt="" /><button type="button" onClick={() => setField('album', form.album.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove album image"><X size={14} /></button></div>)}<button className="profile-album-add" type="button" onClick={() => fileRef.current?.click()} disabled={form.album.length >= 6}><ImagePlus size={22} /><span>Add photo</span></button></div>
          <input ref={fileRef} className="profile-hidden-file" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages} />
        </Card>
        <Card title="Profile information">
          <Field label="Nickname" value={form.username} required onChange={(event) => setField('username', event.target.value)} />
          <label className="field"><span>Gender</span><select value={form.gender} onChange={(event) => setField('gender', event.target.value)}><option value="">Select gender</option><option>Male</option><option>Female</option><option>Other</option></select></label>
          <Field label="Birthday" type="date" value={form.birthday} onChange={(event) => setField('birthday', event.target.value)} />
          <Field label="Country" value={form.country} onChange={(event) => setField('country', event.target.value)} />
          <label className="field"><span>Bio / Signature</span><textarea maxLength="240" value={form.bio} onChange={(event) => setField('bio', event.target.value)} /></label>
          <Field label="Profile picture URL or data" value={form.profilePicture} onChange={(event) => setField('profilePicture', event.target.value)} />
        </Card>
        {error && <p className="form-error" role="alert">{error}</p>}
      </form>
    </Page>
  );
}

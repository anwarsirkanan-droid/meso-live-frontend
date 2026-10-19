import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkUsernameAvailability, getProfile, saveProfileSetup } from '../api.js';
import { ErrorMessage } from '../components/UI.jsx';

const countries = [
  'Australia', 'Brazil', 'Canada', 'China', 'Egypt', 'Ethiopia', 'France',
  'Germany', 'Ghana', 'India', 'Indonesia', 'Ireland', 'Italy', 'Japan',
  'Kenya', 'Mexico', 'Netherlands', 'New Zealand', 'Nigeria', 'Pakistan',
  'Philippines', 'Rwanda', 'Saudi Arabia', 'South Africa', 'South Korea',
  'Spain', 'Sweden', 'Turkey', 'Uganda', 'United Arab Emirates',
  'United Kingdom', 'United States',
];

const MAX_IMAGE_SIZE = 600 * 1024;

export default function ProfileSetup() {
  const [form, setForm] = useState({
    username: '',
    phoneNumber: '',
    country: '',
    gender: '',
    bio: '',
    profilePicture: '',
  });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState('');
  const [profileLoadAttempt, setProfileLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [usernameCheck, setUsernameCheck] = useState({ status: 'idle', message: '' });
  const requestId = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    setLoadingProfile(true);
    setProfileLoadError('');
    getProfile()
      .then((data) => {
        if (!active) return;
        const profile = data;
        if (profile?.profileComplete) {
          navigate('/', { replace: true });
          return;
        }
        setForm((current) => ({
          ...current,
          username: profile?.username || '',
          phoneNumber: profile?.phoneNumber || '',
          country: profile?.country || '',
          gender: profile?.gender || '',
          bio: profile?.bio || '',
          profilePicture: profile?.profilePicture || profile?.avatar || '',
        }));
      })
      .catch((requestError) => {
        if (active) {
          setProfileLoadError(
            requestError.code === 'ECONNABORTED'
              ? 'The profile request timed out. Check your connection and try again.'
              : requestError.response?.data?.message ||
                requestError.response?.data?.error ||
                requestError.message ||
                'Could not load your profile.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingProfile(false);
      });

    return () => {
      active = false;
    };
  }, [navigate, profileLoadAttempt]);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    if (field === 'username') {
      requestId.current += 1;
      setUsernameCheck({ status: 'idle', message: '' });
    }
  };

  const checkUsername = async () => {
    const username = form.username.trim();
    requestId.current += 1;
    const currentRequest = requestId.current;
    if (username.length < 3 || username.length > 24) {
      setUsernameCheck({ status: 'error', message: 'Username must be between 3 and 24 characters.' });
      return;
    }

    setUsernameCheck({ status: 'checking', message: 'Checking username…' });
    try {
      const result = await checkUsernameAvailability(username);
      if (currentRequest !== requestId.current) return;
      setUsernameCheck(result.available
        ? { status: 'available', message: 'Username is available.' }
        : { status: 'taken', message: 'That username is already taken.' });
    } catch (requestError) {
      if (currentRequest !== requestId.current) return;
      setUsernameCheck({
        status: 'error',
        message: requestError.response?.data?.message || 'Could not check username availability.',
      });
    }
  };

  const choosePicture = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    if (!file.type.startsWith('image/')) {
      setError('Choose a valid image file.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError('Choose an image smaller than 600 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateField('profilePicture', reader.result);
        setError('');
      } else {
        setError('Could not read the selected image.');
      }
    };
    reader.onerror = () => setError('Could not read the selected image.');
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (usernameCheck.status === 'taken') {
      setError('That username is already taken.');
      return;
    }
    setSaving(true);
    try {
      const result = await saveProfileSetup({
        ...form,
        username: form.username.trim(),
        phoneNumber: form.phoneNumber.trim(),
        country: form.country.trim(),
        bio: form.bio.trim(),
      });
      if (result?.user) localStorage.setItem('user', JSON.stringify(result.user));
      navigate('/', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return <main className="auth-page" aria-busy="true"><p className="muted" role="status">Loading your profile…</p></main>;
  }

  if (profileLoadError) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <p className="eyebrow">PROFILE SETUP</p>
          <h1>Could not load your profile</h1>
          <p className="notice-error" role="alert">{profileLoadError}</p>
          <div className="room-controls">
            <button
              className="button button-primary"
              type="button"
              onClick={() => setProfileLoadAttempt((attempt) => attempt + 1)}
            >
              Try again
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login', { replace: true });
              }}
            >
              Back to sign in
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="auth-page profile-setup-page">
      <section className="auth-card profile-setup-card">
        <p className="eyebrow">ONE LAST STEP</p>
        <h1>Set up your profile</h1>
        <p className="profile-setup-intro">Add a few details to finish creating your Meso Live profile.</p>
        <form className="form-stack" onSubmit={submit}>
          <label className="profile-picture-field">
            {form.profilePicture
              ? <img src={form.profilePicture} alt="Profile preview" />
              : <span aria-hidden="true">{form.username.charAt(0).toUpperCase() || 'M'}</span>}
            <span>Change profile picture</span>
            <input type="file" accept="image/*" onChange={choosePicture} />
          </label>

          <label className="field">
            <span>Username</span>
            <input
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={24}
              required
              value={form.username}
              onChange={(event) => updateField('username', event.target.value)}
              onBlur={checkUsername}
              aria-describedby="username-status"
            />
            <span
              className={`username-status username-status-${usernameCheck.status}`}
              id="username-status"
              aria-live="polite"
            >
              {usernameCheck.message}
            </span>
          </label>

          <label className="field">
            <span>Phone number</span>
            <input
              type="tel"
              autoComplete="tel"
              required
              value={form.phoneNumber}
              onChange={(event) => updateField('phoneNumber', event.target.value)}
            />
          </label>

          <label className="field">
            <span>Country</span>
            <select required value={form.country} onChange={(event) => updateField('country', event.target.value)}>
              <option value="">Select your country</option>
              {countries.map((country) => <option key={country} value={country}>{country}</option>)}
            </select>
          </label>

          <fieldset className="gender-field">
            <legend>Gender</legend>
            <div className="gender-options">
              {['Male', 'Female', 'Other'].map((gender) => (
                <label key={gender}>
                  <input
                    type="radio"
                    name="gender"
                    value={gender}
                    required
                    checked={form.gender === gender}
                    onChange={(event) => updateField('gender', event.target.value)}
                  />
                  <span>{gender}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Bio <span className="muted">(optional)</span></span>
            <textarea
              rows="3"
              maxLength={300}
              value={form.bio}
              onChange={(event) => updateField('bio', event.target.value)}
            />
          </label>

          <ErrorMessage>{error}</ErrorMessage>
          <button className="button button-primary button-full" type="submit" disabled={saving}>
            {saving ? 'Saving profile…' : 'Save & Continue'}
          </button>
        </form>
      </section>
    </main>
  );
}

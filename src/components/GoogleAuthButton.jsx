import { GoogleLogin } from '@react-oauth/google';
import { googleLogin } from '../api.js';

function saveSession(data) {
  const token = data?.token || data?.accessToken;
  if (!token) throw new Error('Google sign-in succeeded but the server did not return a token.');
  localStorage.setItem('token', token);
  if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
}

export default function GoogleAuthButton({ onSuccess, onError, onLoading }) {
  const handleSuccess = async ({ credential }) => {
    if (!credential) {
      onError('Google did not provide a credential. Please try again.');
      return;
    }
    onLoading(true);
    try {
      const data = await googleLogin(credential);
      saveSession(data);
      onSuccess(data);
    } catch (error) {
      onError(error.response?.data?.message || error.response?.data?.error || error.message);
    } finally {
      onLoading(false);
    }
  };

  return (
    <div className="google-button">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={() => onError('Google sign-in could not be started. Check the Google client ID and try again.')}
        text="continue_with"
        shape="pill"
        width="320"
      />
    </div>
  );
}

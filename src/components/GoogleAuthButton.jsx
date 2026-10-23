import { GoogleLogin } from '@react-oauth/google';
import { googleLogin } from '../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

function GoogleAuthButton({ onSuccess, onError, onLoading }) {
  const { login: saveSession } = useAuth();

  const handleSuccess = async ({ credential }) => {
    if (!credential) {
      onError('Google did not provide a credential. Please try again.');
      return;
    }
    onLoading(true);
    try {
      const data = await googleLogin(credential);
      const token = data?.token || data?.accessToken;
      if (!token) throw new Error('Google sign-in succeeded but the server did not return a token.');
      saveSession(data?.user, token);
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
        theme="filled_black"
        shape="rectangular"
        size="large"
        width="350"
      />
    </div>
  );
}

export default GoogleAuthButton;

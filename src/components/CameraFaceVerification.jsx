import { useEffect, useRef, useState } from 'react';
import { getFaceVerificationStatus, submitFaceVerification } from '../api.js';
import { ErrorMessage } from './UI.jsx';

export default function CameraFaceVerification({ onSubmitted }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('NOT_SUBMITTED');
  const [snapshot, setSnapshot] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  useEffect(() => {
    getFaceVerificationStatus().then((result) => setStatus(result.status || 'NOT_SUBMITTED')).catch(() => null);
    let savedDeviceId = localStorage.getItem('mesoLive.faceVerificationDeviceId');
    if (!savedDeviceId) {
      savedDeviceId = window.crypto?.randomUUID?.() || `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem('mesoLive.faceVerificationDeviceId', savedDeviceId);
    }
    setDeviceId(savedDeviceId);
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [streamRef.current]);

  const startCamera = async () => {
    setError('');
    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      if (videoRef.current) videoRef.current.srcObject = streamRef.current;
    } catch (cameraError) {
      setError(cameraError.name === 'NotAllowedError' ? 'Camera permission is required for face verification.' : 'Could not access the live camera.');
    }
  };

  const capture = async () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return setError('Start the live camera before capturing.');
    if (window.FaceDetector) {
      try {
        const faces = await new window.FaceDetector({ fastMode: true }).detect(video);
        if (!faces.length) return setError('No face detected. Center your face in the live camera and try again.');
      } catch {
        // The backend performs the final face validation when browser detection is unavailable.
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    setSnapshot(canvas.toDataURL('image/jpeg', 0.85));
    setError('');
  };

  const submit = async () => {
    if (!snapshot) return setError('Capture a live camera snapshot first.');
    setBusy(true);
    setError('');
    try {
      const result = await submitFaceVerification(snapshot, deviceId);
      const nextStatus = result.verification?.status || 'APPROVED';
      setStatus(nextStatus);
      setSnapshot('');
      onSubmitted?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not submit face verification.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'APPROVED') return <p className="success-message" role="status">Face verification approved. Host Tasks are unlocked.</p>;
  return <div className="camera-verification">
    {status === 'PENDING_APPROVAL' && <p className="verification-pending" role="status">Verification Pending Approval</p>}
    {status === 'REJECTED' && <p className="form-error" role="alert">Verification was rejected. Capture a new live snapshot to resubmit.</p>}
    <p className="muted">Live camera snapshot only. Gallery and file uploads are disabled. Device verification is tied to this device.</p>
    <video ref={videoRef} className="verification-camera" autoPlay playsInline muted aria-label="Live face verification camera" />
    <div className="camera-verification-actions"><button className="button button-secondary" type="button" onClick={startCamera} disabled={busy}>Start camera</button><button className="button button-secondary" type="button" onClick={capture} disabled={busy}>Capture snapshot</button><button className="button button-primary" type="button" onClick={submit} disabled={!snapshot || busy}>{busy ? 'Submitting…' : 'Submit for review'}</button></div>
    <ErrorMessage>{error}</ErrorMessage>
  </div>;
}

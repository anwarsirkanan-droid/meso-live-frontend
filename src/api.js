import axios from 'axios';
import { API_URL } from './config.js';

const API = axios.create({
  baseURL: `${API_URL}/api`,
});

const PROFILE_REQUEST_TIMEOUT_MS = 15000;

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const dataFrom = (response) => response.data;

export const login = (credentials) => API.post('/auth/login', credentials).then(dataFrom);
export const register = (details) => API.post('/auth/register', details).then(dataFrom);
export const googleLogin = (credential) =>
  API.post('/auth/google', { credential }).then(dataFrom);
export const linkGoogleAccount = (credential) =>
  API.post('/auth/link-google', { credential }).then(dataFrom);
export const changePassword = (passwords) =>
  API.post('/auth/change-password', passwords).then(dataFrom);
export const updateAccountDetails = (details) =>
  API.put('/users/account', details).then(dataFrom);
export const checkUsernameAvailability = (username) =>
  API.get('/users/username-availability', { params: { username } }).then(dataFrom);
export const saveProfileSetup = (profile) =>
  API.put('/users/profile', profile).then(dataFrom);
export const updateProfileAvatar = (avatar) =>
  API.put('/users/avatar', { avatar }).then(dataFrom);
export const getRooms = () => API.get('/room/all').then(dataFrom);
export const createRoom = (room) => API.post('/room/create', room).then(dataFrom);
export const getRoom = (roomId) => API.get(`/room/${roomId}`).then(dataFrom);
export const takeRoomSeat = (roomId, seatIndex) =>
  API.post(`/room/${roomId}/seat/${seatIndex}/take`).then(dataFrom);
export const leaveRoomSeat = (roomId, seatIndex) =>
  API.post(`/room/${roomId}/seat/${seatIndex}/leave`).then(dataFrom);
export const getGiftCatalog = () => API.get('/gift/catalog').then(dataFrom);
export const sendGift = (gift) => API.post('/gift/send', gift).then(dataFrom);
export const getMessages = () => API.get('/message').then(dataFrom);
function profileFrom(response) {
  const profile = response.data?.user || response.data?.profile || response.data;
  if (!profile || typeof profile !== 'object' || Array.isArray(profile) ||
      typeof profile.username !== 'string' || typeof profile.profileComplete !== 'boolean') {
    throw new Error('The server returned an invalid profile. Please try again.');
  }
  return profile;
}

export const getProfile = async () => {
  try {
    return profileFrom(await API.get('/auth/me', { timeout: PROFILE_REQUEST_TIMEOUT_MS }));
  } catch (error) {
    if (error.response?.status !== 404) throw error;
    return profileFrom(await API.get('/users/profile', { timeout: PROFILE_REQUEST_TIMEOUT_MS }));
  }
};
export const getTheme = () => API.get('/user/theme').then(dataFrom);
export const updateTheme = (theme) => API.put('/user/theme', theme).then(dataFrom);
export const generateInvite = () => API.post('/invite/generate').then(dataFrom);
export const acceptInvite = (code) => API.post('/invite/accept', { code }).then(dataFrom);
export const getWalletBalance = () => API.get('/wallet/balance').then(dataFrom);
export const requestWithdraw = (request) => API.post('/withdraw/request', request).then(dataFrom);
export const getWallet = () => API.get('/wallet/me').then(dataFrom);
export const getLevels = () => API.get('/level/me').then(dataFrom);
export const getMyRoom = () => API.get('/room/my-room').then(dataFrom);
export const updateProfile = (profile) => API.put('/users/profile', profile).then(dataFrom);
export const getFollowers = () => API.get('/users/followers').then(dataFrom);
export const getFollowing = () => API.get('/users/following').then(dataFrom);
export const followUser = (userId) => API.post('/users/follow', { userId }).then(dataFrom);
export const unfollowUser = (userId) => API.post('/users/unfollow', { userId }).then(dataFrom);
export const getWithdrawalHistory = () => API.get('/withdraw/mine').then(dataFrom);
export const getHostDailyTasks = () => API.get('/task/host-daily').then(dataFrom);
export const claimHostDailyTask = (taskId) =>
  API.post(`/task/host-daily/${taskId}/claim`).then(dataFrom);
export const getAgencyCenter = () => API.get('/agency/center').then(dataFrom);
export const getAgencyCommission = () => API.get('/agency/commission').then(dataFrom);
export const getAgencyHostRevenue = (period = '30d') =>
  API.get('/agency/host-revenue', { params: { period } }).then(dataFrom);
export const getAgencySubRevenue = (period = '30d') =>
  API.get('/agency/sub-revenue', { params: { period } }).then(dataFrom);
export const getAgencyInviteLinks = () => API.get('/agency/invite-links').then(dataFrom);
export const getAgencyDashboard = () => API.get('/agency/dashboard').then(dataFrom);
export const getMyHostTarget = () => API.get('/agency/host/my-target').then(dataFrom);
export const applyForSubAgency = (application) =>
  API.post('/agency/sub-apply', application).then(dataFrom);
export const applyForAgencyExit = (application = {}) =>
  API.post('/agency/exit-apply', application).then(dataFrom);
export const getRechargePackages = () => API.get('/payment/packages').then(dataFrom);
export const recharge = (packageId, customer) =>
  API.post('/payment/initialize', { packageId, currency: 'ETB', customer }).then(dataFrom);
export const verifyPayment = (transactionRef) =>
  API.get(`/payment/verify/${encodeURIComponent(transactionRef)}`).then(dataFrom);
export const playGame = (game) => API.post('/game/play', game).then(dataFrom);
export const getTaskCenter = () => API.get('/tasks').then(dataFrom);
export const claimTask = (taskId) => API.post(`/tasks/${encodeURIComponent(taskId)}/claim`).then(dataFrom);
export const claimMicReward = () => API.post('/rewards/claim-mic').then(dataFrom);
export const claimCrownReward = () => API.post('/rewards/claim-crown').then(dataFrom);
export const claimWelcomeReward = () => API.post('/rewards/claim-welcome').then(dataFrom);

export default API;

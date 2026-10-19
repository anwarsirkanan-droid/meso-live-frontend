import axios from 'axios';
import { API_URL } from './config.js';

const API = axios.create({
  baseURL: `${API_URL}/api`,
});

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
export const getRooms = () => API.get('/room/all').then(dataFrom);
export const createRoom = (room) => API.post('/room/create', room).then(dataFrom);
export const getRoom = (roomId) => API.get(`/room/${roomId}`).then(dataFrom);
export const getMessages = () => API.get('/message').then(dataFrom);
export const getProfile = () => API.get('/user/profile').then(dataFrom);
export const getTheme = () => API.get('/user/theme').then(dataFrom);
export const updateTheme = (theme) => API.put('/user/theme', theme).then(dataFrom);
export const generateInvite = () => API.post('/invite/generate').then(dataFrom);
export const acceptInvite = (code) => API.post('/invite/accept', { code }).then(dataFrom);
export const getWalletBalance = () => API.get('/wallet').then(dataFrom);
export const requestWithdraw = (request) => API.post('/wallet/withdraw', request).then(dataFrom);
export const recharge = (packageId) => API.post('/payment/chapa', { packageId }).then(dataFrom);
export const playDice = (bet) => API.post('/games/dice', bet).then(dataFrom);

export default API;

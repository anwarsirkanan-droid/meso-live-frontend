import { io } from 'socket.io-client';
import { API_URL } from './config.js';

const socket = io(API_URL, {
  autoConnect: false,
});

export default socket;
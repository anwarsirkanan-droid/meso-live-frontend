import { useEffect, useState } from 'react';
import { getRooms, playGame } from '../api.js';
import { Card, ErrorMessage, Field, Page } from '../components/UI.jsx';

const GAME_TYPES = ['MegaJackpot', 'Keno', '777', 'Jungle Hunt', 'Fish Hunter'];

export default function DiceGamePage() {
  const [amount, setAmount] = useState(10);
  const [gameType, setGameType] = useState(GAME_TYPES[0]);
  const [rooms, setRooms] = useState([]);
  const [roomId, setRoomId] = useState('');
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomError, setRoomError] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getRooms()
      .then((data) => {
        if (!active) return;
        const availableRooms = Array.isArray(data) ? data : [];
        setRooms(availableRooms);
        setRoomId(availableRooms[0]?._id || '');
      })
      .catch((requestError) => {
        if (active) setRoomError(requestError.response?.data?.message || requestError.message || 'Could not load rooms for game play.');
      })
      .finally(() => {
        if (active) setLoadingRooms(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const play = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setResult('');
    try {
      const data = await playGame({ roomId, gameType, betAmount: Number(amount) });
      setResult(data?.message || `${data?.isWin ? 'Won' : 'No win'} · ${data?.multiplier || 0}x · ${data?.winAmount || 0} coins`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Game Center" eyebrow="PLAY IN A LIVE ROOM">
      <Card className="center-card game-card">
        <div className="dice-art">🎮</div>
        <p className="muted">Choose a server-verified game and place your bet.</p>
        {roomError && <ErrorMessage>{roomError}</ErrorMessage>}
        <form className="form-stack" onSubmit={play}>
          <label className="field">
            <span>Live room</span>
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)} required disabled={loadingRooms || !rooms.length}>
              {rooms.map((room) => <option key={room._id} value={room._id}>{room.title}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Game</span>
            <select value={gameType} onChange={(event) => setGameType(event.target.value)}>
              {GAME_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Field label="Bet amount (coins)" type="number" min="1" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} />
          <ErrorMessage>{error}</ErrorMessage>
          {result && <p className="result-message" role="status">{result}</p>}
          <button className="button button-primary button-full" disabled={busy || loadingRooms || !roomId}>{busy ? 'Playing…' : 'Play'}</button>
        </form>
      </Card>
    </Page>
  );
}

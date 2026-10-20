import { Navigate, useParams } from 'react-router-dom';

function Room() {
  const { roomId } = useParams();
  return <Navigate to={`/live/${encodeURIComponent(roomId)}`} replace />;
}

export default Room;
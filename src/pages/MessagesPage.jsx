import { useEffect, useState } from 'react';
import { Card, Page } from '../components/UI.jsx';
import { getMessages } from '../api.js';

function formatMessageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getMessages()
      .then((data) => {
        if (active) setMessages(Array.isArray(data) ? data : []);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || 'Could not load messages. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const unreadCount = messages.filter((message) => !message.isRead).length;

  return (
    <Page
      title="Messages"
      eyebrow="STAY IN THE LOOP"
      actions={<span className="count-badge">{unreadCount} new</span>}
    >
      {loading && (
        <div className="rooms-loading" role="status" aria-label="Loading messages">
          <span className="loading-spinner" />
          <span className="muted">Loading messages…</span>
        </div>
      )}
      {!loading && error && <div className="notice-error" role="alert">{error}</div>}
      {!loading && !error && messages.length === 0 && (
        <p className="muted helper-text">No messages yet.</p>
      )}
      {!loading && !error && messages.length > 0 && (
        <Card className="conversation-list">
          {messages.map((message) => {
            const sender = message.senderId && typeof message.senderId === 'object'
              ? message.senderId
              : null;
            const senderName = message.type === 'SYSTEM'
              ? 'System'
              : sender?.username || 'Deleted user';
            return (
              <article className="conversation" key={message._id}>
                {sender?.avatar ? (
                  <img className="avatar conversation-avatar-image" src={sender.avatar} alt="" />
                ) : (
                  <div className="avatar conversation-avatar-fallback" aria-label={senderName}>
                    {senderName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="conversation-copy">
                  <h3>
                    {senderName}
                    {!message.isRead && <span className="unread-dot" aria-label="Unread" />}
                  </h3>
                  <p className="muted">{message.content}</p>
                </div>
                <time className="muted">{formatMessageTime(message.createdAt)}</time>
              </article>
            );
          })}
        </Card>
      )}
    </Page>
  );
}

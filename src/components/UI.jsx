import { Link } from 'react-router-dom';

export function Page({ title, eyebrow, children, actions }) {
  return (
    <main className="page">
      <div className="page-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
        </div>
        {actions}
      </div>
      {children}
    </main>
  );
}

export function Card({ title, children, className = '' }) {
  return (
    <section className={`card ${className}`.trim()}>
      {title && <h2 className="card-title">{title}</h2>}
      {children}
    </section>
  );
}

export function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

export function ErrorMessage({ children }) {
  return children ? <p className="form-error" role="alert">{children}</p> : null;
}

export function PageLink({ to, children, icon = '→' }) {
  return <Link className="page-link" to={to}><span>{children}</span><span aria-hidden="true">{icon}</span></Link>;
}

export function Loading({ children = 'Loading…' }) {
  return <p className="muted" role="status">{children}</p>;
}

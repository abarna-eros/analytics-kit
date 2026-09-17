import { SITE } from '../../data/site';

export function AuthorSection() {
  return (
    <section className="section">
      <div className="container">
        <h2>Built by {SITE.author}</h2>
        <p className="lead">
          {SITE.productName} is an open-source analytics abstraction designed to simplify analytics
          integration across modern React and Next.js applications.
        </p>
        <p>
          <strong>{SITE.author}</strong>
        </p>
        <p>
          <a href={SITE.githubUserUrl}>GitHub</a>
          {' · '}
          <a href={SITE.npmUrl}>npm</a>
        </p>
      </div>
    </section>
  );
}

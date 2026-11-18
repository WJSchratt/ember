import { Link } from 'react-router-dom';
import { CONTACT_EMAIL } from '../flags.js';

export default function Privacy() {
  return (
    <div className="page pk-page pk-prose">
      <Link to="/" className="back-link">
        <i className="ti ti-arrow-left" aria-hidden="true" /> Back to game days
      </Link>
      <h1 className="pk-title pk-title-sm">Privacy</h1>

      <section className="card">
        <h2 className="pk-h2">What we store</h2>
        <ul>
          <li><strong>Your name</strong>, as you typed it. Only the first word is shown on the public list.</li>
          <li>
            <strong>Phone or email, if you gave one.</strong> Optional, for game reminders only. It is
            never shown publicly. No texts or emails are being sent yet.
          </li>
          <li><strong>Your RSVP:</strong> which game day, and when you signed up or cancelled.</li>
          <li>
            <strong>That you checked the play-at-your-own-risk box</strong>, with the time you checked it.
          </li>
        </ul>
        <p className="muted">
          Your phone keeps a small random code (in this browser&rsquo;s local storage) so you can cancel
          your own spot without an account. No cookies, no tracking, no ads.
        </p>
      </section>

      <section className="card">
        <h2 className="pk-h2">What we don&rsquo;t do</h2>
        <ul>
          <li>We never sell or share your information.</li>
          <li>No accounts, passwords, or payments. The game is free.</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="pk-h2">Deleting your info</h2>
        <p>
          Want your sign-ups removed?{' '}
          {CONTACT_EMAIL ? (
            <>
              Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the name and date you used
            </>
          ) : (
            <>Ask the organizer at any game with the name and date you used</>
          )}{' '}
          and it will be deleted.
        </p>
      </section>
    </div>
  );
}

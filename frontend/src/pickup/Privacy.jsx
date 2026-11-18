import { Link } from 'react-router-dom';
import { CONTACT_EMAIL, MCGUIRE_PATH } from '../flags.js';

export default function Privacy() {
  return (
    <div className="pk-page pk-prose">
      <Link to={MCGUIRE_PATH} className="pk-back">
        &larr; Back to the sign-up sheet
      </Link>
      <h1 className="pk-title pk-title-sm">Privacy</h1>

      <section className="pk-block">
        <h2 className="pk-h2">What we keep</h2>
        <ul>
          <li>
            <strong>Your name</strong>, as you typed it. Only the first word shows on the public list.
          </li>
          <li>
            <strong>Which game you signed up for</strong>, and when you signed up or cancelled.
          </li>
          <li>
            <strong>That you checked the play-at-your-own-risk box</strong>, and when.
          </li>
        </ul>
        <p>That&rsquo;s it. We don&rsquo;t ask for a phone number, email, or account.</p>
        <p className="pk-quiet">
          Your phone keeps a small random code in this browser so you can take your own name off later. No
          cookies, no tracking, no ads.
        </p>
      </section>

      <section className="pk-block">
        <h2 className="pk-h2">What we don&rsquo;t do</h2>
        <ul>
          <li>We never sell or share your information.</li>
          <li>No payments. The game is free.</li>
        </ul>
      </section>

      <section className="pk-block">
        <h2 className="pk-h2">Getting your name removed</h2>
        <p>
          {CONTACT_EMAIL ? (
            <>
              Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> with the name and date you used
            </>
          ) : (
            <>Ask the organizer at any game with the name and date you used</>
          )}{' '}
          and we&rsquo;ll delete it.
        </p>
      </section>
    </div>
  );
}

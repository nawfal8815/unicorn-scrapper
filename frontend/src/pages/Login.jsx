import { useAuth } from '../context/AuthContext';

const FEATURES = [
  {
    title: 'Scrapes the whole market',
    text: 'Every qualifying startup on unicorns.lt, plus CVbankas, CV.lt, and Užimtumo tarnyba — scanned daily, automatically, on a schedule.'
  },
  {
    title: 'Matches, not keyword noise',
    text: 'Career pages and listings are matched against a real IT/QA title vocabulary, with AI-extracted requirements so you know what a role actually needs.'
  },
  {
    title: 'Tailors a CV per job',
    text: 'For every match, a CV is generated automatically — genuinely missing skills get flagged so you can prep for the interview before it happens.'
  },
  {
    title: 'Tracks the whole pipeline',
    text: 'CV generated → applied → contacts found → email sent → reply — one glance shows where every application actually stands.'
  }
];

export default function Login({ deniedEmail }) {
  const { signInWithGoogle, authError, signOutUser, enterGuestMode } = useAuth();

  return (
    <div className="landing-page">
      <div className="landing-hero">
        <img src="/logo.svg" alt="" className="landing-logo" />
        <p className="eyebrow">Lithuania · IT &amp; QA job search, automated</p>
        <h1>Baltic Job Radar</h1>
        <p className="landing-tagline">
          One pipeline that scans the Baltic job market, matches openings against a real
          candidate profile, and keeps a tailored CV and application status ready for every
          role worth applying to.
        </p>

        <div className="landing-actions">
          {deniedEmail ? (
            <div className="login-denied">
              <strong>{deniedEmail}</strong> is not authorized for this app.
              <button className="link-btn" onClick={signOutUser}>
                Try a different account
              </button>
            </div>
          ) : (
            <button className="google-signin-btn" onClick={signInWithGoogle}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
                />
                <path
                  fill="#34A853"
                  d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.81.54-1.85.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18Z"
                />
                <path
                  fill="#FBBC05"
                  d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33Z"
                />
                <path
                  fill="#EA4335"
                  d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58Z"
                />
              </svg>
              Sign in with Google
            </button>
          )}

          <button className="guest-btn" onClick={enterGuestMode}>
            Continue as guest
          </button>
        </div>
        <p className="landing-guest-note">
          Guests get a read-only view of the matched jobs, generated CVs, and application
          progress. Sign-in is limited to the two people running this pipeline.
        </p>

        {authError && <p className="login-error">{authError}</p>}
      </div>

      <div className="landing-features">
        {FEATURES.map(f => (
          <div key={f.title} className="landing-feature-card">
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

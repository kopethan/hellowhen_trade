export default function AuthPage() {
  return (
    <section className="hero">
      <div className="card">
        <p className="eyebrow">Auth shell</p>
        <h1>Sign in to manage trades.</h1>
        <p>Patch 1 placeholder for the reusable Hellowhen auth flow. Patch 2 should wire email/password, Google auth, token storage, and /me refresh.</p>
      </div>
      <form className="card form">
        <input className="input" placeholder="Email" type="email" />
        <input className="input" placeholder="Password" type="password" />
        <button className="button primary" type="button">Continue</button>
      </form>
    </section>
  );
}

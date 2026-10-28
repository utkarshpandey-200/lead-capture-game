import { useState, type FormEvent } from "react";
import { useClientConfig } from "../../config/ClientConfigContext";
import type { RegisterPayload } from "../../api/quizApi";

export default function RegisterScreen({
  onSubmit,
  submitting,
  serverError,
}: {
  onSubmit: (payload: RegisterPayload) => void;
  submitting: boolean;
  serverError: string | null;
}): JSX.Element {
  const cfg = useClientConfig();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [organization, setOrganization] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Required";
    if (!lastName.trim()) next.lastName = "Required";
    if (!organization.trim()) next.organization = "Required";
    if (!consent) next.consent = "Consent is required to play";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      organization: organization.trim(),
      consent,
      displayMode: "first_org",
      website,
    });
  }

  return (
    <div className="screen">
      <span className="eyebrow-badge">📝 Quick sign-up</span>
      <h1 className="screen-title">Join the quiz</h1>
      <p className="screen-body">Takes about a minute.</p>

      <form onSubmit={handleSubmit} noValidate>
        <div className="honeypot-field" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="firstName">First name</label>
          <input
            id="firstName"
            type="text"
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          {errors.firstName && <div className="field-error">{errors.firstName}</div>}
        </div>

        <div className="field">
          <label htmlFor="lastName">Last name</label>
          <input
            id="lastName"
            type="text"
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          {errors.lastName && <div className="field-error">{errors.lastName}</div>}
        </div>

        <div className="field">
          <label htmlFor="organization">Credit union / organization</label>
          <input
            id="organization"
            type="text"
            autoComplete="organization"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
          />
          {errors.organization && <div className="field-error">{errors.organization}</div>}
        </div>

        <div className="checkbox-row">
          <input
            id="consent"
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <label htmlFor="consent">
            {cfg.copy.consentText}{" "}
            <a href={cfg.links.privacyPolicyUrl} target="_blank" rel="noreferrer">
              Privacy policy
            </a>
            .
          </label>
        </div>
        {errors.consent && <div className="field-error" style={{ marginTop: "-8px", marginBottom: "16px" }}>{errors.consent}</div>}

        {serverError && (
          <div className="field-error" role="alert" style={{ marginBottom: "var(--space-4)" }}>
            {serverError}
          </div>
        )}

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? "Starting…" : "Start the quiz"}
        </button>
      </form>
    </div>
  );
}

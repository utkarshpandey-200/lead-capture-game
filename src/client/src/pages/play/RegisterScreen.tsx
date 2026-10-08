import { useState, type FormEvent } from "react";
import { useClientConfig } from "../../config/ClientConfigContext";
import { checkNickname } from "../../../../shared/nickname";
import type { DisplayMode } from "../../../../shared/types";
import type { RegisterPayload } from "../../api/quizApi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("first_org");
  const [nickname, setNickname] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!firstName.trim()) next.firstName = "Required";
    if (!lastName.trim()) next.lastName = "Required";
    if (!organization.trim()) next.organization = "Required";
    if (!EMAIL_RE.test(email.trim())) next.email = "Enter a valid email address";
    if (!consent) next.consent = "Consent is required to play";
    if (displayMode === "nickname") {
      const check = checkNickname(nickname, cfg.nicknameBlocklist ?? []);
      if (!check.valid) {
        next.nickname =
          check.reason === "too_long"
            ? "Nicknames are max 20 characters"
            : check.reason === "empty"
              ? "Enter a nickname"
              : "Please choose a different nickname";
      }
    }
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
      email: email.trim(),
      consent,
      displayMode,
      nickname: displayMode === "nickname" ? nickname.trim() : undefined,
      website,
    });
  }

  return (
    <div className="screen">
      <h1 className="screen-title">Join the quiz</h1>
      <p className="screen-body">Takes about a minute. We'll use this to show your rank and follow up after the event.</p>

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

        <div className="field">
          <label htmlFor="email">Work email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {errors.email && <div className="field-error">{errors.email}</div>}
        </div>

        <div className="field">
          <label>Show my name on the leaderboard as</label>
          <div className="radio-group" role="radiogroup" aria-label="Leaderboard display name">
            <label className={`radio-option${displayMode === "first_org" ? " selected" : ""}`}>
              <input
                type="radio"
                name="displayMode"
                checked={displayMode === "first_org"}
                onChange={() => setDisplayMode("first_org")}
              />
              First name + organization{firstName || organization ? ` (e.g. "${firstName || "Jane"} · ${organization || "Acme CU"}")` : ""}
            </label>
            <label className={`radio-option${displayMode === "full_name" ? " selected" : ""}`}>
              <input
                type="radio"
                name="displayMode"
                checked={displayMode === "full_name"}
                onChange={() => setDisplayMode("full_name")}
              />
              Full name
            </label>
            <label className={`radio-option${displayMode === "nickname" ? " selected" : ""}`}>
              <input
                type="radio"
                name="displayMode"
                checked={displayMode === "nickname"}
                onChange={() => setDisplayMode("nickname")}
              />
              Nickname
            </label>
          </div>
          {displayMode === "nickname" && (
            <div style={{ marginTop: "var(--space-3)" }}>
              <input
                type="text"
                maxLength={20}
                placeholder="Up to 20 characters"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                aria-label="Nickname"
              />
              {errors.nickname && <div className="field-error">{errors.nickname}</div>}
            </div>
          )}
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

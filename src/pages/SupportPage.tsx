import { LegalDocument } from "@/components/LegalDocument";

export default function SupportPage() {
  return (
    <LegalDocument title="Support" lastUpdated={new Date().toISOString().slice(0, 10)}>
      <h2>Need help with Stampaway?</h2>
      <p>
        We're here to help. For any questions, bug reports, account issues, or
        feedback, please reach out and we'll get back to you as soon as we can.
      </p>

      <h3>Contact</h3>
      <p>
        Email: <a href="mailto:support@stampaway.app">support@stampaway.app</a>
      </p>

      <h3>Common topics</h3>
      <ul>
        <li>Account, login, or password issues</li>
        <li>Deleting your account or data</li>
        <li>Reporting a bug or inappropriate content</li>
        <li>Feature requests and feedback</li>
      </ul>

      <h3>Privacy & Terms</h3>
      <p>
        See our <a href="/privacy">Privacy Policy</a> and{" "}
        <a href="/terms">Terms of Use</a>.
      </p>
    </LegalDocument>
  );
}

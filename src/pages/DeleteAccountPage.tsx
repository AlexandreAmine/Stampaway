import { LegalDocument } from "@/components/LegalDocument";

export default function DeleteAccountPage() {
  return (
    <LegalDocument title="Delete Your StampAway Account" lastUpdated="May 11, 2026">
      <p>
        StampAway lets you permanently delete your account and associated data
        directly from inside the app, at any time, free of charge.
      </p>

      <h2>How to delete your account from the app</h2>
      <ol>
        <li>Open the StampAway app and sign in.</li>
        <li>Go to the <strong>Profile</strong> tab (bottom right).</li>
        <li>Tap the <strong>Settings</strong> icon (top right).</li>
        <li>Scroll to the bottom and tap <strong>Delete Account</strong>.</li>
        <li>Confirm the deletion when prompted.</li>
      </ol>
      <p>
        Your account and personal data are deleted immediately and
        irreversibly.
      </p>

      <h2>How to request deletion without the app</h2>
      <p>
        If you can no longer access the app, email{" "}
        <a href="mailto:support@stampaway.app">support@stampaway.app</a> from
        the email address linked to your account with the subject{" "}
        <strong>"Delete my account"</strong>. We will process your request
        within 30 days.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your profile (username, bio, profile picture, country, social links)</li>
        <li>Your reviews, ratings, sub-ratings, comments and likes</li>
        <li>Your lists, wishlists, favorite places and yearly goals</li>
        <li>Your followers, following and follow requests</li>
        <li>Your tags, blocks and authentication credentials</li>
      </ul>

      <h2>What may be retained</h2>
      <p>
        We may retain a minimal amount of data when required by law (for
        example, fraud prevention or legal compliance). Anonymous, aggregated
        analytics that cannot identify you may also be retained. Any retained
        data is kept no longer than legally required.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about account deletion? Email{" "}
        <a href="mailto:support@stampaway.app">support@stampaway.app</a>.
      </p>
    </LegalDocument>
  );
}

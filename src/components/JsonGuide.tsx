export default function JsonGuide() {
  return (
    <details className="json-guide">
      <summary>What does my house JSON mean?</summary>
      <p>
        JSON describes your house using named fields. Change a value, keep the quotation marks and
        commas, and watch your local town update.
      </p>
      <dl>
        <dt>id</dt>
        <dd>
          Your house's unique address in the files. Keep it the same as the filename, without{' '}
          <code>.json</code>.
        </dd>
        <dt>creator</dt>
        <dd>Your GitHub username, without @. The PR check compares it with your account.</dd>
        <dt>plot</dt>
        <dd>
          The map spot your house occupies. Choose an empty one; a preview does not reserve it.
        </dd>
        <dt>name / story</dt>
        <dd>The title and short introduction visitors see when they select your house.</dd>
        <dt>building / color / decoration</dt>
        <dd>The building family, roof color, and item in your garden.</dd>
        <dt>design</dt>
        <dd>Wall and trim colors, floors, roof, windows, garden, and extra house details.</dd>
        <dt>resident / routine</dt>
        <dd>
          Your one neighbor's appearance, greeting, and morning, afternoon, and evening activities.
          Working or resting keeps them indoors.
        </dd>
        <dt>sign</dt>
        <dd>
          Your outdoor lettering or restricted HTML artwork. It is drawn as a picture; it cannot run
          scripts or open links.
        </dd>
      </dl>
      <p>
        Saving changes your local copy. Commit the file, push your contribution branch, and open a
        PR to propose it for the shared town.
      </p>
    </details>
  );
}

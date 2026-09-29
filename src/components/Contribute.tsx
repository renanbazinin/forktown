import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Paintbrush,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  BUILDING_TYPES,
  DECORATIONS,
  DEFAULT_RESIDENT,
  TYPE_LABELS,
  draftSchema,
  placeSchema,
  type Place,
} from '../lib/schema';
import { HOUSE_PLOTS as PLOTS } from '../lib/events';
import { repositoryUrl } from '../lib/places';
import { localSaveAvailable, saveToProject } from '../lib/local-save';
import { blankHouseFileUrl, houseFileLink, readUsername } from '../lib/github-new-file';
import { availableId, pickDraftNames } from '../lib/draft-names';
import { restoreDraftDesign, restoreDraftPlot, storyPrompt } from '../lib/builder-nudges';
import { BUILDER_DEFAULT_STORY } from '../lib/lanterns';
import BuildingPreview from './BuildingPreview';
import Modal from './Modal';
import HouseFiles from './HouseFiles';
import JsonGuide from './JsonGuide';
import ResidentPreview from './ResidentPreview';
import { HomeDetails, NeighborDetails, SignDetails } from './Customization';
import '../stories.css';

const COLORS = ['#789B76', '#C97878', '#759BAF', '#AD88AE', '#D0AA65', '#BE8E68'];
const initial = (plot: string, places: Place[]): Place => {
  const { placeName, residentName } = pickDraftNames(places);
  return draftSchema.parse({
    id: availableId(placeName, places),
    name: placeName,
    creator: '',
    plot,
    building: 'cottage',
    color: COLORS[0],
    decoration: 'flowers',
    // Empty on purpose: the placeholder asks a question, so every house arrives with its own story.
    story: '',
    resident: { ...DEFAULT_RESIDENT, name: residentName },
  });
};
const storageKey = 'forktown-draft-v2';
/** The draft kept on this device, brought up to date with the town, or null. */
function savedDraft(
  plot: string | undefined,
  places: Place[],
  available: readonly { id: string }[],
): Place | null {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    const result = draftSchema.safeParse(saved);
    if (result.success) {
      const restored = result.data;
      if (restored.name === 'My Little Place' || restored.resident.name === 'New neighbor') {
        const { placeName, residentName } = pickDraftNames(places);
        if (restored.name === 'My Little Place') {
          if (/^my-little-place(?:-\d+)?$/.test(restored.id))
            restored.id = availableId(placeName, places);
          restored.name = placeName;
        }
        if (restored.resident.name === 'New neighbor')
          restored.resident = { ...restored.resident, name: residentName };
      }
      return {
        ...restored,
        design: restoreDraftDesign(restored.design),
        plot: restoreDraftPlot(plot ?? restored.plot, available),
      };
    }
  } catch {
    /* A stale draft should never prevent a new contribution. */
  }
  return null;
}

const Contribute = memo(function Contribute({
  plot,
  places,
  creator = '',
  onClose,
  onPreview,
}: {
  plot?: string;
  places: Place[];
  /** A username typed on the open plot, for a draft that has none yet. */
  creator?: string;
  onClose: () => void;
  onPreview: (place: Place) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const occupied = new Set(places.map((place) => place.plot));
  const available = PLOTS.filter((p) => !occupied.has(p.id));
  // A username typed on the open plot fills in a draft that has none yet.
  const typed = readUsername(creator);
  const withCreator = (start: Place) =>
    start.creator || typed.problem ? start : { ...start, creator: typed.username };
  const fresh = () => withCreator(initial(plot ?? available[0]?.id ?? 'A1', places));
  const [draft, setDraft] = useState<Place>(() => {
    const restored = savedDraft(plot, places, available);
    return restored ? withCreator(restored) : fresh();
  });
  const [panel, setPanel] = useState<'home' | 'neighbor' | 'sign'>('home');
  const [customId, setCustomId] = useState(() => draft.id !== availableId(draft.name, places));
  const [step, setStep] = useState<'design' | 'submit' | 'files'>('design');
  const [filesReturn, setFilesReturn] = useState<'design' | 'submit'>('design');
  const [attempted, setAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFile, setSavedFile] = useState('');
  const saveInProgress = useRef(false);
  const parsed = useMemo(() => placeSchema.safeParse(draft), [draft]);
  const buildingChoices = useMemo(
    () => BUILDING_TYPES.map((building) => ({ ...draft, building })),
    [draft],
  );
  const errors: Record<string, string> = {};
  if (!parsed.success)
    parsed.error.issues.forEach((issue) => {
      const field = String(issue.path[0]);
      errors[field] ??= issue.message;
    });
  if (draft.creator.toLowerCase() === 'forktown')
    errors.creator =
      'Use your GitHub username. The forktown credit is reserved for starter places.';
  if (places.some((place) => place.id === draft.id))
    errors.id = 'This id is already in the city. Choose a different one.';
  if (occupied.has(draft.plot)) errors.plot = 'This plot is occupied. Choose an empty plot.';
  const valid = Object.keys(errors).length === 0;
  const json = JSON.stringify(parsed.success ? parsed.data : draft, null, 2) + '\n';
  // The published town saves nothing: it hands the finished house to GitHub's editor, as an open
  // plot does. A house too long for the link goes by copy and a blank file instead.
  const githubLink =
    !localSaveAvailable && repositoryUrl && valid && parsed.success
      ? houseFileLink(repositoryUrl, parsed.data)
      : null;
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(draft));
      setDraftSaved(true);
    } catch {
      /* The form still works when browser storage is unavailable. */
      setDraftSaved(false);
    }
  }, [draft]);
  const update = <K extends keyof Place>(key: K, value: Place[K]) => {
    setCopied(false);
    setNotice('');
    if (key === 'id') setCustomId(true);
    setDraft((old) => ({
      ...old,
      [key]: value,
      ...(key === 'name' && !customId ? { id: availableId(String(value), places) } : {}),
    }));
  };
  function showErrors() {
    setAttempted(true);
    const first = Object.keys(errors)[0];
    setPanel(first === 'resident' ? 'neighbor' : first === 'sign' ? 'sign' : 'home');
    setNotice('A few details need a little attention. Check the highlighted fields.');
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );
  }
  function submit() {
    setAttempted(true);
    if (valid) {
      setStep('submit');
      setNotice('');
    } else showErrors();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setNotice('JSON copied. You can paste it into your new place file.');
    } catch {
      setNotice('Copy is unavailable in this browser. Download the JSON file instead.');
    }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${draft.id}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`Downloaded ${draft.id}.json. Add it to the places folder in your fork.`);
  }
  async function save() {
    if (saveInProgress.current || savedFile) return;
    if (!valid || !parsed.success) {
      setStep('design');
      showErrors();
      return;
    }
    saveInProgress.current = true;
    setSaving(true);
    setNotice('');
    try {
      const file = await saveToProject(parsed.data);
      setSavedFile(file);
      setNotice(
        `Saved ${file}. Your place is now in this local city. Commit this file and open your pull request when you’re ready.`,
      );
      try {
        localStorage.removeItem(storageKey);
      } catch {
        /* Saving the actual file succeeds even when draft storage is unavailable. */
      }
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'Could not save this place. Please try again.',
      );
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  }
  const fieldError = (key: keyof Place) =>
    attempted && errors[key] ? (
      <span className="field-error" id={`error-${key}`}>
        {errors[key]}
      </span>
    ) : null;
  return (
    <Modal
      title={
        step === 'files'
          ? 'The files that make a town.'
          : step === 'design'
            ? 'Make yourself at home.'
            : 'Your place starts here.'
      }
      onClose={onClose}
      wide
    >
      {step !== 'files' && (
        <div className="contribute-progress">
          <span className={step === 'design' ? 'current' : 'done'}>
            <b>{step === 'submit' ? <Check size={12} /> : 1}</b> Make it yours
          </span>
          <i />
          <span className={step === 'submit' ? 'current' : ''}>
            <b>2</b> Share with the town
          </span>
        </div>
      )}
      {step === 'files' ? (
        <HouseFiles
          initialId={savedFile ? draft.id : undefined}
          saved={savedFile ? { id: draft.id, name: draft.name, json } : undefined}
          onBack={() => setStep(filesReturn)}
        />
      ) : step === 'design' ? (
        <div className="builder-layout">
          <div className="builder-preview">
            <span className="eyebrow">YOUR LITTLE CORNER</span>
            <div className="preview-ground">
              <BuildingPreview place={draft} size={230} />
            </div>
            <h3>{draft.name || 'Your new place'}</h3>
            <div className="builder-resident">
              <ResidentPreview resident={draft.resident} size={72} />
              <span>
                {draft.resident.name || 'Your neighbor'}
                <small>{draft.resident.greeting || 'Hello!'}</small>
              </span>
            </div>
            <span className="mono muted">
              Plot {draft.plot} · {TYPE_LABELS[draft.building]}
            </span>
            <p>
              Start with a little place.
              <br />
              Give it a little personality.
            </p>
            <button
              type="button"
              className="text-button fresh-draft"
              onClick={() => {
                setDraft(fresh());
                setCustomId(false);
                setPanel('home');
                setAttempted(false);
                setNotice('Started a fresh draft.');
              }}
            >
              Start fresh
            </button>
            <span className="draft-label">
              <span className="live-dot" /> Private draft ·{' '}
              {draftSaved ? 'saved on this device' : 'this visit only'}
            </span>
          </div>
          <form
            ref={form}
            className="builder-form"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            noValidate
          >
            <p className="local-note">
              <strong>One house + one neighbor per PR.</strong> Want to add another? Start a
              separate contribution branch and PR for it. This is not a lifetime limit.
            </p>
            <div className="builder-tabs" role="group" aria-label="Customize your place">
              {(['home', 'neighbor', 'sign'] as const).map((value, index) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={panel === value}
                  className={panel === value ? 'selected' : ''}
                  onClick={() => setPanel(value)}
                >
                  <span>0{index + 1}</span>
                  {value === 'home' ? 'Home' : value === 'neighbor' ? 'Neighbor' : 'Outdoor sign'}
                </button>
              ))}
            </div>
            {panel === 'neighbor' && (
              <>
                <NeighborDetails
                  resident={draft.resident}
                  attempted={attempted}
                  update={(value) => update('resident', value)}
                />
                {fieldError('resident')}
              </>
            )}
            {panel === 'sign' && (
              <>
                <SignDetails sign={draft.sign} update={(value) => update('sign', value)} />
              </>
            )}
            <div hidden={panel !== 'home'} className="home-fields">
              <div className="field-row">
                <label className="field">
                  Place name
                  <input
                    aria-label="Place name"
                    autoFocus
                    value={draft.name}
                    maxLength={32}
                    onChange={(event) => update('name', event.target.value)}
                    aria-invalid={attempted && !!errors.name}
                    aria-describedby={attempted && errors.name ? 'error-name' : undefined}
                  />
                  {fieldError('name')}
                </label>
                <label className="field">
                  GitHub username
                  <span className="input-prefix">
                    <span>@</span>
                    <input
                      aria-label="GitHub username"
                      value={draft.creator}
                      placeholder="your-username"
                      maxLength={39}
                      onChange={(event) => update('creator', event.target.value)}
                      aria-invalid={attempted && !!errors.creator}
                      aria-describedby={attempted && errors.creator ? 'error-creator' : undefined}
                    />
                  </span>
                  {fieldError('creator')}
                </label>
              </div>
              <fieldset className="building-picker">
                <legend>A place to…</legend>
                <div>
                  {BUILDING_TYPES.map((type) => (
                    <button
                      type="button"
                      key={type}
                      className={draft.building === type ? 'selected' : ''}
                      aria-pressed={draft.building === type}
                      onClick={() => update('building', type)}
                    >
                      <BuildingPreview
                        place={buildingChoices.find((place) => place.building === type)!}
                        size={62}
                      />
                      <span>{TYPE_LABELS[type]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="field-row">
                <fieldset className="color-picker">
                  <legend>A splash of color</legend>
                  <div>
                    {COLORS.map((color) => (
                      <button
                        type="button"
                        aria-label={`Use color ${color}`}
                        aria-pressed={draft.color === color}
                        className={draft.color === color ? 'selected' : ''}
                        key={color}
                        style={{ backgroundColor: color }}
                        onClick={() => update('color', color)}
                      >
                        {draft.color === color && <Check size={15} />}
                      </button>
                    ))}
                    <label className="custom-color" aria-label="Choose a custom color">
                      <Paintbrush size={14} />
                      <input
                        type="color"
                        aria-label="Custom building color"
                        value={draft.color}
                        onChange={(event) => update('color', event.target.value)}
                      />
                    </label>
                  </div>
                </fieldset>
                <label className="field">
                  Finishing touch
                  <select
                    value={draft.decoration}
                    onChange={(event) =>
                      update('decoration', event.target.value as Place['decoration'])
                    }
                  >
                    {DECORATIONS.map((value) => (
                      <option value={value} key={value}>
                        {value[0].toUpperCase() + value.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <HomeDetails draft={draft} update={(value) => update('design', value)} />
              {fieldError('design')}
              <label className="field">
                A little story <span className="field-optional">Make it personal.</span>
                <textarea
                  aria-label="A little story"
                  rows={3}
                  value={draft.story}
                  maxLength={180}
                  placeholder={storyPrompt(draft.id || draft.name)}
                  onChange={(event) => update('story', event.target.value)}
                  aria-invalid={attempted && !!errors.story}
                  aria-describedby={
                    attempted && errors.story ? 'error-story story-hint' : 'story-hint'
                  }
                />
                <span className="character-count">{draft.story.length}/180</span>
                <span className="field-hint" id="story-hint">
                  {draft.story.trim() === BUILDER_DEFAULT_STORY
                    ? 'This is the old example story. Write your own so it can be told as Tonight’s tale.'
                    : 'Your story may be told as Tonight’s tale at the Lantern Fork. Write it in your own words.'}
                </span>
                {fieldError('story')}
              </label>
              <div className="field-row">
                <label className="field">
                  File id
                  <input
                    aria-label="File id"
                    value={draft.id}
                    maxLength={40}
                    onChange={(event) => update('id', event.target.value)}
                    aria-invalid={attempted && !!errors.id}
                    aria-describedby={attempted && errors.id ? 'error-id' : undefined}
                  />
                  {fieldError('id')}
                </label>
                <label className="field">
                  Your plot
                  <select
                    value={draft.plot}
                    onChange={(event) => update('plot', event.target.value)}
                  >
                    {available.map((p) => (
                      <option key={p.id} value={p.id}>
                        Plot {p.id}
                      </option>
                    ))}
                  </select>
                  {fieldError('plot')}
                </label>
              </div>
            </div>
            {notice && (
              <div role="alert" className="form-notice">
                {notice}
              </div>
            )}
            <div className="builder-actions">
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setFilesReturn('design');
                  setStep('files');
                }}
              >
                <FolderOpen size={15} /> Browse house files
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setAttempted(true);
                  if (valid) {
                    onPreview(parsed.success ? parsed.data : draft);
                    onClose();
                  } else showErrors();
                }}
              >
                <Sparkles size={15} /> Preview in town
              </button>
              <button type="submit" className="button button-primary">
                {localSaveAvailable ? 'Continue to save' : 'Get my place file'}{' '}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="submit-layout">
          <div className="submit-guide">
            <p className="local-note">
              <strong>One house + one neighbor per PR.</strong> Review only this house's new file
              before committing.{' '}
              {localSaveAvailable
                ? 'Saving locally does not publish it.'
                : 'Opening it on GitHub does not publish it.'}
            </p>
            <p className="modal-intro">
              {localSaveAvailable
                ? 'Save your place straight into the project running on this computer. Then share it with the town through your pull request.'
                : 'Your place is ready for its first pull request. GitHub opens its file with everything filled in; here’s how to give it a permanent home.'}
            </p>
            <div className="house-file-actions">
              <button
                className="button button-secondary"
                onClick={() => {
                  setFilesReturn('submit');
                  setStep('files');
                }}
              >
                <FolderOpen size={15} /> {savedFile ? 'See my saved JSON' : 'Browse house files'}
              </button>
              <p className="house-files-note">
                Previewing or downloading a house does not add it to the shared town. Your pull
                request is the contribution.
              </p>
            </div>
            <ol className="contribution-steps">
              <li>
                <span>1</span>
                <div>
                  <h3>{localSaveAvailable ? 'Save your place' : 'Open it on GitHub'}</h3>
                  <p>
                    {localSaveAvailable ? (
                      <>
                        Click <strong>Save to my project</strong> to create{' '}
                        <code>places/{draft.id}.json</code> in this local checkout.
                      </>
                    ) : githubLink ? (
                      <>
                        Choose <strong>Create my house file on GitHub</strong>. GitHub opens{' '}
                        <code>places/{draft.id}.json</code> with your house filled in. If it asks
                        you to fork Forktown first, accept: the fork is your own copy.
                      </>
                    ) : (
                      <>
                        This house is too long to send in a link, so it goes by copy and paste.
                        Choose <strong>Copy JSON</strong>, then <strong>Start a blank file</strong>,
                        name it <code>{draft.id}.json</code> and paste.
                      </>
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>{localSaveAvailable ? 'Commit your new file' : 'Propose your file'}</h3>
                  <p>
                    {localSaveAvailable ? (
                      'Your local city updates as soon as the file is saved. Review it, then commit and push it on your contribution branch.'
                    ) : (
                      <>
                        Choose <strong>Commit changes</strong>, then{' '}
                        <strong>Propose changes</strong>.
                      </>
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>3</span>
                <div>
                  <h3>Open a pull request</h3>
                  <p>
                    {localSaveAvailable ? (
                      'Send your file back to the original repository.'
                    ) : (
                      <>
                        Choose <strong>Create pull request</strong>.
                      </>
                    )}{' '}
                    Our checks will help you catch mistakes.
                  </p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <h3>Welcome to the neighborhood</h3>
                  <p>
                    Your first house moves in by itself once the checks pass; anything else waits
                    for a maintainer. Then the town rebuilds with your house, your credit, and your
                    lantern on the Lantern Fork.
                  </p>
                </div>
              </li>
            </ol>
            {localSaveAvailable ? (
              <div className="local-note">
                {savedFile ? (
                  <>
                    Saved to <code>{savedFile}</code>. Ready for your commit.
                  </>
                ) : (
                  'Saves a new file in this project. You choose when to commit, push, and open your PR.'
                )}
              </div>
            ) : repositoryUrl ? (
              <div className="local-note">
                {githubLink ? (
                  'Empty file on GitHub? It can drop the text while it makes your fork. Copy the JSON, start a blank file, and paste.'
                ) : (
                  <>
                    Name the new file <code>{draft.id}.json</code>.
                  </>
                )}{' '}
                <a href={blankHouseFileUrl(repositoryUrl)} target="_blank" rel="noreferrer">
                  Start a blank file <ExternalLink size={12} />
                </a>
              </div>
            ) : (
              <div className="local-note">
                This is the local founding edition. The owner can connect the public repository when
                it’s ready; your file works the same way.
              </div>
            )}
            {savedFile ? (
              <button
                className="button button-primary back-to-design"
                onClick={() => {
                  window.location.hash = `place=${encodeURIComponent(draft.id)}`;
                  window.location.reload();
                }}
              >
                See my place in town <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="text-button back-to-design"
                disabled={saving}
                onClick={() => setStep('design')}
              >
                ← Back to my design
              </button>
            )}
          </div>
          <div className="code-export">
            <JsonGuide />
            <div className="code-heading">
              <span>{draft.id}.json</span>
              <span>JSON</span>
            </div>
            <pre tabIndex={0} aria-label="Your contribution JSON">
              <code>{json}</code>
            </pre>
            {localSaveAvailable && (
              <div className="local-save-action">
                <button
                  className="button button-primary full-width"
                  onClick={save}
                  disabled={saving || !!savedFile}
                >
                  {savedFile ? <Check size={16} /> : <Save size={16} />}
                  {savedFile
                    ? 'Saved to my project'
                    : saving
                      ? 'Saving your place…'
                      : 'Save to my project'}
                </button>
              </div>
            )}
            {githubLink && (
              <div className="local-save-action">
                <a
                  className="button button-primary full-width"
                  href={githubLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Create my house file on GitHub <ExternalLink size={15} />
                </a>
              </div>
            )}
            <div className="export-actions">
              <button
                className={`button ${localSaveAvailable || githubLink ? 'button-secondary' : 'button-primary'}`}
                onClick={copy}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}{' '}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
              <button className="button button-secondary" onClick={download}>
                <Download size={15} /> Download
              </button>
            </div>
            <p className="export-footnote">
              {localSaveAvailable
                ? 'One file in your project. Your first contribution is taking shape.'
                : 'One file. No install needed. A real open-source contribution.'}
            </p>
            {notice && (
              <p role="status" className="form-notice">
                {notice}
              </p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
});
export default Contribute;

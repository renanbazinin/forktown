import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  ExternalLink,
  Paintbrush,
  Save,
  Sparkles,
} from 'lucide-react';
import {
  BUILDING_TYPES,
  DECORATIONS,
  TYPE_LABELS,
  draftSchema,
  placeSchema,
  type Place,
} from '../lib/schema';
import { PLOTS } from '../lib/world';
import { repositoryUrl } from '../lib/places';
import { localSaveAvailable, saveToProject } from '../lib/local-save';
import BuildingPreview from './BuildingPreview';
import Modal from './Modal';
import ResidentPreview from './ResidentPreview';
import { HomeDetails, NeighborDetails, SignDetails } from './Customization';

const COLORS = ['#789B76', '#C97878', '#759BAF', '#AD88AE', '#D0AA65', '#BE8E68'];
const initial = (plot: string, places: Place[]): Place =>
  draftSchema.parse({
    id: availableId('my-little-place', places),
    name: 'My Little Place',
    creator: '',
    plot,
    building: 'cottage',
    color: COLORS[0],
    decoration: 'flowers',
    story: 'A small corner of the internet, made with curiosity and a little courage.',
  });
const storageKey = 'forktown-draft-v2';
function availableId(name: string, places: Place[]) {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 34)
      .replace(/-$/, '') || 'my-place';
  let id = base.length < 3 ? `my-${base}` : base;
  let suffix = 2;
  while (places.some((place) => place.id === id)) id = `${base}-${suffix++}`;
  return id;
}

export default function Contribute({
  plot,
  places,
  onClose,
  onPreview,
}: {
  plot?: string;
  places: Place[];
  onClose: () => void;
  onPreview: (place: Place) => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const occupied = new Set(places.map((place) => place.plot));
  const available = PLOTS.filter((p) => !occupied.has(p.id));
  const [draft, setDraft] = useState<Place>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      const result = draftSchema.safeParse(saved);
      if (result.success)
        return {
          ...result.data,
          plot:
            plot ??
            (occupied.has(result.data.plot) ? (available[0]?.id ?? 'A1') : result.data.plot),
        };
    } catch {
      /* A stale draft should never prevent a new contribution. */
    }
    return initial(plot ?? available[0]?.id ?? 'A1', places);
  });
  const [panel, setPanel] = useState<'home' | 'neighbor' | 'sign'>('home');
  const [customId, setCustomId] = useState(() => draft.id !== availableId(draft.name, places));
  const [step, setStep] = useState<'design' | 'submit'>('design');
  const [attempted, setAttempted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [draftSaved, setDraftSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFile, setSavedFile] = useState('');
  const saveInProgress = useRef(false);
  const parsed = placeSchema.safeParse(draft);
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
      title={step === 'design' ? 'Make yourself at home.' : 'Your place starts here.'}
      onClose={onClose}
      wide
    >
      <div className="contribute-progress">
        <span className={step === 'design' ? 'current' : 'done'}>
          <b>{step === 'submit' ? <Check size={12} /> : 1}</b> Make it yours
        </span>
        <i />
        <span className={step === 'submit' ? 'current' : ''}>
          <b>2</b> Share with the town
        </span>
      </div>
      {step === 'design' ? (
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
                setDraft(initial(plot ?? available[0]?.id ?? 'A1', places));
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
                      <BuildingPreview place={{ ...draft, building: type }} size={62} />
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
                  onChange={(event) => update('story', event.target.value)}
                  aria-invalid={attempted && !!errors.story}
                  aria-describedby={attempted && errors.story ? 'error-story' : undefined}
                />
                <span className="character-count">{draft.story.length}/180</span>
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
            <p className="modal-intro">
              {localSaveAvailable
                ? 'Save your place straight into the project running on this computer. Then share it with the town through your pull request.'
                : 'Your building is ready for its first pull request. Here’s how to give it a permanent home.'}
            </p>
            <ol className="contribution-steps">
              <li>
                <span>1</span>
                <div>
                  <h3>{localSaveAvailable ? 'Save your place' : 'Fork the repository'}</h3>
                  <p>
                    {localSaveAvailable ? (
                      <>
                        Click <strong>Save to my project</strong> to create{' '}
                        <code>places/{draft.id}.json</code> in this local checkout.
                      </>
                    ) : (
                      'Create your own copy of Forktown on GitHub.'
                    )}
                  </p>
                </div>
              </li>
              <li>
                <span>2</span>
                <div>
                  <h3>{localSaveAvailable ? 'Commit your new file' : 'Add one little file'}</h3>
                  <p>
                    {localSaveAvailable ? (
                      'Your local city updates as soon as the file is saved. Review it, then commit and push it on your contribution branch.'
                    ) : (
                      <>
                        Upload <code>{draft.id}.json</code> to the <code>places/</code> folder in
                        your fork. You can do this in your browser.
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
                    Send your file back to the original repository. Our checks will help you catch
                    mistakes.
                  </p>
                </div>
              </li>
              <li>
                <span>4</span>
                <div>
                  <h3>Welcome to the neighborhood</h3>
                  <p>
                    After review and merging, the city rebuilds with your place and your creator
                    credit.
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
              <a
                className="button button-primary"
                href={`${repositoryUrl}/fork`}
                target="_blank"
                rel="noreferrer"
              >
                Fork on GitHub <ExternalLink size={15} />
              </a>
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
            <div className="export-actions">
              <button className="button button-secondary" onClick={copy}>
                {copied ? <Check size={15} /> : <Copy size={15} />}{' '}
                {copied ? 'Copied' : 'Copy JSON'}
              </button>
              <button
                className={`button ${localSaveAvailable ? 'button-secondary' : 'button-primary'}`}
                onClick={download}
              >
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
}

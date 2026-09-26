import type { Place } from '../lib/schema';
import { compileSign, SIGN_EXAMPLE } from '../lib/sign';
import SignPreview from './SignPreview';

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="field">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option === 'classic' ? 'Original style' : option[0].toUpperCase() + option.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}
function Color({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="paint-field">
      <input
        type="color"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span>{label}</span>
    </label>
  );
}
export function HomeDetails({
  draft,
  update,
}: {
  draft: Place;
  update: (value: Place['design']) => void;
}) {
  const change = <K extends keyof Place['design']>(key: K, value: Place['design'][K]) =>
    update({ ...draft.design, [key]: value });
  return (
    <div className="customization-fields">
      <div className="paint-row">
        <Color label="Walls" value={draft.design.wall} onChange={(v) => change('wall', v)} />
        <Color label="Doors & trim" value={draft.design.trim} onChange={(v) => change('trim', v)} />
      </div>
      <div className="field-row">
        <label className="field">
          Floors
          <select
            value={draft.design.floors}
            onChange={(e) => change('floors', Number(e.target.value) as 1 | 2)}
          >
            <option value={1}>One cozy floor</option>
            <option value={2}>Two floors</option>
          </select>
        </label>
        <Choice
          label="Roof"
          value={draft.design.roof}
          options={['classic', 'flat', 'gable']}
          onChange={(v) => change('roof', v)}
        />
      </div>
      <div className="field-row">
        <Choice
          label="Windows"
          value={draft.design.windows}
          options={['cross', 'round', 'shutters']}
          onChange={(v) => change('windows', v)}
        />
        <Choice
          label="Garden"
          value={draft.design.garden}
          options={['wildflowers', 'paving', 'vegetables']}
          onChange={(v) => change('garden', v)}
        />
      </div>
      <Choice
        label="A little extra"
        value={draft.design.feature}
        options={['none', 'porch', 'balcony']}
        onChange={(v) => change('feature', v)}
      />
    </div>
  );
}
export function NeighborDetails({
  resident,
  attempted,
  update,
}: {
  resident: Place['resident'];
  attempted: boolean;
  update: (value: Place['resident']) => void;
}) {
  const change = <K extends keyof Place['resident']>(key: K, value: Place['resident'][K]) =>
    update({ ...resident, [key]: value });
  return (
    <div className="customization-fields">
      <p className="panel-intro">
        Someone to call this place home. Give them a look, a hello, and a simple daily rhythm.
      </p>
      <label className="field">
        Neighbor name
        <input
          aria-invalid={attempted && resident.name.trim().length < 2}
          aria-describedby={
            attempted && resident.name.trim().length < 2 ? 'error-resident' : undefined
          }
          value={resident.name}
          maxLength={24}
          onChange={(e) => change('name', e.target.value)}
        />
      </label>
      <div className="paint-row">
        <Color label="Skin" value={resident.skin} onChange={(v) => change('skin', v)} />
        <Color label="Hair" value={resident.hair} onChange={(v) => change('hair', v)} />
        <Color label="Outfit" value={resident.outfit} onChange={(v) => change('outfit', v)} />
      </div>
      <Choice
        label="Figure"
        value={resident.figure}
        options={['male', 'female']}
        onChange={(v) => change('figure', v)}
      />
      <Choice
        label="Accessory"
        value={resident.accessory}
        options={['none', 'hat', 'glasses']}
        onChange={(v) => change('accessory', v)}
      />
      <label className="field">
        Their way of saying hello
        <input
          aria-invalid={attempted && !resident.greeting.trim()}
          aria-describedby={attempted && !resident.greeting.trim() ? 'error-resident' : undefined}
          value={resident.greeting}
          maxLength={40}
          onChange={(e) => change('greeting', e.target.value)}
        />
        <small>Up to 40 characters. They may say this when passing another neighbor.</small>
      </label>
      <div className="routine-fields">
        <h3>A day in their life</h3>
        <p>Pick a mood for each part of the day. We take care of the wandering.</p>
        {(['morning', 'afternoon', 'evening'] as const).map((period, i) => (
          <label className="field" key={period}>
            <span>
              {period[0].toUpperCase() + period.slice(1)}{' '}
              <small>{['06:00–12:00', '12:00–18:00', '18:00–22:00'][i]}</small>
            </span>
            <select
              value={resident.routine[period]}
              onChange={(e) => change('routine', { ...resident.routine, [period]: e.target.value })}
            >
              <option value="stroll">Stroll around town</option>
              <option value="work">Work at home</option>
              <option value="home">Relax at home</option>
            </select>
          </label>
        ))}
        <label className="field">
          <span>
            Night <small>22:00–06:00</small>
          </span>
          <select
            value={resident.routine.night}
            onChange={(e) =>
              change('routine', {
                ...resident.routine,
                night: e.target.value as 'sleep' | 'stroll',
              })
            }
          >
            <option value="sleep">Sleep through the night</option>
            <option value="stroll">Be a night owl</option>
          </select>
        </label>
        <small>
          Night owls can follow the movies with dancing, take moonlit walks, and relax on their
          doorstep. Each has a bedtime between midnight and 05:00.
        </small>
      </div>
    </div>
  );
}
export function SignDetails({
  sign,
  update,
}: {
  sign: Place['sign'];
  update: (value: Place['sign']) => void;
}) {
  let error = '';
  if (sign.mode === 'html')
    try {
      compileSign(sign.html);
    } catch (cause) {
      error = cause instanceof Error ? cause.message : 'Check your artwork.';
    }
  return (
    <div className="customization-fields">
      <p className="panel-intro">
        A tiny display on the outside of your home. A shop name, a welcome, or your own little
        poster.
      </p>
      <label className="field">
        Sign style
        <select
          value={sign.mode}
          onChange={(e) => update({ ...sign, mode: e.target.value as Place['sign']['mode'] })}
        >
          <option value="text">Simple lettering</option>
          <option value="html">HTML artwork</option>
          <option value="none">No sign</option>
        </select>
      </label>
      {sign.mode !== 'none' && (
        <div className="sign-artwork">
          <SignPreview sign={sign} />
          <span>YOUR OUTDOOR DISPLAY</span>
        </div>
      )}
      {sign.mode === 'text' && (
        <>
          <label className="field">
            Sign lettering
            <input
              value={sign.text}
              maxLength={18}
              onChange={(e) => update({ ...sign, text: e.target.value })}
            />
          </label>
          <div className="paint-row">
            <Color
              label="Lettering"
              value={sign.color}
              onChange={(v) => update({ ...sign, color: v })}
            />
            <Color
              label="Background"
              value={sign.background}
              onChange={(v) => update({ ...sign, background: v })}
            />
          </div>
        </>
      )}
      {sign.mode === 'html' && (
        <>
          <label className="field">
            Artwork HTML
            <textarea
              className="sign-source"
              rows={7}
              spellCheck={false}
              value={sign.html}
              maxLength={2000}
              aria-invalid={!!error}
              aria-describedby="sign-help"
              onChange={(e) => update({ ...sign, html: e.target.value })}
            />
          </label>
          {error && (
            <p className="field-error" role="status">
              {error}
            </p>
          )}
          <button
            type="button"
            className="text-button"
            onClick={() => update({ ...sign, html: SIGN_EXAMPLE })}
          >
            Use a welcome sign example
          </button>
          <div className="sign-help" id="sign-help">
            <p>This is a small artwork language: up to three lines, 24 characters each.</p>
            <p>
              Use <code>div, p, span, strong, b, br</code> and inline{' '}
              <code>color, background-color, font-size, font-weight, text-align</code>. Colors use
              six-digit hex values; sizes: 12, 16, 20, 24 or 28px.
            </p>
            <p>It becomes a flat picture. No links, scripts, images, or outside requests.</p>
          </div>
        </>
      )}
    </div>
  );
}

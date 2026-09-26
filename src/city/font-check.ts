// document.fonts.check() parses and matches its font on every call, and the map asks every
// frame. Its answer only changes when fonts finish or start loading, which moves the set's
// status, so answers are kept until the status changes. Undefined without a document.
const answers = new Map<string, boolean>();
let fontSet: FontFaceSet | undefined;
let seen: FontFaceSetLoadStatus | undefined;

export function fontReady(font: string) {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts) return undefined;
  if (fonts !== fontSet || fonts.status !== seen) {
    fontSet = fonts;
    seen = fonts.status;
    answers.clear();
  }
  let ready = answers.get(font);
  if (ready === undefined) answers.set(font, (ready = fonts.check(font)));
  return ready;
}

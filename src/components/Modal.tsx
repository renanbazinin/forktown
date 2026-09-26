import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { X } from 'lucide-react';

// Open dialogs, newest last. Anything that must stay readable while one is open (a toast) goes
// inside the newest: the rest of the page sits under its backdrop and cannot be reached.
const layers: HTMLDialogElement[] = [];
const watchers = new Set<() => void>();
const announce = () => watchers.forEach((watch) => watch());
function watch(callback: () => void) {
  watchers.add(callback);
  return () => void watchers.delete(callback);
}
/** The open dialog on top of the page, or null. */
export function useTopDialog() {
  return useSyncExternalStore(
    watch,
    () => layers.at(-1) ?? null,
    () => null,
  );
}

export default function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // A layout effect cleans up while the dialog is still in the page, before React removes it.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // Whatever opened the dialog gets focus back when it closes, however it closes.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    layers.push(dialog);
    announce();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      if (layers.includes(dialog)) layers.splice(layers.indexOf(dialog), 1);
      announce();
      document.body.style.overflow = previous;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [title]);
  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? 'modal-wide' : ''}`}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <div className="modal-header">
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id="modal-title">{title}</h2>
        </div>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

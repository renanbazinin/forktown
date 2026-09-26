import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useTopDialog } from './Modal';

/** A short note at the foot of the screen. While a dialog is open it shows inside the dialog, so
 *  it is never blurred under the backdrop and stays in reach of the keyboard. */
export default function Toast({
  icon,
  children,
  onDismiss,
}: {
  icon: ReactNode;
  children: ReactNode;
  onDismiss: () => void;
}) {
  const dialog = useTopDialog();
  const toast = (
    <div className="toast" role="status">
      {icon}
      {children}
      <button aria-label="Dismiss notification" onClick={onDismiss}>
        <X size={15} />
      </button>
    </div>
  );
  return dialog ? createPortal(toast, dialog) : toast;
}

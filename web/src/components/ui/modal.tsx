"use client";

import { ReactNode, RefObject, useEffect, useId, useRef } from "react";

type ModalProps = {
  open: boolean;
  // Called for the X button, Escape, and clicks on the backdrop. The modal
  // never closes itself — the parent owns `open` and decides.
  onClose: () => void;
  title: string;
  children: ReactNode;
  // Focused when the modal opens; otherwise the browser focuses the first
  // focusable element, which is the X button.
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
};

// Built on the native <dialog> via showModal(), which puts it in the top
// layer, makes the page behind it inert, and restores focus to whatever
// opened it when it closes.
export function Modal({
  open,
  onClose,
  title,
  children,
  initialFocusRef,
  className = "max-w-lg",
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Only a press that starts on the backdrop counts as "click outside", so
  // dragging a text selection out of a field doesn't close the modal.
  const pressStartedOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocusRef]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      // Escape: stop the browser closing it directly so `open` stays in sync.
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        pressStartedOnBackdrop.current = e.target === dialogRef.current;
      }}
      onClick={(e) => {
        if (pressStartedOnBackdrop.current && e.target === dialogRef.current) {
          onClose();
        }
      }}
      className={`m-auto w-[calc(100%-2rem)] rounded-app border border-rule bg-paper p-0 text-ink backdrop:bg-paper/80 ${className}`}
    >
      {open && (
        <div className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2
              id={titleId}
              className="font-display text-2xl font-medium leading-tight"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 grid size-8 flex-none cursor-pointer place-items-center rounded-app text-walnut transition-colors hover:text-rosemary focus-visible:outline-2 focus-visible:outline-rosemary"
            >
              <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3.5">
                <path
                  d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

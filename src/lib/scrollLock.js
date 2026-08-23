// Reference-counted body scroll lock shared by every component that needs
// to disable page scroll (Preloader, the mobile nav drawer, the
// Consultation modal). A single "last effect wins" `document.body.style
// .overflow = ...` per component would let one clear it while another is
// still relying on it being locked — this makes multiple simultaneous
// holders safe.
let lockCount = 0;
let previousOverflow = '';

export function lockScroll() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

export function unlockScroll() {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

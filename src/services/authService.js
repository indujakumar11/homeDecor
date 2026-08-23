/**
 * ============================================================================
 * DEVELOPMENT-ONLY MOCK AUTHENTICATION
 * ============================================================================
 * This service is a stand-in so the admin UI can be built and used before a
 * real backend exists. It uses hardcoded credentials and localStorage as a
 * "session" — this is NOT secure and must never be shipped to production.
 *
 * localStorage is trivially readable/writable by anyone with access to the
 * browser (or via XSS), so it provides no real access control.
 *
 * Planned replacement: Supabase Auth (username/password) + Twilio SMS OTP
 * for the verification step. When that lands, only the internals of the
 * functions below change — login()/verifyOtp()/logout()/isAuthenticated()
 * keep the same signatures so the UI (LoginPage, OtpPage, ProtectedRoute)
 * does not need to change.
 * ============================================================================
 */

const SESSION_KEY = 'hd_admin_session';
const PENDING_KEY = 'hd_admin_otp_pending';

const DUMMY_USERNAME = 'admin';
const DUMMY_PASSWORD = 'Admin@123';
const DUMMY_OTP = '123456';

/**
 * Step 1 of login: verify username/password.
 * On success, stores a *pending* record (not yet a full session) so OTP
 * verification remains a required second step.
 */
export function login(username, password) {
  if (!username || !password) {
    return { success: false, message: 'Username and password are required.' };
  }

  if (username.trim() !== DUMMY_USERNAME || password !== DUMMY_PASSWORD) {
    return { success: false, message: 'Invalid username or password.' };
  }

  localStorage.setItem(
    PENDING_KEY,
    JSON.stringify({ username: DUMMY_USERNAME, requestedAt: new Date().toISOString() })
  );

  return { success: true };
}

/**
 * Step 2 of login: verify the OTP for a pending login started by login().
 */
export function verifyOtp(otp) {
  const pending = getPending();
  if (!pending) {
    return { success: false, message: 'No login in progress. Please log in again.' };
  }

  if (!otp || otp.trim() !== DUMMY_OTP) {
    return { success: false, message: 'Invalid OTP. Please try again.' };
  }

  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ username: pending.username, loggedInAt: new Date().toISOString() })
  );
  localStorage.removeItem(PENDING_KEY);

  return { success: true };
}

export function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(PENDING_KEY);
}

export function isAuthenticated() {
  return Boolean(localStorage.getItem(SESSION_KEY));
}

/** Whether a login has passed step 1 and is waiting on OTP verification. */
export function hasPendingOtp() {
  return Boolean(getPending());
}

export function getCurrentUser() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getPending() {
  const raw = localStorage.getItem(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

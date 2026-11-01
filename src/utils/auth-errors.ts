/** Turns Supabase auth errors into plain language for the sign-in and sign-up screens. */
export function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match an account.';
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first. Check your inbox for the link.';
  if (/already registered/i.test(message)) return 'An account with this email already exists. Try signing in.';
  if (/password should be at least/i.test(message)) return 'Your password needs at least 6 characters.';
  if (/token has expired|otp.*(expired|invalid)|invalid.*(token|otp)|session.*missing/i.test(message))
    return 'Your reset link has expired. Ask for a new one from the sign-in screen.';
  if (/different from the old password|same.?password/i.test(message))
    return 'Choose a password you haven’t used for this account before.';
  if (/for security purposes.*after \d+ seconds/i.test(message)) return 'Please wait a minute before asking for another email.';
  if (/rate limit|too many/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
  if (/network|fetch/i.test(message)) return 'Can’t reach Blinkr. Check your internet connection.';
  return message;
}

// In the browser the login session uses the browser's own localStorage.
export const sessionStorage = typeof window !== 'undefined' ? window.localStorage : undefined;

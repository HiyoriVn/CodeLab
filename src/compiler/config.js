/**
 * CodeLab Browser WebAssembly Compiler Configuration & Feature Flags.
 *
 * Feature flag defaults to OFF (false).
 *
 * Security & Governance Rule:
 * - URL parameters (?wasm_compiler=1) and localStorage overrides are ONLY honored
 *   in development environments (localhost, 127.0.0.1, [::1]).
 * - On production domains (such as *.workers.dev), experimental compiler activation
 *   via URL query or localStorage is STRICTLY FORBIDDEN until approved by project owner.
 */

export const FEATURE_FLAGS = {
  inBrowserCompiler: false,
};

export const TOOLCHAIN_CONFIG = {
  manifestUrl: '/toolchain-337/manifest.json',
  cacheNamePrefix: 'codelab-toolchain-',
  expectedCore: '3.3.7',
};

export function isDevEnvironment() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local');
}

export function isStagingEnvironment() {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  if (host === 'codelab.hirovn9395.workers.dev') return false; // Production is strictly locked
  // Any non-production workers.dev subdomain (temporary preview, preview builds, or staging worker)
  if (host.endsWith('.workers.dev')) return true;
  return host.includes('staging') || host.includes('preview') || host.startsWith('test-') || host.startsWith('preview-');
}

export function isBrowserCompilerEnabled() {
  if (typeof window === 'undefined') return false;
  if (FEATURE_FLAGS.inBrowserCompiler) return true;

  // Staging / preview environments have the compiler enabled for validation
  if (isStagingEnvironment()) return true;

  // URL query and localStorage are strictly restricted to development environments
  if (isDevEnvironment()) {
    try {
      if (window.localStorage?.getItem('codelab_wasm_compiler') === 'true') return true;
      if (new URLSearchParams(window.location.search).get('wasm_compiler') === '1') return true;
    } catch (_) {}
  }

  return false;
}

export function setBrowserCompilerEnabled(enabled) {
  FEATURE_FLAGS.inBrowserCompiler = Boolean(enabled);
  if (typeof window === 'undefined') return;
  if (isDevEnvironment()) {
    try {
      if (enabled) {
        window.localStorage?.setItem('codelab_wasm_compiler', 'true');
      } else {
        window.localStorage?.removeItem('codelab_wasm_compiler');
      }
    } catch (_) {}
  }
}

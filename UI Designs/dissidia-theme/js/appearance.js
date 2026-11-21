/* Dissidia Arena appearance helpers v1.0.0
 * Works with css/dissidia-theme.css. No dependencies.
 * The server is the source of truth for unlocks; this file only reflects them.
 */
(function (global) {
  'use strict';

  var REWARD_GOALS = { classic_interface: 25, font_8bit: 50, window_custom: 100 };
  var PREVIEW_KEY = 'da-preview';
  var root = document.documentElement;

  /* Which reward a value needs, or null. Mirrors python/rewards.py required_reward(). */
  function requiredReward(field, value) {
    if (field === 'interface' && value === 'classic') return 'classic_interface';
    if (field === 'menu_font' && value === 'bit8') return 'font_8bit';
    if (field === 'window_theme' && value === 'custom') return 'window_custom';
    if (field === 'window_rgb') return 'window_custom';
    return null;
  }

  /* Custom window colour: channels 0-31, as in the old Config screens.
   * Base = channel x 3 (max 93), so white text always passes 4.5:1. */
  function customWindow(r, g, b) {
    function clamp(n) { n = Math.round(Number(n)); return Math.max(0, Math.min(31, isNaN(n) ? 0 : n)); }
    function hex(n) { var s = Math.max(0, Math.min(255, Math.round(n))).toString(16); return s.length < 2 ? '0' + s : s; }
    function mix(f) { return '#' + hex(base[0] * f) + hex(base[1] * f) + hex(base[2] * f); }
    var base = [clamp(r) * 3, clamp(g) * 3, clamp(b) * 3];
    return { top: mix(1.2), bot: mix(0.45), track: mix(0.25) };
  }

  function setCustomWindow(rgb) {
    var c = customWindow(rgb[0], rgb[1], rgb[2]);
    root.style.setProperty('--win-top', c.top);
    root.style.setProperty('--win-bot', c.bot);
    root.style.setProperty('--win-track', c.track);
  }

  function clearCustomWindow() {
    ['--win-top', '--win-bot', '--win-track'].forEach(function (p) { root.style.removeProperty(p); });
  }

  /* Apply a preferences object (same shape as GET /api/me/appearance .preferences). */
  function applyAppearance(p) {
    if (!p) return;
    if (p.interface) root.setAttribute('data-interface', p.interface);
    if (p.world) root.setAttribute('data-world', p.world);
    if (p.window_theme) root.setAttribute('data-window', p.window_theme);
    if (p.menu_font) {
      if (p.menu_font === 'auto') root.removeAttribute('data-menu-font');
      else root.setAttribute('data-menu-font', p.menu_font);
    }
    if (p.cursor) root.setAttribute('data-cursor', p.cursor);
    if (p.window_theme === 'custom' && p.window_rgb) setCustomWindow(p.window_rgb);
    else if (p.window_theme && p.window_theme !== 'custom') clearCustomWindow();
  }

  function readAppearance() {
    return {
      interface: root.getAttribute('data-interface') || 'rift',
      world: root.getAttribute('data-world') || 'dissidia',
      window_theme: root.getAttribute('data-window') || 'classic',
      menu_font: root.getAttribute('data-menu-font') || 'auto',
      cursor: root.getAttribute('data-cursor') || 'glove'
    };
  }

  /* Save a change: apply at once, PATCH in the background, revert on error.
   * onLocked(body) is called with the 403 body ({error, reward, goal, remaining}). */
  function saveAppearance(changes, opts) {
    opts = opts || {};
    var before = readAppearance();
    applyAppearance(changes);
    return fetch(opts.url || '/api/me/appearance', {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
      credentials: 'same-origin',
      body: JSON.stringify(changes)
    }).then(function (res) {
      if (res.ok) return res.json();
      applyAppearance(before);
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.status === 403 && opts.onLocked) opts.onLocked(body);
        throw Object.assign(new Error('appearance save failed'), { status: res.status, body: body });
      });
    });
  }

  /* Interface changes swap the layout, so save first, then reload. */
  function switchInterface(value, opts) {
    opts = opts || {};
    return fetch(opts.url || '/api/me/appearance', {
      method: 'PATCH',
      headers: Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {}),
      credentials: 'same-origin',
      body: JSON.stringify({ interface: value })
    }).then(function (res) {
      if (res.ok) { endPreview(false); global.location.reload(); return; }
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.status === 403 && opts.onLocked) opts.onLocked(body);
      });
    });
  }

  /* Preview: client-only, saves nothing. */
  function startPreview() {
    try { sessionStorage.setItem(PREVIEW_KEY, 'classic'); } catch (e) {}
    global.location.reload();
  }
  function endPreview(reload) {
    try { sessionStorage.removeItem(PREVIEW_KEY); } catch (e) {}
    if (reload !== false) global.location.reload();
  }
  function isPreviewing() {
    try { return sessionStorage.getItem(PREVIEW_KEY) === 'classic'; } catch (e) { return false; }
  }

  /* Put this inline in <head> (copy the body of this function) to avoid a flash.
   * `locked` should be rendered by the server: true if the player lacks classic_interface. */
  function applyPreviewBeforePaint(locked) {
    if (locked && isPreviewing()) {
      root.setAttribute('data-interface', 'classic');
      root.setAttribute('data-preview', 'classic');
    }
  }

  /* Progress helper for reward bars. */
  function rewardProgress(wins, key) {
    var goal = REWARD_GOALS[key];
    return { goal: goal, done: Math.min(wins, goal), remaining: Math.max(0, goal - wins), percent: Math.min(100, Math.round(wins / goal * 100)), unlocked: wins >= goal };
  }

  global.DissidiaAppearance = {
    REWARD_GOALS: REWARD_GOALS,
    requiredReward: requiredReward,
    customWindow: customWindow,
    applyAppearance: applyAppearance,
    readAppearance: readAppearance,
    saveAppearance: saveAppearance,
    switchInterface: switchInterface,
    startPreview: startPreview,
    endPreview: endPreview,
    isPreviewing: isPreviewing,
    applyPreviewBeforePaint: applyPreviewBeforePaint,
    rewardProgress: rewardProgress
  };
})(window);

#!/usr/bin/env node
/**
 * Pulse Assist feature playbooks data (UI step docs per module feature).
 */

/** @param {string} id @param {string} moduleId @param {string} label @param {string} question @param {string} pulseNav @param {string[]} steps @param {string[]} [aliases] */
function pb(id, moduleId, label, question, pulseNav, steps, aliases = []) {
  return { id, moduleId, label, question, pulseNav, steps, aliases };
}

module.exports = { pb };

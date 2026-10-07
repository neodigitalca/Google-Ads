#!/usr/bin/env node
/** Pulse Assist feature playbooks (merged). */
const { FEATURE_PLAYBOOKS_PART_A } = require("./feature-playbooks.data-a.cjs");
const { FEATURE_PLAYBOOKS_PART_B } = require("./feature-playbooks.data-b.cjs");

const FEATURE_PLAYBOOKS = [...FEATURE_PLAYBOOKS_PART_A, ...FEATURE_PLAYBOOKS_PART_B];

module.exports = { FEATURE_PLAYBOOKS };

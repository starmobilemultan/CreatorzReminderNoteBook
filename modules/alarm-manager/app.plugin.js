/**
 * app.plugin.js — Expo Config Plugin entry point for creatorz-alarm-manager
 *
 * Expo SDK 53 requires the plugin entry point to be named `app.plugin.js`
 * at the root of the module directory. When app.json references
 * `"./modules/alarm-manager"`, Expo automatically loads this file.
 *
 * This file simply re-exports the full plugin implementation from plugin.js.
 */
module.exports = require('./plugin');

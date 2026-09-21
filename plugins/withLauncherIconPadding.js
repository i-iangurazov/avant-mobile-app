const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Keep the existing brand asset inside Android's adaptive-icon safe zone.
// The white background fills the launcher mask; only the foreground is inset.
module.exports = function withLauncherIconPadding(config) {
  return withFinalizedMod(config, ['android', async (mod) => {
    const resources = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res');
    for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
      const file = path.join(resources, 'mipmap-anydpi-v26', name);
      const xml = await fs.readFile(file, 'utf8');
      const original = '<foreground android:drawable="@mipmap/ic_launcher_foreground"/>';
      const padded = '<foreground><inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="18%"/></foreground>';
      if (!xml.includes(original) && !xml.includes(padded)) {
        throw new Error(`Unexpected adaptive icon format: ${name}. Review launcher padding before release.`);
      }
      await fs.writeFile(file, xml.replace(original, padded));
    }
    return mod;
  }]);
};

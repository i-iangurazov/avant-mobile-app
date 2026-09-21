const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

// Keep the React activity (and unfinished forms) alive when the user changes
// accessibility font or display size. A recreated Activity can leave Fabric's
// retained surface using the old Activity density. Keep its context current.
// RN receives the configuration/resume events;
// AppText invalidates Fabric's cached text nodes for the new font scale.
module.exports = function withFontScaleChanges(config) {
  return withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const changes = new Set((activity.$['android:configChanges'] || '').split('|').filter(Boolean));
    changes.add('fontScale');
    changes.add('density');
    activity.$['android:configChanges'] = [...changes].join('|');
    return mod;
  });
};

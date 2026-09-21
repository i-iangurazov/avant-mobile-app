const { withAndroidManifest, withMainActivity, AndroidConfig } = require('expo/config-plugins');

// Keep the React activity (and unfinished forms) alive when the user changes
// accessibility font or display size. A recreated Activity can leave Fabric's
// retained surface using the old Activity density. Keep its context current.
// RN receives the configuration/resume events;
// AppText invalidates Fabric's cached text nodes for the new font scale.
module.exports = function withFontScaleChanges(config) {
  config = withAndroidManifest(config, (mod) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const changes = new Set((activity.$['android:configChanges'] || '').split('|').filter(Boolean));
    changes.add('fontScale');
    changes.add('density');
    activity.$['android:configChanges'] = [...changes].join('|');
    return mod;
  });
  return withMainActivity(config, (mod) => {
    const marker = '// Avantehnik: refresh RN pixel metrics before density remeasurement';
    if (mod.modResults.contents.includes(marker)) return mod;
    const anchor = '  override fun onCreate(';
    if (mod.modResults.language !== 'kt' || !mod.modResults.contents.includes(anchor) || mod.modResults.contents.includes('override fun onConfigurationChanged(')) {
      throw new Error('Review MainActivity configuration handling before applying density fix.');
    }
    const method = `  ${marker}
  override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
    com.facebook.react.uimanager.DisplayMetricsHolder.initDisplayMetrics(this)
    super.onConfigurationChanged(newConfig)
    findViewById<android.view.ViewGroup>(android.R.id.content)?.getChildAt(0)?.requestLayout()
  }

`;
    mod.modResults.contents = mod.modResults.contents.replace(anchor, method + anchor);
    return mod;
  });
};

// react-native-screens 4.16 retains the Fabric frame in DIP when display density
// changes without changing pixel bounds. onLayout(changed=false) skips its state
// update, so the screen overflows or leaves blank space until a process restart.
// Recompute native-stack state on configuration changes, preserving form state.
const fs = require('node:fs');
const path = require('node:path');
const root = path.dirname(require.resolve('react-native-screens/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '4.16.0') throw new Error('Review density patch before changing react-native-screens.');
const file = path.join(root, 'android/src/main/java/com/swmansion/rnscreens/Screen.kt');
let source = fs.readFileSync(file, 'utf8');
const marker = '// Avantehnik: refresh DIP frame when pixel bounds do not change';
if (source.includes(marker)) process.exit(0);
const anchor = '    override fun onLayout(';
if (!source.includes(anchor) || source.includes('override fun onConfigurationChanged(')) throw new Error('Screen configuration source changed; review required.');
const method = `    ${marker}
    override fun onConfigurationChanged(newConfig: android.content.res.Configuration) {
        super.onConfigurationChanged(newConfig)
        if (isNativeStackScreen && width > 0 && height > 0) {
            dispatchShadowStateUpdate(width, height, top)
            if (!usesFormSheetPresentation()) notifyHeaderHeightChange(top)
        }
    }

`;
source = source.replace(anchor, method + anchor);
fs.writeFileSync(file, source);
console.log('Applied native screen density state update.');

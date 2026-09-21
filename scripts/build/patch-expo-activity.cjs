// Expo SDK54 may reuse AppContext without forwarding onHostDestroy when an
// Android Activity is replaced. Its old ActivityResult launchers are then
// unregistered. Bind contracts to the actual resumed Activity, not only the
// React lifecycle flag. Regression: Release recreation followed by Photo Picker.
const fs = require('node:fs');
const path = require('node:path');
const root = path.dirname(require.resolve('expo-modules-core/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
if (version !== '3.0.30') throw new Error('Review ActivityResult lifecycle patch before changing expo-modules-core.');
const file = path.join(root, 'android/src/main/java/expo/modules/kotlin/AppContext.kt');
let source = fs.readFileSync(file, 'utf8');
const marker = 'private var contractsActivity: WeakReference<Activity>? = null';
if (source.includes(marker)) process.exit(0);
const field = 'private var hostWasDestroyed = false';
const before = `    // We need to re-register activity contracts when reusing AppContext with new Activity after host destruction.
    if (hostWasDestroyed) {
      hostWasDestroyed = false
      hostingRuntimeContext.registry.registerActivityContracts()
    }

    activityResultsManager.onHostResume(activity)`;
const after = `    // A retained React host can replace its Activity without onHostDestroy.
    val activityChanged = contractsActivity != null && contractsActivity?.get() !== activity
    contractsActivity = WeakReference(activity)
    // Publish the current owner before contracts can request an Activity.
    activityResultsManager.onHostResume(activity)
    if (hostWasDestroyed || activityChanged) {
      hostWasDestroyed = false
      hostingRuntimeContext.registry.registerActivityContracts()
    }`;
if (!source.includes(field) || !source.includes(before)) throw new Error('Expo ActivityResult patch source changed; review required.');
source = source.replace(field, field + '\n  ' + marker).replace(before, after);
fs.writeFileSync(file, source);
console.log('Applied reviewed Expo ActivityResult owner lifecycle patch.');

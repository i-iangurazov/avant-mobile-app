from pathlib import Path
import os,subprocess
root=Path.cwd();jdk=Path('/private/tmp/avantehnik-device-tools/java-home.txt').read_text();sdk='/private/tmp/avantehnik-android-sdk'
gradle='/Users/ilias_iangurazov/.gradle/wrapper/dists/gradle-8.14.3-all/10utluxaxniiv4wxiphsi49nj/gradle-8.14.3/bin/gradle'
env=dict(os.environ,JAVA_HOME=jdk,ANDROID_HOME=sdk,ANDROID_SDK_ROOT=sdk,EXPO_NO_DOTENV='1',EXPO_PUBLIC_API_URL='http://127.0.0.1:8789',EXPO_NO_TELEMETRY='1',NODE_ENV='production',CI='1');env['PATH']=jdk+'/bin:'+env['PATH']
with (root/'artifacts/device-20260921/logs/android-release.log').open('w')as log:
 p=subprocess.run([gradle,':app:assembleRelease',':app:bundleRelease','-Dorg.gradle.internal.http.connectionTimeout=5000','-Dorg.gradle.internal.http.socketTimeout=10000','-Djava.net.preferIPv4Stack=true','--init-script',str(root/'artifacts/device-20260921/align-agp.gradle'),'--no-daemon','--max-workers=1','-PreactNativeArchitectures=arm64-v8a'],cwd='/private/tmp/avantehnik-device-build-20260921/android',env=env,stdout=log,stderr=subprocess.STDOUT)
print('Android release build exit',p.returncode);raise SystemExit(p.returncode)

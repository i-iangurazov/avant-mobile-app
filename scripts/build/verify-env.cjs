// EAS invokes this before dependency installation. Local verification is read-only.
const required=process.argv.includes('--required')||process.env.EAS_BUILD_PROFILE==='production';
if(required){
 const raw=process.env.EXPO_PUBLIC_API_URL;
 if(!raw)throw Error('Release requires explicit EXPO_PUBLIC_API_URL for the approved backend.');
 const url=new URL(raw);
 if(url.protocol!=='https:'||url.username||url.password||url.hostname==='localhost'||url.hostname.endsWith('.invalid')||/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname))throw Error('Release API must be an approved reachable HTTPS service, not a local/test placeholder.');
 if(process.env.EXPO_PUBLIC_DEBUG_API_ERRORS==='true')throw Error('Public debug API errors must be disabled for release.');
 console.log('Release environment shape validated; backend health/compatibility still require staging verification.');
}

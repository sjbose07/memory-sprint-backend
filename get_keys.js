const { execSync } = require('child_process');
const os = require('os');
const path = require('path');

try {
  const ksPath = path.join(os.homedir(), '.android', 'debug.keystore');
  const out = execSync(`keytool -list -v -keystore "${ksPath}" -alias androiddebugkey -storepass android -keypass android`).toString();
  
  const lines = out.split('\n');
  lines.forEach(l => {
     if(l.includes('SHA1:') || l.includes('SHA256:')) {
         console.log(l.trim());
     }
  });
} catch(e) {
  console.log("Error:", e.message);
}

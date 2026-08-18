const fs = require('fs');
const path = require('path');

require('dotenv').config();

const runningInDocker = fs.existsSync('/.dockerenv');
const hostEnvPath = path.join(__dirname, '..', '.env.host');

if (!runningInDocker && fs.existsSync(hostEnvPath)) {
  require('dotenv').config({ path: hostEnvPath, override: true });
}

module.exports = { runningInDocker };

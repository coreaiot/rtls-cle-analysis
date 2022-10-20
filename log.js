const fs = require('fs/promises');
const moment = require('moment');
const axios = require('axios');
const { join } = require('path');

main();

async function main() {
  if (process.argv.length !== 4) {
    console.log(`使用方法:
    node log.js <API 接口 URL> <时长（秒）>
    
    例： 
        node log.js http://localhost:44444 600
`);

    process.exit(0)
  }

  const APIEndpoint = process.argv[2];
  const durationInSecs = Number(process.argv[3]);

  const endpoint = APIEndpoint + '/beacons';

  const dirname = moment().format('YYMMDDHHmmss');
  const dir = join('logs', dirname);
  await fs.mkdir(dir, { recursive: true });

  const itv = 200;
  const durationInItv = durationInSecs * 1000 / itv;
  // const oneHourInItv = 60 * 60 * 1000 / itv;

  for (let i = 0; i < durationInItv; ++i) {
    // const h = Math.floor(i / oneHourInItv);
    await Promise.all([
      new Promise(r => setTimeout(r, itv)),
      (async () => {
        try {
          const res = await axios.get(endpoint);
          const ts = '[' + moment().format('MM-DD HH:mm:ss SSS') + ']';
          for (const mac of Object.keys(res.data)) {
            if (typeof res.data[mac].x === 'number' && typeof res.data[mac].y === 'number' && typeof res.data[mac].z === 'number' && typeof res.data[mac].rssi === 'number' && res.data[mac].userData && res.data[mac].userData[8] && res.data[mac].userData[8].gSensors) {
              const f = join(dir, `${mac}.log`);
              const msg = [ts, mac, res.data[mac].x.toFixed(2), res.data[mac].y.toFixed(2), res.data[mac].z.toFixed(2), res.data[mac].rssi.toFixed(2), ...res.data[mac].userData[8].gSensors].join(' ');
              console.log(msg);
              await fs.appendFile(f, msg + '\n');
            }
          }
        } catch { }
      })()
    ])
  }
}
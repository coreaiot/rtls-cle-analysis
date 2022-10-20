const arg = require('arg');

main();

async function main() {
  const args = arg({
    // Types
    '--dir': String,
    '--mean-th': String,
    '--real-th': String,
    '--beacon': [String],
    '--help': Boolean,

    // Aliases
    '-d': '--dir',
    '-m': '--mean-th',
    '-r': '--real-th',
    '-b': '--beacon',
    '-h': '--help',
  });

  const {
    dir,
    meanTh,
    realTh,
    beacons
  } = (() => {

    try {
      if (args['--help'])
        throw '0';
      if (!args['--dir'] || !args['--mean-th'] || !args['--beacon'])
        throw '1';

      const dir = args['--dir'];
      const meanTh = args['--mean-th'].split(',').map(Number);
      for (const t of meanTh)
        if (typeof t !== 'number')
          throw '';

      let realTh = null;
      if (args['--real-th']) {
        realTh = args['--real-th'].split(',').map(Number);
        for (const t of realTh)
          if (typeof t !== 'number')
            throw '2';
      }

      const beacons = args['--beacon'].map(x => {
        const [mac, realX, realY, realZ] = x.split(',');
        return { mac, realX: Number(realX), realY: Number(realY), realZ: Number(realZ) };
      })
      for (const b of beacons) {
        if (typeof b.mac !== 'string' || typeof b.realX !== 'number' || typeof b.realY !== 'number' || typeof b.realZ !== 'number'
          || isNaN(b.realX) || isNaN(b.realY) || isNaN(b.realZ)
        )
          throw '3';
      }

      return { dir, meanTh, realTh, beacons };

    } catch (e) {
      console.log(`使用方法: node analyze.js ...options

Options:
    <-d, --dir>          日志目录
    <-m, --mean-th>      样本值与均值坐标误差范围 mean_th_1,mean_th_2,mean_th_3
    [-r, --real-th]      样本值与实际坐标误差范围 real_th_1,real_th_2,real_th_3
    <-b, --beacon>...    信标实际位置 mac,real_x,real_y,real_z
    
例： 
    node analyze.js -d logs/201019153143 -m 1,1.5,2 -b 3cfad3b0f0fb,1.48,-1.05,1.20 -b 3cfad3b0f6f9,1.20,3.62,1.20
`);
      process.exit(0);
    }
  })();

  const events = require('events');
  const fs = require('fs');
  const readline = require('readline');
  const { sync } = require('glob');

  const results = [
    ['MAC', 'Mean X', 'Mean Y', 'Mean Z', 'STD X', 'STD Y', 'STD Z', 'ERR X', 'ERR Y', 'ERR Z', '#Samples', 'RM 1', 'RM 2', 'RM 3', 'RR 1', 'RR 2', 'RR 3']
  ];

  for (const beacon of beacons) {
    const files = sync(dir + '/' + beacon.mac + '*.log');
    const xs = [];
    const ys = [];
    const zs = [];
    for (const f of files) {
      console.log('解析', f, '...');
      const rl = readline.createInterface({
        input: fs.createReadStream(f),
        crlfDelay: Infinity
      });

      rl.on('line', (line) => {
        const [_, __, ___, ____, x, y, z, _____] = line.split(' ');
        xs.push(Number(x));
        ys.push(Number(y));
        zs.push(Number(z));
      });

      await events.once(rl, 'close');
    }

    const meanX = xs.reduce((a, b) => a + b) / xs.length;
    const meanY = ys.reduce((a, b) => a + b) / ys.length;
    const meanZ = zs.reduce((a, b) => a + b) / zs.length;

    // std_x =  sqrt( sum( (x - meax)*(x - meax) ) /  (N -1) ), 
    const stdX = Math.sqrt(xs.map(x => (x - meanX) ** 2).reduce((a, b) => a + b) / xs.length);
    const stdY = Math.sqrt(ys.map(y => (y - meanY) ** 2).reduce((a, b) => a + b) / ys.length);
    const stdZ = Math.sqrt(zs.map(z => (z - meanZ) ** 2).reduce((a, b) => a + b) / zs.length);

    const errX = meanX - beacon.realX;
    const errY = meanY - beacon.realY;
    const errZ = meanZ - beacon.realZ;

    // sqrt((x-mean_x)*(x-mean_x) + (y-mean_y)*(y-mean_y) + (z-mean_z)*(z-mean_z)) 
    let nRatioMean1 = 0;
    let nRatioMean2 = 0;
    let nRatioMean3 = 0;
    let nRatioReal1 = 0;
    let nRatioReal2 = 0;
    let nRatioReal3 = 0;
    for (let i = 0; i < xs.length; ++i) {
      const m = Math.sqrt((xs[i] - meanX) ** 2 + (ys[i] - meanY) ** 2 + (zs[i] - meanZ) ** 2);
      // console.log('m:', m, meanTh)
      if (m < meanTh[0])
        nRatioMean1++;
      if (m < meanTh[1])
        nRatioMean2++;
      if (m < meanTh[2])
        nRatioMean3++;
      if (realTh) {
        const r = Math.sqrt((xs[i] - beacon.realX) ** 2 + (ys[i] - beacon.realY) ** 2 + (zs[i] - beacon.realZ) ** 2);
        if (r < realTh[0])
          nRatioReal1++;
        if (r < realTh[1])
          nRatioReal2++;
        if (r < realTh[2])
          nRatioReal3++;
      }
    }
    const ratioMean1 = +(nRatioMean1 / xs.length * 100).toFixed(2) + '%';
    const ratioMean2 = +(nRatioMean2 / xs.length * 100).toFixed(2) + '%';
    const ratioMean3 = +(nRatioMean3 / xs.length * 100).toFixed(2) + '%';

    let ratioReal1 = '-';
    let ratioReal2 = '-';
    let ratioReal3 = '-';
    if (realTh) {
      ratioReal1 = +(nRatioReal1 / xs.length * 100).toFixed(2) + '%';
      ratioReal2 = +(nRatioReal2 / xs.length * 100).toFixed(2) + '%';
      ratioReal3 = +(nRatioReal3 / xs.length * 100).toFixed(2) + '%';
    }

    const res = [
      beacon.mac,

      +meanX.toFixed(2),
      +meanY.toFixed(2),
      +meanZ.toFixed(2),

      +stdX.toFixed(2),
      +stdY.toFixed(2),
      +stdZ.toFixed(2),

      +errX.toFixed(2),
      +errY.toFixed(2),
      +errZ.toFixed(2),

      xs.length,

      ratioMean1,
      ratioMean2,
      ratioMean3,
      ratioReal1,
      ratioReal2,
      ratioReal3,
    ];
    results.push(res);
  }

  const { table } = require('table');
  console.log(table(results));
}
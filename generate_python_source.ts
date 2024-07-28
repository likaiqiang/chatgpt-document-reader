import os from 'os';
import {x} from 'tar';
import fs,{createWriteStream} from 'fs'
import path from 'path';
import { Readable } from 'stream';
import {SingleBar} from 'cli-progress';
import { fetch, ProxyAgent, RequestInit } from 'undici';

const bar = new SingleBar({
  format: 'Downloading |{bar}| {percentage}% || {value}/{total} Chunks',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
  hideCursor: true
});

function selectCPythonBuild() {
  const platform = os.platform();
  const arch = os.arch();
  let build = 'cpython-3.10.14+20240415-';

  if (platform === 'win32') {
    build += 'x86_64-pc-windows-msvc';
  } else if (platform === 'darwin') {
    build += 'x86_64-apple-darwin';
  } else if (platform === 'linux') {
    build += 'x86_64-unknown-linux-gnu';
  } else {
    return null;
  }

  if (arch === 'x64') {
    build += '-install_only.tar.gz';
  } else if (arch.startsWith('arm')) {
    build += '-armv7-unknown-linux-gnueabihf-install_only.tar.gz';
  } else {
    build += '-i686-pc-windows-msvc-install_only.tar.gz';
  }

  return build;
}

function delay(seconds?:number) {
  if (!seconds) seconds = Math.floor(5 + 5 * Math.random());
  const delay = seconds * 1000;
  return new Promise(resolve => setTimeout(resolve, delay))
}

async function retry<T>(action: () => Promise<T>): Promise<T> {
  for (let attempt = 0;;) {
    try {
      return await action();
    } catch (err) {
      if (++attempt === 3) throw err;
    }
    await delay();
  }
}

function fetchSafely(url:string, token:string, options: RequestInit = {}) {
  return retry(async () => {
    if (!token) token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    options.headers = {
      'User-Agent': 'prantlf/grab-github-release',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) {
      options.headers = {
        Authorization: `Bearer ${token}`,
        ...options.headers
      };
    }
    const proxy = process.env.http_proxy || process.env.https_proxy
    const res = await fetch(url, {
      ...options,
      dispatcher: proxy ? new ProxyAgent(proxy) : undefined
    });
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        const after = res.headers.get('retry-after');
        const reset = res.headers.get('x-ratelimit-reset');
        // const {
        //   'retry-after': after,
        //   'x-ratelimit-limit': limit,
        //   'x-ratelimit-remaining': remaining,
        //   'x-ratelimit-used': used,
        //   'x-ratelimit-reset': reset,
        //   'x-ratelimit-resource': resource
        // } = res.headers;

        const wait = after || reset;
        if (wait) {
          await delay(Number(wait));
        }
      }
      const err = new Error(`GET "${url}" failed: ${res.status} ${res.statusText}`) as Error & { response: Response };
      // err.response = res;
      throw err
    }
    return res
  })
}


async function download(url:string, archive:string, token?:string) {
  const res = await fetchSafely(url, token)
  const totalSize = parseInt(res.headers.get('content-length'), 10);
  await new Promise((resolve, reject) => {
    bar.start(totalSize, 0);
    const stream = Readable.fromWeb(res.body)
    stream
      .on('data', chunk=>{
        bar.increment(chunk.length)
      })
    stream.pipe(createWriteStream(archive))

      .on('finish', ()=>{
        bar.stop()
        resolve('')
      })
      .on('error', ()=>{
        bar.stop()
        reject('')
      })
  })
}


async function downloadAndExtractBuild(downloadUrl:string, extractPath:string) {
  // 检查提取路径是否存在，如果不存在则创建
  if (!fs.existsSync(extractPath)) {
    fs.mkdirSync(extractPath, { recursive: true });
  }
  const buildName = downloadUrl.split('/').pop()

  // 创建一个临时文件来保存下载的tar.gz文件
  const tempFilePath = path.join(extractPath, buildName);
  await download(downloadUrl, tempFilePath);
  console.log(`${buildName} start extract`);
  await x({
    file: tempFilePath,
    C: extractPath,
    strip: 1
  });

  // 删除临时tar.gz文件
  fs.unlinkSync(tempFilePath);

  console.log(`${buildName} has been downloaded and extracted to ${extractPath}`);
}



const buildName = selectCPythonBuild()
downloadAndExtractBuild(
  `https://github.com/indygreg/python-build-standalone/releases/download/20240415/${buildName}`,
  path.join(process.cwd(),'src','assets','python_source')
).then(()=>{
  console.log('python install done')
})

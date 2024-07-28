import { exec } from 'child_process';
import path from 'path';
import fs from 'fs'
import os from 'os';

function getPythonPath() {
  const platform = os.platform();
  if (platform === 'win32'){
    return path.join(process.cwd(),'src','assets','python_source','python')
  }
  if (platform === 'linux'){
    return path.join(process.cwd(),'src','assets','python_source','bin','python')
  }
  if (platform === 'darwin'){
    return path.join(process.cwd(),'src','assets','python_source','bin','python')
  }
}

const pythonPath = getPythonPath()

async function installPythonPackage(packageName:string) {
  console.log(`install ${packageName}`)
  const command = `${pythonPath} -m pip install ${packageName}`;
  return new Promise((resolve, reject)=>{
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(error);
        return reject(error)
      }
      if (stdout) {
        console.log(stdout);
        return resolve(stdout)
      }
      if (stderr) {
        console.error(stderr);
        return reject(stderr)
      }
    });
  })
}
function parseRequirementsTxt() {
  const requirementsPath = path.join(process.cwd(),'src','assets','python_code','requirements.txt')
  const requirementsText = fs.readFileSync(requirementsPath,'utf-8')
    // 将文本按行分割
  const lines = requirementsText.split('\n');
  const requirements = [];

  for (const line of lines) {
      // 去除首尾空格
      const trimmedLine = line.trim();
      if (trimmedLine && !trimmedLine.startsWith('#')) {
          // 非空行且不是注释行，添加到数组
          requirements.push(trimmedLine);
      }
  }

  return requirements;
}

const parsedRequirements = parseRequirementsTxt()

Promise.all(parsedRequirements.map(installPythonPackage)).then(()=>{
  console.log('python package install success')
})


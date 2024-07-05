import { exec } from 'child_process';
import path from 'path';
import fs from 'fs'
const pythonPath = path.join(process.cwd(),'src','assets','python_source','python')

async function installPythonPackage(packageName:string) {
  console.log(`install ${packageName}`)
  const command = `${pythonPath} -m pip install ${packageName}`;
  return new Promise((resolve, reject)=>{
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`执行出错: ${error}`);
        return reject(error)
      }
      if (stdout) {
        console.log(`标准输出: ${stdout}`);
        return resolve(stdout)
      }
      if (stderr) {
        console.error(`标准错误输出: ${stderr}`);
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

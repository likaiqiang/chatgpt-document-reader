const fs = require('fs');
const path = require('path');

function copyFiles(sourceDir, destinationDir) {
  // 读取源文件夹中的所有文件
  const files = fs.readdirSync(sourceDir);

  if (!fs.existsSync(destinationDir)) {
    fs.mkdirSync(destinationDir, { recursive: true });
  }

  // 遍历每个文件并复制到目标文件夹
  files.forEach((file) => {
    const sourcePath = path.join(sourceDir, file);
    const destinationPath = path.join(destinationDir, file);

    // 使用 createReadStream 和 createWriteStream 进行文件复制
    const readStream = fs.createReadStream(sourcePath);
    const writeStream = fs.createWriteStream(destinationPath);

    // 执行文件复制
    readStream.pipe(writeStream);
  });

  console.log('Files copied successfully!');
}

// 用法示例
const sourceFolder = path.join(__dirname,'node_modules','faiss-node','build','Release')
const destinationFolder = path.join(__dirname,'src','assets','node','build')

copyFiles(sourceFolder, destinationFolder);

import inspector from 'node:inspector';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

// 创建 inspector 会话
const session = new inspector.Session();
session.connect();

// 获取 __dirname 等效路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 启用性能分析
session.post('Profiler.enable', (err) => {
  if (err) {
    console.error('Error enabling profiler:', err);
    return;
  }

  // 启动性能分析
  session.post('Profiler.start', async (err) => {
    if (err) {
      console.error('Error starting profiler:', err);
      return;
    }

    try {
      // 动态导入并启动 web server
      await import('@electron-forge/cli/dist/electron-forge-start.js');

      console.log('Web server started. Press Ctrl+C to stop profiling and generate report.');
    } catch (importErr) {
      console.error('Error importing module:', importErr);
    }
  });
});

// 监听 Ctrl+C 事件以停止性能分析
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('SIGINT', () => {
  session.post('Profiler.stop', (err, { profile }) => {
    if (err) {
      console.error('Error stopping profiler:', err);
      return;
    }

    // 将性能数据保存到文件
    const filePath = path.resolve(__dirname, 'profile.json');
    fs.writeFile(filePath, JSON.stringify(profile), (err) => {
      if (err) {
        console.error('Error saving profile:', err);
        return;
      }
      console.log(`Profile saved to ${filePath}`);
      process.exit();
    });
  });
});

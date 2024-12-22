import filepath from 'path';
import { Document } from '@/types/document';
import fg from 'fast-glob';
import fs from 'fs/promises';
import { supportedLanguages } from '@/electron/ingest-data';
import { splitCode } from '@/utils/code';
import ZIPLoader from '@/loaders/zip';

class CodeLoader {
  async parse(path: string): Promise<Document<Record<string, any>>[]> {
    //{"file_name": file.name, "suffix": file.suffix.lower(), "source": str(file.resolve())}
    const patterns = supportedLanguages.map(language => {
      return '**/*' + language;
    });
    const files = await fg(patterns, { cwd: path, absolute: true });
    const fileReadPromises = files.map(file => {
      return () => {
        return fs.readFile(file, 'utf-8').then(async content => {
          return await splitCode({
            code: content,
            suffix: filepath.extname(file),
            metadata: {
              file_name: filepath.basename(file),
              suffix: filepath.extname(file),
              source: file
            }
          })
        });
      };
    });
    const docs = await ZIPLoader.promiseAllWithConcurrency(fileReadPromises)
    return docs.flat()
  }
}

export default CodeLoader;

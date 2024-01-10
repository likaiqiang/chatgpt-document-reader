import jszip from 'jszip';

class ZIPLoader{
  async parse(raw: Buffer, filter: (path:string)=>boolean): Promise<{path:string,content: string}[]>{
    if(typeof filter === 'undefined'){
      filter = ()=> true
    }
    const zip = await jszip.loadAsync(raw);
    console.log('zip',zip);
    const filesContentTasks: Array<Promise<{path: string, content: string}>> = []
    zip.forEach( (relativePath, file) => {
      if (!file.dir && filter(relativePath)) {
        filesContentTasks.push(
          file.async('string').then(content=>{
            return {
              content,
              path: relativePath
            }
          })
        )
      }
    });
    return Promise.all(filesContentTasks)
  }
}
export default ZIPLoader

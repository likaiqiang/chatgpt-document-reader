const path = require('path');
const fsExtra = require('fs-extra');

const folders = [
  {
    source: path.join(__dirname, 'node_modules', 'faiss-node', 'build', 'Release'),
    destination: path.join(__dirname, 'src', 'assets', 'node', 'faiss-node', 'build')
  },
  {
    source: path.join(__dirname, 'node_modules', 'tree-sitter', 'build', 'Release'),
    destination: path.join(__dirname, 'src', 'assets', 'node', 'tree-sitter')
  },
  {
    source: path.join(__dirname, 'node_modules', 'tree-sitter-javascript', 'build', 'Release'),
    destination: path.join(__dirname, 'src', 'assets', 'node', 'tree-sitter-javascript')
  },
  {
    source: path.join(__dirname, 'node_modules', 'tree-sitter-javascript', 'src', 'node-types.json'),
    destination: path.join(__dirname, 'src', 'assets', 'node', 'tree-sitter-javascript', 'node-types.json')
  }
]

const taskFuncs = folders.reduce((acc, folder)=>{
  acc.push(()=>{
    const {source,destination} = folder
    return fsExtra.copy(source, destination)
  })
  return acc
},[])

taskFuncs.reduce((acc, task)=>{
  return acc.then(()=>{
    return task()
  })
},Promise.resolve()).then(()=>{
  console.log('file copy success')
})


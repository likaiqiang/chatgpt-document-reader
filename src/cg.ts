import traverse  from "@babel/traverse";
import type {NodePath} from '@babel/traverse'
import * as tern from "tern";
import type {Query} from 'tern'
import {parse} from '@babel/parser'
import type {ParseResult} from '@babel/parser'
import generate from '@babel/generator';
import fs from 'fs'
import ts from 'typescript'
import path from 'path'
import * as t from '@babel/types';
import { checkSupported } from '@/electron/ingest-data';
const server = new tern.Server({});

interface Vertex {
  id: string;
  loc: {
    start: number;
    end: number;
  };
  name: string;
  path: NodePath;
}

interface Location {
  start: number;
  end: number;
}

interface GetFunctionDefLocParams {
  code: string;
  fileName?: string;
  calleeEnd: number;
}

interface DotNode {
  [key: string]: string;
}

interface DotStatement {
  head: {
    id: string;
    path: NodePath<t.Node>;
    attrs: { [key: string]: string };
  };
  tail: {
    id: string;
    path: NodePath<t.Node>;
    attrs: { [key: string]: string };
  };
  attributes?: { [key: string]: string };
}

interface DotJson {
  node?: DotNode;
  statements?: DotStatement[];
}

function generateNameByPath(path: NodePath): string {
  if (path.isFunctionDeclaration() || path.isVariableDeclarator()) {
    const { id } = path.node as t.FunctionDeclaration | t.VariableDeclarator;
    if (t.isIdentifier(id)) {
      return id.name;
    }
  }
  if (path.isObjectMethod() || path.isObjectProperty()) {
    const { key } = path.node as t.ObjectMethod | t.ObjectProperty;
    if (t.isIdentifier(key)) {
      return key.name;
    }
  }
  if (path.isClassMethod()) {
    const classPath = path.findParent((p) => p.isClassDeclaration());
    const { key } = path.node as t.ClassMethod;
    if (classPath && classPath.isClassDeclaration() && t.isIdentifier(classPath.node.id)) {
      if (t.isIdentifier(key)) {
        return `${classPath.node.id.name}.${key.name}`;
      }
    }
  }
  return '';
}
function tsCompile({source, options}: {source: string, options?: ts.TranspileOptions}){
  if (!options) {
    options = {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020
      }
    };
  }

  // 转换代码
  const result = ts.transpileModule(source, options);

  // 返回JavaScript代码
  return {
    code: result.outputText,
    map: result.sourceMapText
  }
}

function getVertexes(ast: ParseResult<t.File>): Vertex[] {
  const vertexes: Vertex[] = [];

  traverse(ast, {
    FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
      const { id } = path.node;
      if (id) {
        const { start, end } = id;
        vertexes.push({
          id: `${id.name}-${start}-${end}`,
          loc: {
            start: start!,
            end: end!
          },
          name: generateNameByPath(path),
          path
        });
      }
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const { id, init } = path.node;
      const { start, end } = id;
      if (init && (t.isFunctionExpression(init) || t.isArrowFunctionExpression(init))) {
        vertexes.push({
          id: `${(id as t.Identifier).name}-${start}-${end}`,
          loc: {
            start: start!,
            end: end!
          },
          name: generateNameByPath(path),
          path
        });
      }
    },
    ObjectMethod(path: NodePath<t.ObjectMethod>) {
      const { key, kind } = path.node;
      if (kind !== 'get') {
        const { start, end } = key;
        vertexes.push({
          id: `${(key as t.Identifier).name}-${start}-${end}`,
          loc: {
            start: start!,
            end: end!
          },
          name: generateNameByPath(path),
          path
        });
      }
    },
    ObjectProperty(path: NodePath<t.ObjectProperty>) {
      const { key, value } = path.node;
      if (value && (t.isFunctionExpression(value) || t.isArrowFunctionExpression(value))) {
        const { start, end } = key;
        vertexes.push({
          id: `${(key as t.Identifier).name}-${start}-${end}`,
          loc: {
            start: start!,
            end: end!
          },
          name: generateNameByPath(path),
          path
        });
      }
    },
    ClassMethod(path: NodePath<t.ClassMethod>) {
      const { key } = path.node;
      const { start, end } = key;
      vertexes.push({
        id: `${(key as t.Identifier).name}-${start}-${end}`,
        loc: {
          start: start!,
          end: end!
        },
        name: generateNameByPath(path),
        path
      });
    },
  });

  return vertexes;
}

function getFunctionDefLoc({ code, fileName = 'example.js', calleeEnd }: GetFunctionDefLocParams): any {
  server.addFile(fileName, code);
  let result: any = {};
  const query: Query = {
    type: "definition",
    file: fileName,
    end: calleeEnd,
  };

  server.flush(() => {
    server.request({ query }, (err, data) => {
      if (err) throw err;
      result = data;
    });
  });

  return result;
}

function getParentFuncLoc(path: NodePath): Location {
  const parentFunc = path.getFunctionParent();

  if (!parentFunc) {
    return {start:-1, end: -1};
  }

  if (t.isFunctionExpression(parentFunc.node) || t.isArrowFunctionExpression(parentFunc.node)) {
    if (!('id' in parentFunc.node) || !parentFunc.node.id) {
      const container = parentFunc.container as t.Node;
      if (t.isObjectProperty(container)) {
        const { key } = container;
        if (t.isIdentifier(key) || t.isLiteral(key)) {
          return {
            start: key.start!,
            end: key.end!
          };
        }
      }
      if (t.isVariableDeclarator(container)) {
        const { id } = container;
        if (t.isIdentifier(id)) {
          return {
            start: id.start!,
            end: id.end!
          };
        }
      }
    }
  }

  if (t.isObjectMethod(parentFunc.node) || t.isClassMethod(parentFunc.node)) {
    const { key } = parentFunc.node;
    if (t.isIdentifier(key) || t.isLiteral(key)) {
      return {
        start: key.start!,
        end: key.end!
      };
    }
  }

  if (t.isFunctionDeclaration(parentFunc.node)) {
    const { id } = parentFunc.node;
    if (t.isIdentifier(id)) {
      return {
        start: id.start!,
        end: id.end!
      };
    }
  }

  return {start: -1, end: -1};
}

function generateDotJson(code: string): DotJson {
  const ast = parse(code, {
    sourceType: 'unambiguous',
    plugins: ['jsx', 'typescript'],
  });

  const dotJson: DotJson = {
    node: { fillcolor: "#eeeeee", style: "filled,rounded", shape: "rect" },
    statements: [],
  };

  const funcDecVertexes = getVertexes(ast);

  traverse(ast, {
    CallExpression(p) {
      const { end: calleeEnd } = p.node.callee;
      const data = getFunctionDefLoc({
        code,
        fileName: 'example.js',
        calleeEnd,
      });

      if (Object.keys(data).length) {
        const { start, end } = data;
        const callVertex = funcDecVertexes.find(vertex => vertex.loc.start === start && vertex.loc.end === end);
        const parentFunc = p.getFunctionParent();

        if (parentFunc) {
          const { start: parentFuncStart, end: parentFuncEnd } = getParentFuncLoc(p);
          if (parentFuncStart && parentFuncEnd) {
            const parentFuncVertex = funcDecVertexes.find(vertex => vertex.loc.start === parentFuncStart && vertex.loc.end === parentFuncEnd);

            if (callVertex && parentFuncVertex) {
              dotJson.statements.push({
                head: {
                  id: parentFuncVertex.id,
                  path: parentFuncVertex.path,
                  attrs: {
                    label: parentFuncVertex.name,
                    id: parentFuncVertex.id,
                  },
                },
                tail: {
                  id: callVertex.id,
                  path: callVertex.path,
                  attrs: {
                    id: callVertex.id,
                    label: callVertex.name,
                  },
                },
                attributes: {},
              });
            }
          }
        }
      }
    },
  });

  return dotJson;
}
function generateDotStr(dotJson: DotJson): string {
  const { node = {}, statements = [] } = dotJson;
  let str = 'digraph G {\nrankdir=LR;';
  if(statements.length === 0) return ''

  if (Object.keys(node).length > 0) {
    str += Object.keys(node).reduce((acc, key) => {
      return acc + `"${key}"="${node[key]}",`;
    }, 'node [');
    str += ']';
  }

  const visitedId: { [key: string]: any } = {};
  str += statements.reduce((acc, statement) => {
    const { head, tail } = statement;
    for (const node of [head, tail]) {
      if (!(node.id in visitedId)) {
        visitedId[node.id] = node;
        const attrs = node.attrs;
        acc += `\n"${node.id}" [`;
        for (const k in attrs) {
          acc += `"${k}"="${attrs[k]}"`;
        }
        acc += ']';
      }
    }
    return acc;
  }, '');

  str += statements.reduce((acc, item) => {
    const { head, tail, attributes = {} } = item;
    let stmp = `"${head.id}" -> "${tail.id}"`;
    if (Object.keys(attributes).length > 0) {
      stmp += Object.keys(attributes).reduce((acc, attr) => {
        return acc + `"${attr}"="${attributes[attr]}",`;
      }, ' [');
      stmp += ']';
    }
    return acc + '\n' + stmp;
  }, '');

  return str + '\n}';
}

const getCodeBlock=(filepath:string, code: string)=>{
  const suffix = path.extname(filepath)
  const codeBlock = `
    \`\`\`${suffix ? 'language='+suffix.slice(1) : ''}
    ${code}
    \`\`\`
  `
  return codeBlock
}
export const getCodeDot=(filepath: string)=>{
  const code = fs.readFileSync(filepath, 'utf-8')
  const suffix = path.extname(filepath)

  if(checkSupported(filepath, ['.js','.ts'])){
    const compiledCode = tsCompile({
      source: code
    })
    const dotJson = generateDotJson(compiledCode.code)
    const codeMapping:{[key: string]: any} = {}
    for(const statement of dotJson.statements){
      const {head, tail} = statement
      for(const node of [head, tail]){
        if(!codeMapping[node.id]){
          codeMapping[node.id] = getCodeBlock(
            filepath,
            generate(node.path.node).code
          )
        }
      }
    }
    const dot = generateDotStr(dotJson)
    return {
      code: getCodeBlock(filepath, code),
      suffix,
      dot,
      codeMapping
    }
  }
  return {
    code: getCodeBlock(filepath, code),
    dot:'',
    codeMapping: null,
    suffix
  }
}

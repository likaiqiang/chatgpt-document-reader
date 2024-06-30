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
import { extractFunctionsAndClasses } from '@/utils/code';
const server = new tern.Server({});

interface Position {
  line: number;
  column: number;
  index?: number;
}
interface SourceLocation {
  start: Position;
  end: Position;
  filename: string;
  identifierName: string | undefined | null;
}

interface Vertex {
  id: string;
  loc: SourceLocation;
  name: string;
  path: NodePath;
  start: number,
  end: number
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
    loc: SourceLocation
  };
  tail: {
    id: string;
    path: NodePath<t.Node>;
    attrs: { [key: string]: string };
    loc:SourceLocation,
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
        vertexes.push({
          id: `${id.name}-${id.loc.start.line}-${id.loc.start.column}`,
          loc: id.loc,
          start: id.start,
          end: id.end,
          name: generateNameByPath(path),
          path
        });
      }
    },
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const { id, init } = path.node;
      if (init && (t.isFunctionExpression(init) || t.isArrowFunctionExpression(init))) {
        vertexes.push({
          id: `${(id as t.Identifier).name}-${id.loc.start.line}-${id.loc.start.column}`,
          loc: id.loc,
          name: generateNameByPath(path),
          path,
          start: id.start,
          end: id.end
        });
      }
    },
    ObjectMethod(path: NodePath<t.ObjectMethod>) {
      const { key, kind } = path.node;
      if (kind !== 'get') {
        vertexes.push({
          id: `${(key as t.Identifier).name}-${key.loc.start.line}-${key.loc.start.column}`,
          loc: key.loc,
          name: generateNameByPath(path),
          path,
          start: key.start,
          end: key.end
        });
      }
    },
    ObjectProperty(path: NodePath<t.ObjectProperty>) {
      const { key, value } = path.node;
      if (value && (t.isFunctionExpression(value) || t.isArrowFunctionExpression(value))) {
        vertexes.push({
          id: `${(key as t.Identifier).name}-${key.loc.start.line}-${key.loc.start.column}`,
          loc:key.loc,
          name: generateNameByPath(path),
          path,
          start: key.start,
          end: key.end
        });
      }
    },
    ClassMethod(path: NodePath<t.ClassMethod>) {
      const { key } = path.node;
      vertexes.push({
        id: `${(key as t.Identifier).name}-${key.loc.start.line}-${key.loc.start.column}`,
        loc: key.loc,
        name: generateNameByPath(path),
        path,
        start: key.start,
        end: key.end
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

function getParentFuncLoc(path: NodePath): SourceLocation | null {
  const parentFunc = path.getFunctionParent();

  if (!parentFunc) {
    return null
  }

  if (t.isFunctionExpression(parentFunc.node) || t.isArrowFunctionExpression(parentFunc.node)) {
    if (!('id' in parentFunc.node) || !parentFunc.node.id) {
      const container = parentFunc.container as t.Node;
      if (t.isObjectProperty(container)) {
        const { key } = container;
        if (t.isIdentifier(key) || t.isLiteral(key)) {
          return key.loc;
        }
      }
      if (t.isVariableDeclarator(container)) {
        const { id } = container;
        if (t.isIdentifier(id)) {
          return id.loc;
        }
      }
    }
  }

  if (t.isObjectMethod(parentFunc.node) || t.isClassMethod(parentFunc.node)) {
    const { key } = parentFunc.node;
    if (t.isIdentifier(key) || t.isLiteral(key)) {
      return key.loc;
    }
  }

  if (t.isFunctionDeclaration(parentFunc.node)) {
    const { id } = parentFunc.node;
    if (t.isIdentifier(id)) {
      return id.loc;
    }
  }

  return null;
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
        const callVertex = funcDecVertexes.find(vertex => vertex.start === start && vertex.end === end);
        const parentFunc = p.getFunctionParent();

        if (parentFunc) {
          const parentLoc = getParentFuncLoc(p);
          if(parentLoc){
            const {column, line} = parentLoc.start
            const parentFuncVertex = funcDecVertexes.find(vertex => vertex.loc.start.line === line && vertex.loc.start.column === column);

            if (callVertex && parentFuncVertex) {
              dotJson.statements.push({
                head: {
                  id: parentFuncVertex.id,
                  path: parentFuncVertex.path,
                  loc: parentFuncVertex.path.node.loc,
                  attrs: {
                    label: parentFuncVertex.name,
                    id: parentFuncVertex.id,
                  },
                },
                tail: {
                  id: callVertex.id,
                  path: callVertex.path,
                  loc: callVertex.path.node.loc,
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
    \`\`\`${suffix ? suffix.slice(1) : ''}
    ${code}
    \`\`\`
  `
  return codeBlock
}
export const getCodeDot= async (filepath: string)=>{
  const code = fs.readFileSync(filepath, 'utf-8')
  let suffix = path.extname(filepath)

  if(suffix === '.ts') suffix = '.js'

  let returnCode = code, dot = ''
  const codeMapping: { [key: string]: any } = {}

  if(suffix === '.js'){
    const compiledCode = tsCompile({
      source: code
    })
    returnCode = compiledCode.code
    const dotJson = generateDotJson(compiledCode.code)

    for(const statement of dotJson.statements){
      const {head, tail} = statement
      for(const node of [head, tail]){
        if(!codeMapping[node.id]){
          codeMapping[node.id] = {
            code: generate(node.path.node).code,
            loc: node.loc
          }
        }
      }
    }
    dot = generateDotStr(dotJson)
  }

  const definitions = await extractFunctionsAndClasses(returnCode, suffix.slice(1))
  return {
    code: returnCode,
    dot,
    codeMapping,
    suffix,
    definitions
  }
}

import * as ts from 'typescript';
import path from 'path';
import fs from 'fs';
import { extractFunctionsAndClasses } from '@/utils/code';

interface Position {
  line: number;
  column: number;
  index?: number;
}
interface SourceLocation {
  start: Position;
  end: Position
}

interface DotStatement {
  head: {
    id: string;
    attrs: { [key: string]: string };
    loc: SourceLocation,
    code:string
  };
  tail: {
    id: string;
    attrs: { [key: string]: string };
    loc:SourceLocation,
    code:string
  };
  attributes?: { [key: string]: string }
}

interface Definition {
  type: string;
  name: string;
  startPosition: { row: number, column: number };
  endPosition: { row: number, column: number };
  code:string
}

function getFunctionName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.getText();
  }

  if (ts.isMethodDeclaration(node)) {
    let name = node.name.getText();
    // 如果是类方法，加上类名
    if (ts.isClassDeclaration(node.parent)) {
      name = `${node.parent.name?.getText()}.${name}`;
    }
    return name;
  }

  if (ts.isConstructorDeclaration(node)) {
    // 构造函数，返回类名 + ".constructor"
    if (ts.isClassDeclaration(node.parent)) {
      return `${node.parent.name?.getText()}.constructor`;
    }
    return "constructor";
  }

  if (ts.isFunctionExpression(node)) {
    if (ts.isVariableDeclaration(node.parent)) {
      // 变量声明的函数表达式
      return node.parent.name.getText();
    }
    if (ts.isPropertyAssignment(node.parent)) {
      // 对象属性的函数表达式
      return node.parent.name.getText();
    }
    return node.name?.getText();
  }

  if (ts.isArrowFunction(node)) {
    if (ts.isVariableDeclaration(node.parent)) {
      return node.parent.name.getText();
    }
    if (ts.isPropertyAssignment(node.parent)) {
      return node.parent.name.getText();
    }
  }

  if (ts.isCallExpression(node)) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      // 对象方法调用: obj.method()
      return `${node.expression.expression.getText()}.${node.expression.name.getText()}`;
    }
    return node.expression.getText();
  }

  return null;
}


function getParentFunctionNode(node: ts.Node): ts.Node | undefined {
  let current: ts.Node | undefined = node;
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isMethodDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isConstructorDeclaration(current)
    ) {
      return current; // 找到父函数节点
    }
    current = current.parent; // 向上查找
  }
  return undefined; // 未找到父函数节点
}

function getLocationInFile(sourceFile: ts.SourceFile, node: ts.Node) {
  const start = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

  return {
    start: {
      line: start.line + 1,      // 转换为从1开始
      column: start.character + 1 // 转换为从1开始
    },
    end: {
      line: end.line + 1,
      column: end.character + 1
    },
    label: getFunctionName(node) || 'anonymous',
    code: node.getText()
  };
}

function analyzeAllFunctionCalls(code: string) {
  // 创建源文件
  const sourceFile = ts.createSourceFile(
    'sample.ts',
    code,
    ts.ScriptTarget.Latest,
    true
  );

  // 创建程序
  const program = ts.createProgram({
    rootNames: ['sample.ts'],
    options: {
      target: ts.ScriptTarget.ES2021,
      noEmitOnError: false,
      noResolve: true,          // 不解析导入
      allowJs: true,            // 允许编译 JavaScript 文件
      noImplicitAny: false,     // 允许隐式 any 类型
      suppressImplicitAnyIndexErrors: true,  // 抑制隐式索引错误
      skipDefaultLibCheck: true, // 跳过默认库检查
      skipLibCheck: true,       // 跳过所有库的类型检查
      noEmit: true,             // 不输出文件
      allowUnreachableCode: true, // 允许不可达代码
      allowUnusedLabels: true,    // 允许未使用的标签
      noUnusedLocals: false,      // 允许未使用的局部变量
      noUnusedParameters: false,   // 允许未使用的参数
      noImplicitReturns: false,   // 允许函数不返回值
      noFallthroughCasesInSwitch: false, // 允许 switch 语句中的 fallthrough
    },
    host: {
      ...ts.createCompilerHost({}),
      getSourceFile: (fileName) =>
        fileName === 'sample.ts' ? sourceFile : undefined,
      writeFile: () => {},
      getCurrentDirectory: () => '',
      getDefaultLibFileName: () => 'lib.d.ts',
      fileExists: () => true,
      readFile: () => '',
      getCanonicalFileName: (f) => f,
      useCaseSensitiveFileNames: () => true,
      getNewLine: () => '\n',
    }
  });

  const checker = program.getTypeChecker();

  const calls: DotStatement[] = [];
  const defs: Definition[] = [];

  // 遍历AST收集所有函数调用
  function visit(node: ts.Node) {
    function getLineAndColumn(pos: number, sourceFile: ts.SourceFile) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      return {
        row: line + 1,
        column: character + 1
      };
    }
    if (ts.isCallExpression(node)) {
      const parentNode = getParentFunctionNode(node);
      const symbol = checker.getSymbolAtLocation(node.expression);
      if(parentNode && symbol){
        const head = getLocationInFile(sourceFile, parentNode)
        const tail = getLocationInFile(sourceFile, symbol.declarations?.[0]);
        const _node = getLocationInFile(sourceFile, node);
        const headId = `${head.label}-${head.start.line}-${head.start.column}`
        const tailId = `${tail.label}-${tail.start.line}-${tail.start.column}`
        calls.push({
          head:{
            id: headId,
            loc:{
              start: head.start,
              end: head.end
            },
            code: head.code,
            attrs:{
              label: head.label,
              id: headId
            }
          },
          tail:{
            id: tailId,
            loc:{
              start: tail.start,
              end: tail.end
            },
            code: tail.code,
            attrs:{
              label: tail.label,
              id: tailId
            }
          },
          attributes: {}
        });
      }
    }
    if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
      const name = node.name?.getText() ?? '<anonymous>';
      defs.push({
        type: 'Function',
        name: name,
        code: node.getText(),
        startPosition: getLineAndColumn(node.getStart(), sourceFile),
        endPosition: getLineAndColumn(node.getEnd(), sourceFile)
      });
    } else if (ts.isClassDeclaration(node)) {
      const name = node.name?.getText() ?? '<anonymous>';
      defs.push({
        type: 'Class',
        name: name,
        code: node.getText(),
        startPosition: getLineAndColumn(node.getStart(), sourceFile),
        endPosition: getLineAndColumn(node.getEnd(), sourceFile)
      });
      node.members.forEach(member => {
        if (ts.isConstructorDeclaration(member)) {
          defs.push({
            type: 'Constructor',
            name: 'constructor',
            code: member.getText(),
            startPosition: getLineAndColumn(member.getStart(), sourceFile),
            endPosition: getLineAndColumn(member.getEnd(), sourceFile),
          });
        }
        else if (ts.isMethodDeclaration(member)) {
          const methodName = member.name.getText();
          defs.push({
            type: 'Method',
            name: methodName,
            code: member.getText(),
            startPosition: getLineAndColumn(member.getStart(), sourceFile),
            endPosition: getLineAndColumn(member.getEnd(), sourceFile)
          });
        }
      });
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { calls, defs, code };
}

function generateDotStr(statements:DotStatement[] ): string {
  const node:{[key:string]:string} = { fillcolor: "#eeeeee", style: "filled,rounded", shape: "rect" };
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

export const getCodeDot= async (filepath: string)=>{
  const code = fs.readFileSync(filepath, 'utf-8')
  let suffix = path.extname(filepath)

  if(suffix === '.ts') suffix = '.js'

  let returnCode = '', dot = '', definitions:Definition[] = []
  const codeMapping: { [key: string]: any } = {}

  if(suffix === '.js'){
    const {calls,defs, code: compiledCode} = analyzeAllFunctionCalls(code)
    returnCode = compiledCode
    definitions = defs
    for(const statement of calls){
      const {head, tail} = statement
      for(const node of [head, tail]){
        if(!codeMapping[node.id]){
          codeMapping[node.id] = node
        }
      }
    }
    dot = generateDotStr(calls)
  }
  else{
    returnCode = code
    definitions = await extractFunctionsAndClasses(code, suffix.slice(1))
  }

  return {
    code: returnCode,
    dot,
    codeMapping,
    suffix,
    definitions
  }
}

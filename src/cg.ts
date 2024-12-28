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

function getFunctionCode(node: ts.Node): string {
  // 处理函数声明、方法声明、构造函数等
  if (
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node)
  ) {
    // 如果是类成员，返回完整的修饰符信息
    if (ts.isClassElement(node)) {
      const modifiers = node.modifiers?.map(m => m.getText()).join(' ') || '';
      return `${modifiers} ${node.getFullText()}`.trim();
    }
    return node.getFullText();
  }

  // 处理函数表达式
  if (ts.isFunctionExpression(node)) {
    // 如果函数表达式是变量声明的一部分，返回完整的变量声明
    if (ts.isVariableDeclaration(node.parent)) {
      // 获取变量声明列表节点以获取 const/let/var
      const declarationList = node.parent.parent;
      if (ts.isVariableDeclarationList(declarationList)) {
        const declarationKind = declarationList.flags & ts.NodeFlags.Let ? 'let' :
          declarationList.flags & ts.NodeFlags.Const ? 'const' : 'var';
        return `${declarationKind} ${node.parent.getFullText()}`;
      }
    }
    // 如果是对象属性的函数表达式
    if (ts.isPropertyAssignment(node.parent)) {
      return node.parent.getFullText();
    }
    return node.getFullText();
  }

  // 处理静态方法和属性
  if (ts.isPropertyDeclaration(node)) {
    const isStatic = node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
    if (isStatic) {
      return node.getFullText();
    }
  }

  // 处理箭头函数
  if (ts.isArrowFunction(node)) {
    const parent = node.parent;

    // 如果箭头函数是变量声明的一部分
    if (ts.isVariableDeclaration(parent)) {
      // 获取变量声明列表节点以获取 const/let/var
      const declarationList = parent.parent;
      if (ts.isVariableDeclarationList(declarationList)) {
        const declarationKind = declarationList.flags & ts.NodeFlags.Let ? 'let' :
          declarationList.flags & ts.NodeFlags.Const ? 'const' : 'var';
        return `${declarationKind} ${parent.getFullText()}`;
      }
    }

    // 如果箭头函数是对象属性赋值的一部分
    if (ts.isPropertyAssignment(parent)) {
      return parent.getFullText();
    }

    // 如果箭头函数是类属性声明的一部分
    if (ts.isPropertyDeclaration(parent)) {
      const modifiers = parent.modifiers?.map(m => m.getText()).join(' ') || '';
      return `${modifiers} ${parent.getFullText()}`.trim();
    }

    // 默认返回箭头函数自身代码
    return node.getFullText();
  }

  // 对于函数调用，返回调用的代码
  if (ts.isCallExpression(node)) {
    return node.getFullText();
  }

  // 默认返回
  return '';
}

function getFunctionName(node: ts.Node): string | undefined {
  if (ts.isFunctionDeclaration(node)) {
    return node.name?.getText();
  }

  if (ts.isMethodDeclaration(node)) {
    let name = node.name.getText();
    if (ts.isClassDeclaration(node.parent)) {
      const className = node.parent.name?.getText();
      const isStatic = node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
      // 静态方法添加 "static" 前缀
      if (isStatic) {
        return `${className}.static.${name}`;
      }
      return `${className}.${name}`;
    }
    return name;
  }

  if (ts.isConstructorDeclaration(node)) {
    if (ts.isClassDeclaration(node.parent)) {
      return `${node.parent.name?.getText()}.constructor`;
    }
    return "constructor";
  }

  if (ts.isPropertyDeclaration(node) && ts.isIdentifier(node.name)) {
    if (ts.isClassDeclaration(node.parent)) {
      const className = node.parent.name?.getText();
      const isStatic = node.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
      // 静态属性添加 "static" 前缀
      if (isStatic) {
        return `${className}.static.${node.name.getText()}`;
      }
      return `${className}.${node.name.getText()}`;
    }
    return node.name.getText();
  }

  if (ts.isFunctionExpression(node)) {
    if (ts.isVariableDeclaration(node.parent)) {
      return node.parent.name.getText();
    }
    if (ts.isPropertyAssignment(node.parent)) {
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
    if (ts.isPropertyDeclaration(node.parent) && ts.isIdentifier(node.parent.name)) {
      if (ts.isClassDeclaration(node.parent.parent)) {
        const className = node.parent.parent.name?.getText();
        const isStatic = node.parent.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword);
        // 静态箭头函数属性添加 "static" 前缀
        if (isStatic) {
          return `${className}.static.${node.parent.name.getText()}`;
        }
        return `${className}.${node.parent.name.getText()}`;
      }
      return node.parent.name.getText();
    }
  }

  if (ts.isCallExpression(node)) {
    if (ts.isPropertyAccessExpression(node.expression)) {
      // 处理静态方法调用: ClassName.staticMethod()
      if (ts.isIdentifier(node.expression.expression)) {
        return `${node.expression.expression.getText()}.${node.expression.name.getText()}`;
      }
      // 处理实例方法调用: obj.method()
      return `${node.expression.expression.getText()}.${node.expression.name.getText()}`;
    }
    return node.expression.getText();
  }

  return 'anonymous';
}

function isDef(defs:Definition[]=[], node: ts.Node, sourceFile: ts.SourceFile) {
  const location = getLocationInFile(sourceFile,node)
  return !!(defs.find(def=> {
    return def.startPosition.row === location.start.line && def.startPosition.column === location.start.column;
  }))
}

function getParentFunctionNode(sourceFile:ts.SourceFile,node: ts.Node, defs: Definition[] = []): ts.Node | undefined {
  let current: ts.Node | undefined = node;
  while (current) {
    if (
      (ts.isFunctionDeclaration(current) ||
        ts.isMethodDeclaration(current) ||
        ts.isFunctionExpression(current) ||
        ts.isArrowFunction(current) ||
        ts.isConstructorDeclaration(current))
      && isDef(defs, current, sourceFile)
    ) {
      return current; // 找到父函数节点
    }
    current = current.parent; // 向上查找
  }
  return undefined; // 未找到父函数节点
}

function getLineAndColumn(pos: number, sourceFile: ts.SourceFile) {
  const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
  return {
    row: line + 1,
    column: character + 1
  };
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
    label: getFunctionName(node),
    code: getFunctionCode(node).trim()
  };
}

function collectDefs(sourceFile: ts.SourceFile) {
  const defs: Definition[] = [];

  function visit(node: ts.Node) {

    // 判断是否为回调函数
    function isCallbackFunction(node: ts.Node): boolean {
      const parent = node.parent;
      if (!parent) return false;

      // 如果父节点是函数调用的参数，则视为回调
      return ts.isCallExpression(parent) && parent.arguments.includes(node as ts.Expression);
    }
    const name = getFunctionName(node)
    const code = getFunctionCode(node).trim()
    // 检查是否是函数声明或类
    if (
      (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node)) &&
      !isCallbackFunction(node) // 排除回调函数
    ) {

      defs.push({
        type: 'Function',
        name,
        code,
        startPosition: getLineAndColumn(node.getStart(), sourceFile),
        endPosition: getLineAndColumn(node.getEnd(), sourceFile),
      });
    } else if (ts.isClassDeclaration(node)) {
      defs.push({
        type: 'Class',
        name: name,
        code,
        startPosition: getLineAndColumn(node.getStart(), sourceFile),
        endPosition: getLineAndColumn(node.getEnd(), sourceFile),
      });

      // 遍历类成员
      node.members.forEach((member) => {
        if (ts.isConstructorDeclaration(member)) {
          defs.push({
            type: 'Constructor',
            name,
            code,
            startPosition: getLineAndColumn(member.getStart(), sourceFile),
            endPosition: getLineAndColumn(member.getEnd(), sourceFile),
          });
        } else if (ts.isMethodDeclaration(member)) {
          defs.push({
            type: 'Method',
            name,
            code,
            startPosition: getLineAndColumn(member.getStart(), sourceFile),
            endPosition: getLineAndColumn(member.getEnd(), sourceFile),
          });
        }
      });
    }

    // 遍历子节点
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return defs;
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
  const defs = collectDefs(sourceFile);
  // 遍历AST收集所有函数调用
  function visit(node: ts.Node) {

    if (ts.isCallExpression(node)) {
      const parentNode = getParentFunctionNode(sourceFile,node, defs);
      if(parentNode){
        let symbol
        try {
          symbol = checker.getSymbolAtLocation(node.expression);
        } catch (e){

        }
        if(symbol && isDef(defs, symbol.declarations?.[0], sourceFile)){
          const head = getLocationInFile(sourceFile, parentNode)
          const tail = getLocationInFile(sourceFile, symbol.declarations?.[0]);
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

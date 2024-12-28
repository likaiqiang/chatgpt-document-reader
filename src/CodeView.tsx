import React, { useRef, forwardRef, useImperativeHandle, RefObject, useState, useEffect } from 'react';
import { selectAll } from 'd3-selection';
import { Modal } from '@mui/material';
import Whether from '@/components/Whether';
//@ts-ignore
import * as d3 from 'd3-graphviz';
import styles from '@/styles/Home.module.css';
import Editor from '@monaco-editor/react';
import { editor,Range, KeyCode, KeyMod} from 'monaco-editor';
import ChatComponent, { ChatHandle } from './components/Chat';

const selectNodeConfig = {
  color: 'red'
};

const modelStyle: React.CSSProperties = {
  position: 'absolute',
  top: '5%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '80%',
  maxHeight: '90vh',
  backgroundColor: 'white',
  border: '2px solid #000',
  boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column'
};

interface RenderCodeParams {
  dot: string,
  code: string,
  codeMapping: { [key: string]: any },
  definitions: Definition[]
}

interface Definition {
  type: string;
  name: string;
  startPosition: { row: number, column: number };
  endPosition: { row: number, column: number };
  code: string;
}

export interface CodeViewHandle {
  setIsOpen: (open: boolean) => void,
  renderCode: (params: RenderCodeParams) => void,
}

const CodeView = (props: {}, ref: RefObject<CodeViewHandle>) => {
  const eleRef = useRef<HTMLDivElement>(null);
  const editorEleRef = useRef<HTMLDivElement>(null);
  const [dotContainerStyle, setDotContainerStyle] = useState({})
  const graphvizRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [dot, setDot] = useState('');
  const [codeMapping, setCodeMapping] = useState<{ [key: string]: any }>({});
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const [decorationIds, setDecorationIds] = useState<string[]>([]); // 存储装饰器 ID
  const chatRef = useRef<ChatHandle>(null);
  const abortControllerRef = useRef<AbortController>();
  const isFetchRef = useRef(false);

  function getCommentsPrompt(code:string) {
    return `给出以下代码，在源代码的基础上逐行注释，注释的过程中不要省略代码，只返回注释后的代码，不要有其他解释
\`\`\`
${code}
\`\`\``;
  }

  function insertButtonAfterLine(line: number, code: string, i: number) {
    if (!editorRef.current) return;
    const prompt = getCommentsPrompt(code)
    const button = document.createElement('button');
    button.style.pointerEvents = 'auto';
    button.style.zIndex = '10';
    button.style.color = 'red';
    button.style.fontSize = '14px';
    button.style.textAlign = 'left';
    button.innerText = '行内注释';
    button.onclick = () => {
      // 在按钮点击时执行的操作
      console.log('按钮被点击了！');
      if (chatRef.current && !isFetchRef.current) {
        abortControllerRef.current = new AbortController();
        isFetchRef.current = true;
        chatRef.current.send(prompt, abortControllerRef.current).finally(() => {
          isFetchRef.current = false;
        });
      }
    };
    // 使用装饰器插入按钮
    editorRef.current.changeViewZones((accessor) => {
      accessor.addZone({
        afterLineNumber: line,
        heightInLines: 1,
        domNode: button
      });
    });
  }

  const renderCode = ({ dot, code, codeMapping, definitions }: RenderCodeParams) => {
    graphvizRef.current = d3.graphviz(`#${eleRef.current?.id}`);
    const graphviz = graphvizRef.current;

    setCode(code);
    setDot(dot);
    setCodeMapping(codeMapping);
    setDefinitions(definitions);
    if (dot) {
      graphviz.renderDot(dot);
    }
  };

  const isNode = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    const parentEle = (e.target as HTMLElement).parentElement;
    return parentEle?.classList.contains('node');
  };

  const onselectNodeStyle = (node: HTMLElement) => {
    selectAll('g.node').select('path').style('stroke', 'black');
    node.querySelector('path')!.style.stroke = selectNodeConfig.color;
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (isNode(e)) {
      const parentNode = (e.target as HTMLElement).parentElement;
      if (parentNode) {
        onselectNodeStyle(parentNode);
        const id = parentNode.getAttribute('id');
        const {start, end} = id ? codeMapping[id]?.loc : {start:{line: -1, column: -1}, end:{line: -1, column: -1}};
        if (editorRef.current && start.line >= 0) {
          editorRef.current.revealLineInCenter(start.line);
          if(decorationIds.length){
            editorRef.current.deltaDecorations(decorationIds,[])
          }
          const ids = editorRef.current.deltaDecorations([],[
            {
              range: new Range(
                start.line,
                start.column,
                end.line,
                end.column
              ),
              options:{
                className: 'myHighlight',
                inlineClassName: 'myInlineHighlight',
              }
            }
          ])
          setDecorationIds(ids)
        }
      }
    }
  };

  useEffect(()=>{
    window.chatBot.setCodeModalStatus(isOpen).then()
  },[isOpen])

  useImperativeHandle(ref, () => {
    return {
      setIsOpen,
      renderCode
    };
  });

  return (
    <Modal open={isOpen}
           onClose={() => {
             setIsOpen(false);
             setCode('');
             setDot('');
             setCodeMapping({});
             if (graphvizRef.current) {
               graphvizRef.current.destroy();
             }
             if (eleRef.current) {
               eleRef.current.innerHTML = '';
             }
             if (abortControllerRef.current) {
               abortControllerRef.current.abort();
             }
           }}>
      <div style={modelStyle}>
        <div ref={containerRef} style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div
            ref={eleRef}
            id={'graphviz'}
            className={styles.graphviz}
            style={Object.assign({}, { flex: dot ? 1 : '', overflow:"auto" },dotContainerStyle)}
            onClick={onClick}
          />
          <div className={styles.codeContent} ref={editorEleRef} style={{ width: dot ? '50%' : '100%', height: '100%' }}>
            <Whether value={!!code}>
              <Editor
                width={'100%'}
                height={'50vh'}
                theme='vs-dark'
                value={code}
                className={'codeEdit'}
                onMount={(editor) => {
                  editorRef.current = editor;
                  editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyF, () => {
                    console.log('run');
                    editor.getAction("actions.find").run();
                  });
                  const {height} = getComputedStyle(editorEleRef.current)
                  setDotContainerStyle({
                    height: height
                  })
                  editor.addAction({
                    id: 'inline comments',
                    label: '行内注释',
                    contextMenuGroupId: 'navigation',
                    run(editor) {
                      const selection = editor.getSelection();
                      const selectedCode = editor.getModel().getValueInRange(selection);
                      if (!selectedCode) return null;
                      if (chatRef.current && !isFetchRef.current) {
                        abortControllerRef.current = new AbortController();
                        isFetchRef.current = true;
                        chatRef.current.send(getCommentsPrompt(selectedCode), abortControllerRef.current).finally(() => {
                          isFetchRef.current = false;
                        });
                      }
                    }
                  });
                  for (const definition of definitions) {
                    const lineNumber = definition.startPosition.row;
                    if (editor && lineNumber >= 0) {
                      insertButtonAfterLine(lineNumber, definition.code, definitions.indexOf(definition));
                    }
                  }
                }}
                options={{
                  readOnly: true
                }}
              />
            </Whether>
          </div>
        </div>
        <ChatComponent ref={chatRef} />
      </div>
    </Modal>
  );
};

export default forwardRef<CodeViewHandle, {}>(CodeView);

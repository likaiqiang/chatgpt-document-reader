import React, { useRef, forwardRef, useImperativeHandle, RefObject, useState, useEffect } from 'react';
import { Modal } from '@mui/material';
import Whether from '@/components/Whether';
import { instance } from "@viz-js/viz";
import styles from '@/styles/Home.module.css';
import Editor from '@monaco-editor/react';
import { editor,Range, KeyCode, KeyMod} from 'monaco-editor';
import ChatComponent, { ChatHandle } from './components/Chat';
import SearchComponent from '@/components/SearchComponent';
import { type Definition, DotStatement } from '@/cg';
import svgPanZoom from 'svg-pan-zoom';

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
  definitions: Record<string, Definition[]>
  calls: DotStatement[]
}


export interface CodeViewHandle {
  setIsOpen: (open: boolean) => void,
  renderCode: (params: RenderCodeParams) => void,
}
export interface CodeViewProps {
  filepath: string;
}

const CodeView = (props: CodeViewProps, ref: RefObject<CodeViewHandle>) => {
  const eleRef = useRef<HTMLDivElement>(null);
  const editorEleRef = useRef<HTMLDivElement>(null);
  const [dotContainerStyle, setDotContainerStyle] = useState({})
  const graphvizRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState('');
  const [dot, setDot] = useState('');
  const allDotRef = useRef<string>(null);
  const allCallsRef = useRef<DotStatement[]>([]);
  const svgPanZoomRef = useRef(null);
  const [codeMapping, setCodeMapping] = useState<{ [key: string]: any }>({});
  const [definitions, setDefinitions] = useState<Record<string, Definition[]>>({});

  const editorRef = useRef<editor.IStandaloneCodeEditor>(null);
  const [decorationIds, setDecorationIds] = useState<string[]>([]); // 存储装饰器 ID
  const chatRef = useRef<ChatHandle>(null);
  const abortControllerRef = useRef<AbortController>();
  const isFetchRef = useRef(false);
  const previousSelectNodeRef = useRef(null);

  function changeCode(code:string){
    removeAllButtons()
    setCode(code)
  }

  function getCommentsPrompt(code:string) {
    return `给出以下代码，在源代码的基础上用中文逐行注释，注释的过程中不要省略代码，只返回注释后的代码，不要有其他解释
\`\`\`
${code}
\`\`\``;
  }
  const viewZoneIdsRef = useRef(new Map<number, string>());
  function insertButtonAfterLine(line: number, code: string, i: number) {
    if (!editorRef.current) return;
    console.log('insertButtonAfterLine');
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
      const viewZoneId = accessor.addZone({
        afterLineNumber: line,
        heightInLines: 1,
        domNode: button
      });
      viewZoneIdsRef.current.set(line, viewZoneId);
    });
  }

  function insertAllButtons(filepath:string){
    const defs = definitions[filepath] || []
    for (const definition of defs) {
      const lineNumber = definition.startPosition.row;
      if (editorRef.current && lineNumber >= 0) {
        insertButtonAfterLine(lineNumber, definition.code, defs.indexOf(definition));
      }
    }
  }

  function removeAllButtons() {
    if (!editorRef.current) return;

    editorRef.current.changeViewZones((accessor) => {
      // 移除所有存储的 view zones
      for (const viewZoneId of viewZoneIdsRef.current.values()) {
        accessor.removeZone(viewZoneId);
      }
    });

    // 清空记录
    viewZoneIdsRef.current.clear();
    console.log('All buttons removed');
  }

  const renderCode = ({ dot, code, codeMapping, definitions, calls }: RenderCodeParams) => {
    console.log('calls', calls);

    changeCode(code);
    setDot(dot);
    setCodeMapping(codeMapping);
    setDefinitions(definitions);
    if (dot) {
      allDotRef.current = dot
      allCallsRef.current = calls
      eleRef.current.innerHTML = ''
      if(svgPanZoomRef.current){
        svgPanZoomRef.current.destroy()
      }
      instance().then(viz => {
        const result = viz.renderSVGElement(dot)
        eleRef.current.appendChild(result)
        svgPanZoomRef.current = svgPanZoom(result, {
          zoomEnabled: true,
          controlIconsEnabled: false,
          fit: true,
          center: true,
        });
      });
    }
  };

  const isNode = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    const parentEle = (e.target as HTMLElement).parentElement;
    return parentEle?.classList.contains('node');
  };

  const onselectNodeStyle = (node: HTMLElement) => {
    if(previousSelectNodeRef.current) {
      previousSelectNodeRef.current.querySelector('path')!.style.stroke = '';
    }
    previousSelectNodeRef.current = node
    node.querySelector('path')!.style.stroke = selectNodeConfig.color;
  };

  const onClick = async (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    function scrollToLine(loc:any){
      if(loc === undefined){
        loc = {start:{line: -1, column: -1}, end:{line: -1, column: -1}}
      }
      const {start, end} = loc
      if(start.line >= 0){
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
    if (isNode(e)) {
      const parentNode = (e.target as HTMLElement).parentElement;
      if (parentNode) {
        onselectNodeStyle(parentNode);
        const id = parentNode.getAttribute('id');
        const path = decodeURIComponent(id.split('/')[0])
        if(eleRef.current){
          const disposable = editorRef.current.onDidChangeModelContent(()=>{
            insertAllButtons(path)
            scrollToLine(id ? codeMapping[id]?.loc: undefined)
            disposable.dispose()
          })
        }
        if(path !== props.filepath){
          const _code = await window.chatBot.requestFileContent({filepath: path})
          changeCode(_code)
        }
        else{
          scrollToLine(id ? codeMapping[id]?.loc: undefined)
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
           keepMounted={true}
           onClose={() => {
             setIsOpen(false);
             // changeCode('');
             // setDot('');
             // setCodeMapping({});
             if (graphvizRef.current) {
               graphvizRef.current.destroy();
             }
             if (eleRef.current) {
               eleRef.current.innerHTML = '';
               if(svgPanZoomRef.current){
                 svgPanZoomRef.current.destroy()
               }
             }
             if (abortControllerRef.current) {
               abortControllerRef.current.abort();
             }
           }}>
      <div style={modelStyle}>
        <div ref={containerRef} style={{ display: 'flex', alignItems: 'flex-start' }}>
          <div className='graphvizContainer' style={{ flex: dot ? 1 : undefined, display:'flex', flexDirection: 'column', ...dotContainerStyle }}>
            <SearchComponent
              onReset={()=>{
                const graphviz = graphvizRef.current;
                eleRef.current.innerHTML = '';
                if(svgPanZoomRef.current){
                  svgPanZoomRef.current.destroy()
                }

                setTimeout(()=>{
                  instance().then(viz => {
                    const result = viz.renderSVGElement(allDotRef.current);
                    eleRef.current.appendChild(result)
                    svgPanZoomRef.current = svgPanZoom(result, {
                      zoomEnabled: true,
                      controlIconsEnabled: false,
                      fit: true,
                      center: true,
                    });
                  });
                },300)
              }}
              onSearch={(query)=>{
                const {inputValue,selectValue} = query
                window.chatBot.requestSearchCalls({
                  calls: allCallsRef.current,
                  kw: inputValue,
                  level: parseInt(selectValue)
                }).then((dot: string)=>{
                  const graphviz = graphvizRef.current;
                  eleRef.current.innerHTML = '';
                  setTimeout(()=>{
                    instance().then(viz => {
                      const result = viz.renderSVGElement(dot)
                      eleRef.current.appendChild(result)
                      svgPanZoomRef.current = svgPanZoom(result, {
                        zoomEnabled: true,
                        controlIconsEnabled: false,
                        fit: true,
                        center: true,
                      });
                    });
                  },300)
                })
              }}
            />
            <div
              ref={eleRef}
              id={'graphviz'}
              className={styles.graphviz}
              style={{flex: 1, overflow: 'auto'}}
              onClick={onClick}
            />
          </div>
          <div className={styles.codeContent} ref={editorEleRef}
               style={{ width: dot ? '50%' : '100%', height: '100%' }}>
            <Whether value={!!code}>
              <Editor
                width={'100%'}
                height={'50vh'}
                theme='vs-dark'
                value={code}
                className={'codeEdit'}
                onMount={(editor) => {
                  editorRef.current = editor;
                  // editor.addCommand(KeyMod.CtrlCmd | KeyCode.KeyF, () => {
                  //   console.log('run');
                  //   editor.getAction("actions.find").run();
                  // });
                  window.chatBot.onFind(()=>{
                    editor.getAction("actions.find").run();
                  })
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

                  editorRef.current.onDidChangeModelContent(()=>{
                    insertAllButtons(props.filepath)
                  })

                  insertAllButtons(props.filepath)
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

export default forwardRef<CodeViewHandle, CodeViewProps>(CodeView);

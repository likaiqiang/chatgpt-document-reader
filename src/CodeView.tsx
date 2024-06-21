import React, { useRef, forwardRef, useImperativeHandle, RefObject, useState, useEffect } from 'react';
import {selectAll} from "d3-selection";
import { Modal } from '@mui/material';
import ReactMarkdown from "react-markdown";
import {Prism as SyntaxHighlighter} from "react-syntax-highlighter";
import {vscDarkPlus} from "react-syntax-highlighter/dist/cjs/styles/prism";
import Whether, { Else, If } from '@/components/Whether';
// @ts-ignore
import * as d3 from "d3-graphviz";
import styles from '@/styles/Home.module.css';

const selectNodeConfig = {
  color:'red'
}

const modalStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80%',
  maxHeight: '70vh',
  backgroundColor: 'white',
  border: '2px solid #000',
  boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
  padding: '16px'
};

export interface CodeViewHandle {
  renderSvg: (dot:string) => void;
  setIsOpen: (open: boolean) => void,
  setCode: (code:string) => void
}

const CodeView = (props: {}, ref: RefObject<CodeViewHandle>)=>{
  const eleRef = useRef<HTMLDivElement>()
  const graphvizRef = useRef()
  const containerRef = useRef()
  const [isOpen, setIsOpen] = useState(false)
  const [code, setCode] = useState('')
  const [dot, setDot] = useState('')
  const renderSvg = (dot:string)=> {
    if(!graphvizRef.current){
      graphvizRef.current = d3.graphviz(`#${eleRef.current?.id}`)
    }
    const graphviz = graphvizRef.current!
    try {
      graphviz.resetZoom()
    } catch (e) {
      // doing
    }
    setTimeout(()=>{
      setDot(dot)
      graphviz.renderDot(dot)
    },0)

  }
  const isNode = (e: React.MouseEvent<HTMLElement, MouseEvent>)=>{
    const perentEle = (e.target as HTMLElement).parentElement
    return perentEle?.classList.contains('node')
  }

  const onselectNodeStyle = (node: HTMLElement)=>{
    selectAll("g.node").select("path").style("stroke", "black");
    // node.select("path").style("stroke", selectNodeConfig.color);
    node.querySelector("path").style.stroke = selectNodeConfig.color
  }
  const onClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>)=>{
    if(isNode(e)){
      onselectNodeStyle((e.target as HTMLElement).parentElement)
      // onNodeClick(e.target.parentElement)
    }
  }
  useImperativeHandle(ref,()=>{
    return {
      renderSvg,
      setIsOpen,
      setCode
    }
  })

  return (
    <Modal open={isOpen}
           onClose={()=>{
             setIsOpen(false)
           }}>
      <div ref={containerRef} style={Object.assign({},modalStyle,{display:'flex',alignItems:'center'})}>
        <div
          ref={eleRef}
          id={'graphviz'}
          className={styles.graphviz}
          style={{flex: dot ? 1 : ''}}
          onClick={onClick}
        />
        <div className={styles.codeContent} style={{width: dot ? '50%' :'100%'}}>
          <ReactMarkdown
            children={code}
            components={{
              code({node, inline, className, children, ...props}) {
                return (
                  <Whether value={!inline}>
                    <If>
                      <div className='codebox-handler' style={{maxHeight:'60vh',overflow:'auto'}}>
                        <SyntaxHighlighter
                          children={String(children)}
                          // @ts-ignore
                          style={vscDarkPlus}
                          PreTag="div"
                          {...props}
                        />
                      </div>
                    </If>
                    <Else>
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </Else>
                  </Whether>
                )
              }
            }}
          />
        </div>
      </div>
    </Modal>

  )
}
export default forwardRef<CodeViewHandle, {}>(CodeView)

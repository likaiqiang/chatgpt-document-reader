// eslint-disable-next-line no-use-before-define
import React, {useEffect, useRef, useState } from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import DataFor from '@/components/DataFor';
import Whether, { Else, If } from '@/components/Whether';
import {useLocalStorage} from '@/utils/hooks';
import cloneDeep from 'lodash.clonedeep';
import { useLatest, useMemoizedFn } from 'ahooks/es/index';
import { toast, Toaster } from 'react-hot-toast';
import { ChatResponse, Resource } from '@/types/chat';
import { useImmer } from 'use-immer';
import ReactLoading from 'react-loading';
import ReactDOM from 'react-dom';
import botImage from '@/assets/images/bot-image.png'
import userIcon from '@/assets/images/usericon.png'
import { Box, Button, Link, Modal, TextField, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { ValidatorForm, TextValidator } from "react-material-ui-form-validator";
import TextareaAutosize from 'react-textarea-autosize';
import Confirm from '@/Confirm';

enum IngestDataType{
    local = 'local',
    remote = 'remote'
}

function convertUnicodeToNormal(str:string) {
    // 创建一个正则表达式，匹配Unicode转义序列的格式
    const unicodeRegex = /\\u[0-9a-fA-F]{4}/g;
    // 使用replace方法，将匹配的Unicode转义序列还原为普通字符
    const result = str.replace(unicodeRegex, function (match) {
        // 去掉转义序列的前缀
        const hex = match.slice(2);
        // 将十六进制数转换为十进制数
        const codePoint = parseInt(hex, 16);
        // 返回对应的字符
        return String.fromCharCode(codePoint);
    });
    // 返回结果字符串
    return result;
}

const isUrl = (value:string)=>{
    const urlRegex = /^(https?:\/\/)?((([a-z\d]([a-z\d-]*[a-z\d])*)\.)+[a-z]{2,}|((\d{1,3}\.){3}\d{1,3}))(?::\d{2,5})?(\/[-a-zA-Z\d%_.~+]*)*(\?[;&a-zA-Z\d%_.~+=-]*)?(\#[-a-zA-Z\d_]*)?$/i;
    return urlRegex.test(value)
}

ValidatorForm.addValidationRule('isURL', isUrl);

export default function App() {
    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [uploadLoading, setUploadLoading] = useState(false)
    const [active, setActive] = useState(0)


    const [resources, setResources] = useImmer<Resource[]>([])
    const [cache, setCache, forceUpdateCache] = useLocalStorage('chat-cache', {})
    const cacheRef = useLatest(cache)
    const curResourceName = resources.length ? resources[active].filename! : ''

    const [apiConfigModal, setApiConfigModal] = useImmer<{isOpen:boolean, config: ApiConfig, proxy: string}>({
        isOpen:false,
        config: {
            baseUrl:'',
            apiKey:''
        },
        proxy:''
    })
    const [uploadModal, setUploadModal] = useImmer({
        isOpen: false
    })

    const [urlModal, setUrlModal] = useImmer({
        isOpen: false,
        url:''
    })
    const [clearHistoryModal, setClearHistoryModal] = useImmer({
        isOpen: false
    })
    const [deleteFileModal, setDeleteFileModal] = useImmer({
        isOpen: false
    })

    const messageListRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const initCacheByName = useMemoizedFn((name: string) => {
        if (!cacheRef.current[name]) {
            setCache({
                ...cache,
                [name]: {
                    messages: [
                        {
                            message: '您好，请问您想了解本文档的哪些内容？',
                            type: 'apiMessage',
                        },
                    ],
                    history: []
                }
            })
        }
    })
    function getResources(){
        return window.chatBot.getResources().then(async res=>{
            const sortedRes = res.sort((a,b)=>{
                return a.birthtime.getTime() - b.birthtime.getTime()
            })
            console.log('sortedRes',sortedRes);
            setResources(sortedRes)
            if(res.length){
                cacheRef.current =  await forceUpdateCache()
                initCacheByName(sortedRes[0].filename!)
                setActive(0)
                return window.chatBot.setRenderCurrentFile(sortedRes[0].filename!)
            }
        })
    }
    function getApiConfig(){
        return window.chatBot.requestGetApiConfig().then(config=>{
            setApiConfigModal(draft => {
                draft.config = config
            })
        })
    }
    useEffect(() => {
        getResources().then()
        textAreaRef.current?.focus();
        window.chatBot.onOutputDirChange(()=>{
            getResources().then()
        })
        window.chatBot.onApiConfigChange(()=>{
            getApiConfig().then(()=>{
                setApiConfigModal(draft => {
                    draft.isOpen = true
                })
            })
        })
        window.chatBot.onShowClearHistoryModal(()=>{
            setClearHistoryModal(draft => {
                draft.isOpen = true
            })
        })
        window.chatBot.onShowDeleteFileModal(()=>{
            setDeleteFileModal(draft => {
                draft.isOpen = true
            })
        })
        getApiConfig().then()
        window.chatBot.requestGetProxy().then(proxy=>{
            setApiConfigModal(draft => {
                draft.proxy = proxy
            })
        })
    }, []);

    // handle form submission

    const handleSubmit = useMemoizedFn(async (e) => {
        e.preventDefault();
        try{
            await window.chatBot.checkApiConfig()
        } catch {
            setApiConfigModal(draft => {
                draft.isOpen = true
            })
            return Promise.reject()
        }
        if (resources.length === 0) {
            return toast('请先上传一个文档')
        }
        if (!query) {
            return toast('请先输入一个问题')
        }

        const question = query.trim();
        const newCache = cloneDeep(cacheRef.current)

        newCache[curResourceName].messages.push({
            type: 'userMessage',
            message: question
        })
        setCache(newCache)

        setQuery('');

        try {
            setLoading(true);
            const data: ChatResponse = await window.chatBot.chat({
                question,
                history,
                filename: resources[active].filename
            })
            const newCache = cloneDeep(cacheRef.current)
            newCache[curResourceName].messages.push({
                type: 'apiMessage',
                message: data.text,
                sourceDocs: data.sourceDocuments
            })

            newCache[curResourceName].history.push([
                question, data.text
            ])
            setCache(newCache)
            setLoading(false);
            messageListRef.current?.scrollTo(0, messageListRef.current.scrollHeight);
        } catch (error){
            toast.error(error.toString())
            setLoading(false);
        }
    })

    // prevent empty submissions
    const handleEnter = useMemoizedFn( async e => {
        if(e.shiftKey) return
        if (e.key === 'Enter' && query) {
            handleSubmit(e);
        } else if (e.key === 'Enter') {
            e.preventDefault();
        }
    })

    const onTabClick = useMemoizedFn((index) => {
        const name = resources[index].filename!
        initCacheByName(name)
        setActive(index)
        window.chatBot.setRenderCurrentFile(name)
    })
    const onLocalFileUpload = (type: IngestDataType = IngestDataType.local)=>{
        let promise = null
        setUploadModal(draft => {
            draft.isOpen = false
        })
        setUploadLoading(true)
        if(type === IngestDataType.local){
            promise = window.chatBot.selectFile().then(files=>{
                return window.chatBot.ingestData(files)
            })
        }
        else{
            promise = window.chatBot.ingestData([urlModal.url])
        }
        return promise.then(res=>{
            setResources(draft => {
                draft.push(res)
            })
            setActive(resources.length)
            initCacheByName(res.filename!)
            window.chatBot.setRenderCurrentFile(res.filename!)
        }).catch((error)=>{
            toast.error(error.toString())
        }).finally(()=>{
            setUploadLoading(false)
        })
    }
    const onRemoteFileUpload = ()=>{
        if(!urlModal.url.includes('https://github.com')) return toast('不支持的url')
        return onLocalFileUpload(IngestDataType.remote)
    }
    const onFileUpload = async () => {

        try{
            await window.chatBot.checkApiConfig()
        } catch {
            setApiConfigModal(draft => {
                draft.isOpen = true
            })
            return Promise.reject()
        }
        setUploadModal(draft => {
            draft.isOpen = true
        })

    }

    const { messages, history } = cache[curResourceName] || { messages: [], history: [] };

    const modalStyle = {
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 400,
        bgcolor: 'background.paper',
        border: '2px solid #000',
        boxShadow: 24,
        p: 4,
    };

    return (
        <>
            <Layout>
                <div className="flex flex-col gap-4">
                    <h1 className="text-2xl font-bold leading-[1.1] tracking-tighter text-center">
                        Chat With Your Docs
                    </h1>
                    <Whether value={!!resources.length}>
                        <If>
                            <div
                                className="flex justify-center text-sm font-medium text-center text-gray-500 border-gray-200 dark:text-gray-400 dark:border-gray-700">
                                <div style={{ width: '75vw' }} className="flex">
                                    <div className="flex-1">
                                        <ul className="flex flex-wrap -mb-px">
                                            <DataFor list={resources}>
                                                {
                                                    (item, index) => {
                                                        return (
                                                            <li className={["mr-10", "mb-10",styles.tabItem,active === index ? styles.tabActive : ''].join(" ")}
                                                                title={item.filename}
                                                                onClick={() => {
                                                                    onTabClick(index)
                                                                }}>
                                                                {convertUnicodeToNormal(item.filename)}
                                                            </li>
                                                        )
                                                    }
                                                }
                                            </DataFor>
                                        </ul>
                                    </div>
                                    <div className="flex w-52 items-center justify-center">
                                        <label onClick={onFileUpload}
                                               className="flex flex-col items-center justify-center w-full border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                <svg className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"
                                                     aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none"
                                                     viewBox="0 0 20 16">
                                                    <path stroke="currentColor" strokeLinecap="round"
                                                          strokeLinejoin="round" strokeWidth="2"
                                                          d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                                </svg>
                                                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span
                                                    className="font-semibold">点击上传文档</span>
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <main className={styles.main}>
                                <div className={styles.cloud}>
                                    <div ref={messageListRef} className={styles.messagelist}>
                                        <DataFor list={messages}>
                                            {
                                                (message, index) => {
                                                    const className = message.type === 'apiMessage'
                                                        ? styles.apimessage
                                                        : (loading && index === messages.length - 1)
                                                            ? styles.usermessagewaiting
                                                            : styles.usermessage;
                                                    return (
                                                        <>
                                                            <div key={`chatMessage-${index}`} className={className}>
                                                                <Whether value={message.type === 'apiMessage'}>
                                                                    <If>
                                                                        <img
                                                                            key={index}
                                                                            src={botImage}
                                                                            alt="AI"
                                                                            width="40"
                                                                            height="40"
                                                                            className={styles.boticon}
                                                                        />
                                                                    </If>
                                                                    <Else>
                                                                        <img
                                                                            key={index}
                                                                            src={userIcon}
                                                                            alt="Me"
                                                                            width="30"
                                                                            height="30"
                                                                            className={styles.usericon}
                                                                        />
                                                                    </Else>
                                                                </Whether>
                                                                <div className={styles.markdownanswer}>
                                                                    <ReactMarkdown>
                                                                        {message.message}
                                                                    </ReactMarkdown>
                                                                </div>
                                                            </div>
                                                            <Whether value={message.sourceDocs}>
                                                                <div
                                                                    className="p-5"
                                                                    key={`sourceDocsAccordion-${index}`}
                                                                >
                                                                    <Accordion
                                                                        type="single"
                                                                        collapsible
                                                                        className="flex-col"
                                                                    >
                                                                        <DataFor list={message.sourceDocs}>
                                                                            {
                                                                                (doc, index) => {
                                                                                    return (
                                                                                        <div
                                                                                            key={`messageSourceDocs-${index}`}>
                                                                                            <AccordionItem
                                                                                                value={`item-${index}`}>
                                                                                                <AccordionTrigger>
                                                                                                    <h3>Source {index + 1}</h3>
                                                                                                </AccordionTrigger>
                                                                                                <AccordionContent>
                                                                                                    <ReactMarkdown>
                                                                                                        {doc.pageContent}
                                                                                                    </ReactMarkdown>
                                                                                                    <p className="mt-2">
                                                                                                        <b>Source:</b> {doc.metadata.source}
                                                                                                    </p>
                                                                                                </AccordionContent>
                                                                                            </AccordionItem>
                                                                                        </div>
                                                                                    )
                                                                                }
                                                                            }
                                                                        </DataFor>
                                                                    </Accordion>
                                                                </div>
                                                            </Whether>
                                                        </>
                                                    )
                                                }
                                            }
                                        </DataFor>
                                    </div>
                                </div>
                                <div className={styles.center}>
                                    <div className={styles.cloudform}>
                                        <form onSubmit={handleSubmit}>
                                            <TextareaAutosize
                                                disabled={loading}
                                                onKeyDown={handleEnter}
                                                ref={textAreaRef}
                                                autoFocus={false}
                                                rows={1}
                                                maxLength={512}
                                                id="userInput"
                                                name="userInput"
                                                placeholder={
                                                    loading
                                                        ? 'Waiting for response...'
                                                        : 'What is this legal case about?'
                                                }
                                                value={query}
                                                onChange={(e) => setQuery(e.target.value)}
                                                className={styles.textarea}
                                            />
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className={styles.generatebutton}
                                            >
                                                <Whether value={loading}>
                                                    <If>
                                                        <div className={styles.loadingwheel}>
                                                            <LoadingDots color="#000" />
                                                        </div>
                                                    </If>
                                                    <Else>
                                                        <svg
                                                            viewBox="0 0 20 20"
                                                            className={styles.svgicon}
                                                            xmlns="http://www.w3.org/2000/svg"
                                                        >
                                                            <path
                                                                d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
                                                        </svg>
                                                    </Else>
                                                </Whether>
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </main>
                        </If>
                        <Else>
                            <div className="pl-10 pr-10">
                                <label onClick={onFileUpload} htmlFor="dropzone-file2"
                                       className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-bray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <svg className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400"
                                             aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none"
                                             viewBox="0 0 20 16">
                                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"
                                                  strokeWidth="2"
                                                  d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                                        </svg>
                                        <p className="mb-2 text-sm text-gray-500 dark:text-gray-400"><span
                                            className="font-semibold">点击上传文档</span></p>
                                    </div>
                                </label>
                            </div>
                        </Else>
                    </Whether>
                </div>
                <footer className="m-auto p-4">
                    Powered by LangChainAI.
                </footer>
            </Layout>
            <Toaster />
            <Whether value={uploadLoading}>
                {
                    ReactDOM.createPortal(
                      <div className={styles.loadingMask}>
                          <ReactLoading type={'bars'} color="#000" />
                      </div>,
                      document.body
                    )
                }
            </Whether>
            <Modal
              open={uploadModal.isOpen}
              onClose={()=>{
                  setUploadModal(draft=>{
                      draft.isOpen = false
                  })
              }}
            >
                <Box sx={modalStyle}>
                    <Link
                      component="button"
                      onClick={()=>{
                          onLocalFileUpload()
                      }}
                      style={{marginBottom: '20px'}}
                    >
                        从文件上传
                    </Link>
                    <ValidatorForm onSubmit={e=>{
                        e.preventDefault()
                    }}>
                        <Box>
                            <TextField
                              value={urlModal.url}
                              label="从远程网页上传, 例如https://github.com/langchain-ai/langchainjs/blob/0.1.16/libs/langchain-openai/src/embeddings.ts"
                              style={{width:'100%'}}
                              size={"small"}
                              onChange={e=> {
                                  setUrlModal(draft => {
                                      // @ts-ignore
                                      draft.url = e.target.value
                                  })
                              }}
                              onKeyDown={event=>{
                                  if(event.key === 'Enter' || event.code === 'Enter'){
                                      if(isUrl(urlModal.url)){
                                          onRemoteFileUpload()
                                      }
                                      else {
                                          toast('请输入正确的url')
                                      }
                                  }
                              }}

                            />
                        </Box>
                    </ValidatorForm>
                </Box>
            </Modal>
            <Confirm
              open={clearHistoryModal.isOpen}
              onClose={()=>{
                  setClearHistoryModal(draft => {
                      draft.isOpen = false
                  })
              }}
              onCancel={()=>{
                  setClearHistoryModal(draft => {
                      draft.isOpen = false
                  })
              }}
              onConfirm={()=>{
                  window.chatBot.replyClearHistory(
                    resources[active].filename
                  ).then(async ()=>{
                      await forceUpdateCache()
                      setClearHistoryModal(draft => {
                          draft.isOpen = false
                      })
                  })
              }}
            />
            <Confirm
              open={deleteFileModal.isOpen}
              onClose={()=>{
                  setDeleteFileModal(draft => {
                      draft.isOpen = false
                  })
              }}
              onCancel={()=>{
                  setDeleteFileModal(draft => {
                      draft.isOpen = false
                  })
              }}
              onConfirm={()=>{
                  window.chatBot.replyDeleteFile(resources[active].filename).then(()=>{
                      return getResources().then(()=>{
                          setDeleteFileModal(draft => {
                              draft.isOpen = false
                          })
                      })
                  })
              }}
            />
            <Modal
              open={apiConfigModal.isOpen}
              onClose={()=>{
                  setApiConfigModal(draft => {
                      draft.isOpen = false
                  })
              }}
            >
                <Box sx={modalStyle}>
                    <ValidatorForm onSubmit={e=>{
                        e.preventDefault()
                        Promise.all([
                            window.chatBot.replyApiConfig(apiConfigModal.config),
                            window.chatBot.replyProxy(apiConfigModal.proxy)
                        ]).then(()=>{
                            setApiConfigModal(draft => {
                                draft.isOpen = false
                            })
                        })
                    }}>
                        <TextValidator
                          name={'baseUrl'}
                          value={apiConfigModal.config.baseUrl}
                          validators={["required","isURL"]}
                          errorMessages={["请输入内容","请输入正确的url"]}
                          label="请输入baseurl"
                          style={{width:'100%', marginBottom: '20px'}}
                          size={"small"}
                          onChange={e=> {
                              setApiConfigModal(draft => {
                                  // @ts-ignore
                                  draft.config.baseUrl = e.target.value
                              })
                          }}
                        />
                        <TextValidator
                          name={'apiKey'}
                          value={apiConfigModal.config.apiKey}
                          label="please enter apikey"
                          validators={["required"]}
                          errorMessages={["please enter apikey"]}
                          style={{width: '100%', marginBottom: '20px'}}
                          size={"small"}
                          onChange={e=> {
                              setApiConfigModal(draft => {
                                  // @ts-ignore
                                  draft.config.apiKey = e.target.value
                              })
                          }}
                        />
                        <TextValidator
                          name={'proxy'}
                          value={apiConfigModal.proxy}
                          label="proxy config eg: http://127.0.0.1:7890"
                          style={{width: '100%', marginBottom: '20px'}}
                          size={"small"}
                          onChange={e=> {
                              setApiConfigModal(draft => {
                                  // @ts-ignore
                                  draft.proxy = e.target.value
                              })
                          }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                            <Button variant="contained" color="secondary" onClick={()=>{
                                window.chatBot.requestTestApi({
                                    ...apiConfigModal.config,
                                    proxy: apiConfigModal.proxy
                                }).then(()=>{
                                    toast.success('api test success')
                                }).catch((e)=>{
                                    if(!e.toString().includes('AbortError')){
                                        toast.error('api test failed')
                                    }
                                })
                            }}>
                                测试
                            </Button>
                            <Button type={'submit'} variant="contained" color="primary">
                                确认
                            </Button>
                        </Box>
                    </ValidatorForm>
                </Box>
            </Modal>
        </>
    );
}

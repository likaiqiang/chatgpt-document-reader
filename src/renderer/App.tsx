// eslint-disable-next-line no-use-before-define
import React, { useEffect, useRef, useState } from 'react';
import Layout from '@/components/layout';
import styles from '@/styles/Home.module.css';
import ReactMarkdown from 'react-markdown';
import LoadingDots from '@/components/ui/LoadingDots';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import DataFor from '@/components/DataFor';
import Whether, { Else, If } from '@/components/Whether';
import useLocalStorage from '@/utils/useLocalStorage';
import cloneDeep from 'lodash.clonedeep';
import { useLatest, useMemoizedFn } from 'ahooks/es/index';
import { Toaster } from 'react-hot-toast';
import { ChatResponse, Resource } from '@/types/chat';
import { Channel } from '@/types/bridge';

const partKeyPrefix = '@___PART___'

// export async function getFingerprint() {
//     // const fp = await FingerprintJS.load();
//     // const result = await fp.get();
//     // return result.visitorId;
//     return 'a07ec68042223e38014a70469d33627b'
// }


export default function App() {

    const [query, setQuery] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [active, setActive] = useState(-1)
    // const [messageState, setMessageState] = useState<{
    //   messages: Message[];
    //   history: [string, string][];
    //   pendingSourceDocs?: Document[];
    // }>({
    //   messages: [
    //     {
    //       message: 'Hi, what would you like to learn about this document?',
    //       type: 'apiMessage',
    //     },
    //   ],
    //   history: [],
    // });


    const [resources, setResources] = useState<Resource[]>([])
    const [cache, setCache] = useLocalStorage(partKeyPrefix + 'chat-cache', {})
    const cacheRef = useLatest(cache)
    const curResourceName = resources.length ? resources[0].filename! : ''


    const messageListRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    const initCacheByName = useMemoizedFn((name: string) => {
        if (!cacheRef.current[name]) {
            setCache({
                ...cache,
                [name]: {
                    messages: [
                        {
                            message: 'Hi, what would you like to learn about this document?',
                            type: 'apiMessage',
                        },
                    ],
                    history: []
                }
            })
        }
    })

    useEffect(() => {
        window.chatBot.invoke(Channel.resources).then(res=>{
            setResources(res)
            if(res.length){
                initCacheByName(res[0].filename!)
                setActive(0)
            }
        })
        textAreaRef.current?.focus();
    }, []);

    // handle form submission

    const handleSubmit = useMemoizedFn(async (e) => {
        e.preventDefault();

        setError(null);
        if (resources.length === 0) {
            return alert("Please upload a resource first")
        }
        if (!query) {
            alert('Please input a question');
            return;
        }

        const question = query.trim();
        const newCache = cloneDeep(cacheRef.current)

        newCache[curResourceName].messages.push({
            type: 'userMessage',
            message: question
        })
        setCache(newCache)

        setLoading(true);
        setQuery('');
        try {
            const data: ChatResponse = await window.chatBot.invoke(Channel.chat, {
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
            debugger
            setError(error as string);
            setLoading(false);
        }
    })

    // prevent empty submissions
    const handleEnter = useMemoizedFn(e => {
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
    })
    const onFileUpload = () => {
        window.chatBot.invoke(Channel.dialog).then(console.log)
    }

    const { messages, history } = cache[curResourceName] || { messages: [], history: [] };
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
                                                            <li className="mr-2" onClick={() => {
                                                                onTabClick(index)
                                                            }}>
                                                                <a
                                                                    className={["inline-block", "p-4", "border-b-2", "rounded-t-lg", "hover:text-gray-600", "dark:hover:text-gray-300", active === index ? 'border-blue-600' : ''].join(' ')}>
                                                                    {item.filename}
                                                                </a>
                                                            </li>
                                                        )
                                                    }
                                                }
                                            </DataFor>
                                        </ul>
                                    </div>
                                    <div className="flex w-80 items-center justify-center">
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
                                                    className="font-semibold">Click to upload</span> or drag and drop
                                                </p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">SVG, PNG, JPG or
                                                    GIF (MAX. 800x400px)</p>
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
                                                                            src={'/images/bot-image.png'}
                                                                            alt="AI"
                                                                            width="40"
                                                                            height="40"
                                                                            className={styles.boticon}
                                                                        />
                                                                    </If>
                                                                    <Else>
                                                                        <img
                                                                            key={index}
                                                                            src="/images/usericon.png"
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
                                            <textarea
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
                                <Whether value={!!error}>
                                    <div className="border border-red-400 rounded-md p-4">
                                        <p className="text-red-500">{error}</p>
                                    </div>
                                </Whether>
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
                                            className="font-semibold">Click to upload</span> or drag and drop</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">SVG, PNG, JPG or GIF
                                            (MAX. 800x400px)</p>
                                    </div>
                                </label>
                            </div>
                        </Else>
                    </Whether>
                </div>
                <footer className="m-auto p-4">
                    <a href="https://twitter.com/mayowaoshin">
                        Powered by LangChainAI.
                    </a>
                </footer>
            </Layout>
            <Toaster />
        </>
    );
}

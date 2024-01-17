
export enum Channel {
    selectFile = 'select_file',
    ingestdata = 'ingest_data',
    chat = 'chat',
    resources = 'get_resources',
    checkProxy = 'check_proxy',
    checkApiConfig = 'check_apikey',
    outputDirChange = 'output_dir_change',
    apiConfigChange = 'api_config_change',
    replyApiConfig = 'reply_api_config',
    proxyChange = 'proxy_change',
    replyProxy = 'reply_proxy',
    requestGetApiConfig = 'request_get_api_config',
    requestGetProxy = 'request_get_proxy',
    requestTestApi = 'request_test_api',
    findInPage = 'find_in_page',
    stopFindInPage = 'stop_find_in_page',
    webContentsOn = 'web_contents_on'
}

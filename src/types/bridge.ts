
export enum Channel {
    selectFile = 'select_file',
    ingestdata = 'ingest_data',
    chat = 'chat',
    resources = 'get_resources',
    checkProxy = 'check_proxy',
    checkChatConfig = 'check_chat_config',
    checkEmbeddingConfig = 'check_embedding_config',
    outputDirChange = 'output_dir_change',
    chatConfigChange = 'chat_config_change',
    embeddingConfigChange = 'embedding_config_change',
    onWindowFocussed = 'on_window_focussed',
    showClearHistoryModal = 'show_clear_history_modal',
    showDeleteFileModal = 'showDeleteFileModal',
    renderFileHistoryCleared = 'render_file_history_cleared',
    replyChatConfig = 'reply_chat_config',
    proxyChange = 'proxy_change',
    replyProxy = 'reply_proxy',
    requestGetChatConfig = 'request_get_chat_config',
    requestGetEmbeddingConfig = 'request_get_embedding_config',
    replyEmbeddingConfig = 'reply_embedding_config',
    requestGetProxy = 'request_get_proxy',
    requestGetModels = 'request_get_modals',
    requestGetModel = 'request_get_model',
    replyModel = 'reply_model',
    requestTestChatConfig = 'request_test_chat_config',
    requestTestEmbeddingConfig = 'request_test_embedding_config',
    requestCallGraph = 'request_call_graph',
    requestFileContent='requestFileContent',
    findInPage = 'find_in_page',
    stopFindInPage = 'stop_find_in_page',
    electronStoreGet = 'electron_store_get',
    electronStoreSet = 'electron_store_set',
    setRenderCurrentFile = 'set_render_current_file',
    setCodeModalStatus = 'set_code_modal_status',
    onFoundInPageResult = 'on_found_in_page_result',
    onFound = 'on_found',
    requestOpenFindWindow = 'request_open_find_window',
    setSearchBoxSize = 'set_search_box_size',
    closeSearchWindow = 'close_search_window',
    replyClearHistory = 'reply_clear_history',
    replyDeleteFile = 'reply_delete_file',
    requestllm = 'requestllm',
    sendSignalId = 'send_signal_id',
    searchCalls = 'search_calls',
}

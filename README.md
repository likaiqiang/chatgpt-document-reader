# ChatGPT PDF Reader

ChatGPT PDF Reader 是一个基于Electron构建的应用，它能让ChatGPT模型阅读和理解PDF文件中的文本内容。该应用利用了OpenAI提供的Embeddings API。

## 特点

- **ChatGPT 阅读**: 让ChatGPT通过PDF文档，对内容进行分析和理解。
- **跨平台支持**: 支持Mac和Windows操作系统。
- **本地缓存**: 应用将对话历史本地缓存，以便用户随时查看过往互动。
- **自定义配置**: 用户可以在设置中输入自己的`openai_api_key`和代理服务器(`proxy`)配置。
- **Embeddings 缓存**: 由于Embeddings API使用相对较多的token，结果会被缓存在本地磁盘，节省资源。
- **缓存管理**: 用户可以在设置中打开缓存目录，以及导入或导出向量文件。

## 安装指南

1. 下载适用于您操作系统的安装包。
2. 双击安装包，按照提示完成安装流程。
3. 启动程序后，按需配置您的`openai_api_key`和`proxy`信息。
4. 加载PDF文件(文件必须可编辑)，并开始您的阅读之旅。

## 设置说明

### OpenAI API Key
您需要一个有效的OpenAI API Key来使用此应用。您可以在OpenAI官网注册并获取API Key。

### 代理设置
如果您处于需要代理服务器的环境中，您可以在设置中进行配置。

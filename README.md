# ChatGPT Document Reader

ChatGPT Document Reader 是一个基于Electron构建的应用，它能让ChatGPT模型阅读和理解PDF文件中的文本内容。该应用利用了OpenAI提供的Embeddings API。

![79e7fd09-8c12-4884-b789-1cce7357aa6b-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/79e7fd09-8c12-4884-b789-1cce7357aa6b-image.png)

![0299cdb0-8688-4928-8950-847a4fd4e462-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/0299cdb0-8688-4928-8950-847a4fd4e462-image.png)
## 特点

- **ChatGPT 文档阅读器**: 不只是pdf，还支持各种编程语言，详细支持列表看[这里](https://github.com/likaiqiang/chatgpt-document-reader/blob/v0.0.3/src/electron/ingest-data.ts#L35)。
- **跨平台支持**: 支持Mac和Windows操作系统(linux太麻烦，发行版众多，有需要的可以自行编译)。
- **本地缓存**: 应用将对话历史本地缓存，以便用户随时查看过往互动，支持多文档。
- **自定义配置**: 用户可以在设置中输入自己的`openai_api_key`和代理服务器(`proxy`)配置。
- **Embeddings 缓存**: 由于Embeddings API使用相对较多的token，结果会被缓存在本地磁盘，节省资源。
- **缓存管理**: 用户可以在设置中打开缓存目录，以及导入或导出向量文件。

## 安装指南

1. 下载适用于您操作系统的安装包。
2. 双击安装包，按照提示完成安装流程。
3. 启动程序后，按需配置您的`openai_api_key`和`proxy`信息。
4. 加载PDF文件(文件必须可编辑,文件名不支持中文)，并开始您的阅读之旅。

## 设置说明

### OpenAI API Key
您需要一个有效的OpenAI API Key来使用此应用。您可以在OpenAI官网注册并获取API Key。

### 代理设置
如果您处于需要代理服务器的环境中，您可以在设置中进行配置。

### 特别说明
如果你的文档很长，embeddings的过程会自动截断合并，向量检索的结果如果超过了最大token，会采取先截断再合并处理，代码的话会根据ast进行截断，gpt的回答也一样，如果上下文太长的话，会先分批向gpt提问，然后再合并处理。当然以上方式虽然价格便宜，但是有时候效果并不好，你也可以在设置里面选择gpt4，请注意你的money，虽然一些网站可以体验到便宜的gpt4服务，但是gpt4的价格仍然是gpt3.5的10倍，你可以在设置里面更换baseurl。

![5265e746-40d1-462f-ba2a-ebdbb9d741ec-image.png](https://likaiqiang-blog.oss-cn-beijing.aliyuncs.com/images/5265e746-40d1-462f-ba2a-ebdbb9d741ec-image.png)

这个测试按钮会调用 `${baseUrl}/models`来验证配置是否有效。

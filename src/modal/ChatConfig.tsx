import { Box, Button, Modal, Checkbox } from '@mui/material';
import LoopIcon from '@mui/icons-material/Loop';
import MenuItem from '@mui/material/MenuItem';
import { TextValidator, ValidatorForm, SelectValidator } from 'react-material-ui-form-validator';
import { toast } from 'react-hot-toast';
import React, { forwardRef, useEffect, useImperativeHandle, useState, useRef } from 'react';
import { useImmer } from 'use-immer';

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

export interface ChatConfigHandler {
  open: ()=>void
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ChatConfigProps{

}

const ChatConfig = (props: ChatConfigProps, ref: React.Ref<ChatConfigHandler>)=>{
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [apiConfigModal, setApiConfigModal] = useImmer<{isOpen:boolean, config: ApiConfig, proxy: string, models: any[]}>({
    isOpen:false,
    config: {
      baseUrl:'',
      apiKey:'',
      ernie: true
    },
    models:[],
    proxy:''
  })
  const [modelLoading, setModelLoading] = useState(false)
  const [model, setModel] = useState('')
  async function getChatConfig(){
    return window.chatBot.requestGetChatConfig().then(config=>{
      setApiConfigModal(draft => {
        draft.config = config
      })
    })
  }
  async function getModels(){
    setModelLoading(true)
    return window.chatBot.requestGetModels(apiConfigModal.config).then(models=>{
      models = models.filter(model=>{
        return model.id.startsWith('gpt')
      })
      setApiConfigModal(draft => {
        draft.models = models ?? []
      })
    }).catch(()=>{
      setApiConfigModal(draft => {
        draft.models = []
      })
    }).finally(()=>{
      setModelLoading(false)
    })
  }

  const disabled = apiConfigModal.config.ernie
  const validatorFormRef = useRef<ValidatorForm>(null)

  useEffect(() => {
    window.chatBot.onChatConfigChange(()=>{
      getChatConfig().then(()=>{
        setApiConfigModal(draft => {
          draft.isOpen = true
        })
      })
    })
    getModels().then().catch(()=>{
      setApiConfigModal(draft => {
        draft.models = []
      })
    })
  }, []);
  useEffect(() => {
    if(apiConfigModal.isOpen){
      getChatConfig().then(getModels)
      window.chatBot.requestGetModel().then(setModel)
    }
  }, [apiConfigModal.isOpen]);
  useImperativeHandle(ref, ()=>{
    return {
      open: ()=>{
        setApiConfigModal(draft => {
          draft.isOpen = true
        })
      }
    }
  } , [apiConfigModal])
  return (
    <Modal
      open={apiConfigModal.isOpen}
      onClose={()=>{
        setApiConfigModal(draft => {
          draft.isOpen = false
        })
      }}
    >
      <Box sx={modalStyle}>
        <ValidatorForm
          ref={validatorFormRef}
          onSubmit={e=>{
            e.preventDefault()
            window.chatBot.replyChatConfig(apiConfigModal.config).then(()=>{
              setApiConfigModal(draft => {
                draft.isOpen = false
              })
            })
          }}>
          <div style={{marginBottom:'20px'}}>
            ernie
            <Checkbox
              checked={apiConfigModal.config.ernie}
              onChange={()=>{
                const value = !apiConfigModal.config.ernie
                setApiConfigModal(draft => {
                  draft.config.ernie = value
                })
                if(value){
                  validatorFormRef.current?.resetValidations()
                }
              }}
            />
          </div>
          <div style={{display:'flex',alignItems:'center'}}>
            <SelectValidator
              label="选择模型"
              size={"small"}
              style={{marginBottom: '20px'}}
              onChange={(e)=>{
                window.chatBot.replyModel((e.target as HTMLSelectElement).value)
              }}
              name="model"
              value={model || ''}
              validators={!apiConfigModal.config.ernie ? ['required']: undefined}
              errorMessages={!apiConfigModal.config.ernie ? ['请选择模型']:undefined}
              disabled={disabled}
            >
              {
                apiConfigModal.models.map(model=>{
                  return <MenuItem key={model.id} value={model.id}>{model.id}</MenuItem>
                })
              }
            </SelectValidator>
            <LoopIcon  className={modelLoading ? 'spin' :''} onClick={()=>{
              getModels().then()
            }}/>
          </div>
          <TextValidator
            name={'baseUrl'}
            value={apiConfigModal.config.baseUrl}
            validators={!apiConfigModal.config.ernie ? ["required","isURL"]: undefined}
            errorMessages={!apiConfigModal.config.ernie ?["请输入内容","请输入正确的url"]:undefined}
            label="请输入openai baseurl"
            style={{width:'100%', marginBottom: '20px'}}
            size={"small"}
            disabled={disabled}
            onChange={e=> {
              setApiConfigModal(draft => {
                draft.config.baseUrl = (e.target as HTMLInputElement).value
              })
            }}
          />
          <TextValidator
            name={'apiKey'}
            value={apiConfigModal.config.apiKey}
            label="please enter apikey"
            validators={!apiConfigModal.config.ernie ? ["required"] : undefined}
            errorMessages={!apiConfigModal.config.ernie ?["please enter apikey"]:undefined}
            style={{width: '100%', marginBottom: '20px'}}
            size={"small"}
            disabled={disabled}
            onChange={e=> {
              setApiConfigModal(draft => {
                draft.config.apiKey = (e.target as HTMLInputElement).value
              })
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button
              variant="contained"
              color="secondary"
              disabled={disabled}
              onClick={()=>{
                window.chatBot.requestTestChatConfig({
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
  )
}
export default forwardRef<ChatConfigHandler, ChatConfigProps>(ChatConfig)

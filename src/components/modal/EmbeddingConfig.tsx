import { Box, Button, Checkbox, Modal } from '@mui/material';
import { TextValidator, ValidatorForm } from 'react-material-ui-form-validator';
import { toast } from 'react-hot-toast';
import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
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

export interface EmbeddingConfigHandler {
  open: ()=>void
}
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface EmbeddingConfigProps{

}


const EmbeddingConfig = (props: EmbeddingConfigProps, ref: React.Ref<EmbeddingConfigHandler>)=>{
  const [apiConfigModal, setApiConfigModal] = useImmer<{isOpen:boolean, config: EmbeddingConfig}>({
    isOpen:false,
    config: {
      baseUrl:'',
      apiKey:'',
      enableProxy: true
    }
  })
  function getEmbeddingConfig(){
    return window.chatBot.requestGetEmbeddingConfig().then(config=>{
      if(typeof config.enableProxy === 'undefined'){
        config.enableProxy = true
        window.chatBot.replyEmbeddingConfig(config)
      }
      setApiConfigModal(draft => {
        draft.config = config
      })
    })
  }

  useEffect(() => {
    window.chatBot.onEmbeddingConfigChange(()=>{
      getEmbeddingConfig().then(()=>{
        setApiConfigModal(draft => {
          draft.isOpen = true
        })
      })
    })
  }, []);
  useEffect(() => {
    if(apiConfigModal.isOpen){
      getEmbeddingConfig().then()
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
        <ValidatorForm onSubmit={e => {
          e.preventDefault()
          window.chatBot.replyEmbeddingConfig(apiConfigModal.config).then(() => {
            setApiConfigModal(draft => {
              draft.isOpen = false
            })
          })
        }}>
          <div style={{ marginBottom: '20px', fontSize: '12px', color: 'rgba(0,0,0,.4)' }}>
            <span style={{ color: 'red', marginRight: '10px' }}>*</span>
            请输入embedding config（默认继承chat config）
          </div>
          <TextValidator
            name={'baseUrl'}
            value={apiConfigModal.config.baseUrl}
            validators={["required", "isURL"]}
            errorMessages={["请输入内容", "请输入正确的url"]}
            label="请输入openai baseurl"
            style={{ width: '100%', marginBottom: '20px' }}
            size={"small"}
            onChange={e => {
              setApiConfigModal(draft => {
                draft.config.baseUrl = (e.target as HTMLInputElement).value
              })
            }}
          />
          <TextValidator
            name={'apiKey'}
            value={apiConfigModal.config.apiKey}
            label="please enter apikey"
            validators={["required"]}
            errorMessages={["please enter apikey"]}
            style={{ width: '100%', marginBottom: '20px' }}
            size={"small"}
            onChange={e => {
              setApiConfigModal(draft => {
                draft.config.apiKey = (e.target as HTMLInputElement).value
              })
            }}
          />
          <div style={{ marginBottom: '20px', fontSize: '12px' }}>
            <span>是否启用代理</span>
            <Checkbox
              checked={apiConfigModal.config.enableProxy}
              onChange={() => {
                const value = !apiConfigModal.config.enableProxy
                setApiConfigModal(draft => {
                  draft.config.enableProxy = value
                })
              }}
            />
          </div>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="contained" color="secondary" onClick={() => {
              window.chatBot.requestTestEmbeddingConfig(apiConfigModal.config).then(() => {
                toast.success('api test success')
              }).catch((e) => {
                if (!e.toString().includes('AbortError')) {
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
export default forwardRef<EmbeddingConfigHandler, EmbeddingConfigProps>(EmbeddingConfig)

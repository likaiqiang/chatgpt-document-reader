import { Box, Button, Dialog, DialogActions, DialogTitle, DialogContent } from '@mui/material';
import React,{FC} from 'react';

interface Props{
  open: boolean,
  onClose: ()=>void,
  onConfirm: ()=>void,
  onCancel: ()=>void
}

const Confirm:FC<Props> = (props)=>{
  const {open, onClose, onCancel, onConfirm} = props
  return (
    <Dialog
      open={open}
      onClose={onClose}
    >
      <DialogContent>
        是否继续？
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          color="primary"
        >
          取消
        </Button>
        <Button
          onClick={onConfirm}
          color="primary"
          autoFocus
        >
          同意
        </Button>
      </DialogActions>
    </Dialog>
  )
}
export default Confirm

import styles from '@/styles/Home.module.css'
import React, { useImperativeHandle, useMemo, useState } from 'react';

export interface ModalType {
  setVisible: (visible:boolean)=>void
}

export interface ModalProps{
  children: React.ReactNode
}

const Modal = React.forwardRef<ModalType,ModalProps>(({children}, ref)=>{
  const [visible, setVisible] = useState(false)
  useImperativeHandle(ref,()=>{
    return {
      setVisible
    }
  })
  const component = useMemo(()=>{
    return (
      <div className={styles.modalContainer}>
        <div className={styles.modalContent}>
          {children}
        </div>
      </div>
    )
  },[children])
  return visible ? component : null
})
export default Modal

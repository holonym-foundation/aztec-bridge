import { toast } from 'react-toastify'

type ToastType = 'default' | 'success' | 'info' | 'warn' | 'error'

export const showToast = (type: ToastType, message: string) => {
  const position = 'top-right'

  switch (type) {
    case 'success':
      toast.success(message, { position })
      break
    case 'info':
      toast.info(message, { position })
      break
    case 'warn':
      toast.warn(message, { position })
      break
    case 'error':
      toast.error(message, { position })
      break
    default:
      toast(message, { position })
      break
  }
} 

import {
  Slide,
  Flip,
  Zoom,
  Bounce,
  toast,
  ToastOptions,
  ToastPosition,
} from 'react-toastify'
import React, { ReactNode } from 'react'
import {
  UseQueryOptions,
  UseMutationOptions,
  useQuery,
  useMutation,
  QueryFunction,
} from '@tanstack/react-query'
import PrivacyModeToast from '@/components/toast/PrivacyModeToast'
import DefaultToast from '@/components/toast/DFToast'
import InfoToast from '@/components/toast/InfoToast'
import LoadingToast from '@/components/toast/LoadingToast'
import SuccessToast from '@/components/toast/SuccessToast'
import WarningToast from '@/components/toast/WarningToast'
import ErrorToast from '@/components/toast/ErrorToast'
// import 'react-toastify/dist/ReactToastify.min.css' // we import it in _app.tsx

// USAGE:
// ******************** Using in a componet as Hook ********************
// const notify = useToast();
// notify.dismissAll()

// notify('default', 'Default toast')
// notify('default', {
//   message: 'Default toast',
//   heading: 'Header Title',
// })

// notify('success', 'Success toast')
// notify('success', {
//   message: 'Success toast',
//   heading: 'Header Title',
// })

// notify('info', 'Info toast')
// notify('info', {
//   message: 'Info toast',
//   heading: 'Header Title',
// })

// notify('warn', 'Warning toast')
// notify('warn', {
//   message: 'Warning toast',
//   heading: 'Header Title',
// })

// notify('error', 'Error toast')
// notify('error', {
//   message: 'Error toast',
//   heading: 'Header Title',
// })

// notify('privacy-mode', 'Privacy mode toast')
// notify('privacy-mode', {
//   message: 'Privacy mode toast',
//   heading: 'Header Title',
// })

// const fakePromise = new Promise((resolve, reject) => {
//   setTimeout(() => {
//     // Change to resolve() to test success, or reject() to test error
//     resolve('All done!')

//     // reject(new Error('Something went wrong!'))
//   }, 2000)
// })

// notify.promise(
//   fakePromise,
//   {
//     pending: {
//       message: 'Processing...',
//       heading: 'Please wait',
//     },
//     success: {
//       message: 'Operation successful!',
//       heading: 'Success',
//     },
//     error: { message: 'Operation failed!', heading: 'Error' },
//   },
//   { autoClose: 3000 }
// )
// Note: Promise toasts automatically show a loading spinner during the pending state


// notify.promise(
//   fakePromise,
//   {
//     pending: {
//       message: 'Processing...',
//       heading: 'Please wait',
//     },
//     success: {
//       message: 'Operation successful!',
//       heading: 'Success',
//     },
//     error: { message: 'Operation failed!', heading: 'Error' },
//   },
//   { autoClose: 3000, animatePromise: true }
// )

// ******************** Using outside of the hook ********************

// showToast('error', `Error toast`)
// showToast('success', `Success toast`)
// showToast('info', `Info toast`)
// showToast('warn', `Warning toast`)
// showToast('privacy-mode', `Privacy mode toast`)
// showToast('default', `Default toast`)
// showToast.promise(fakePromise, {pending: 'Loading...', success: 'Success!', error: 'Error!'})

// ******************** Using with React Query ********************
// export function useQueryhook() {
//   const queryKey = ['queryKey']
//   const queryFn = async () => {
   
//   }

//   return useToastQuery({
//     queryKey,
//     queryFn,
//     // staleTime: 60 * 1000, // 1 minute
//     toastMessages: {
//       pending: 'Loading...',
//       success: 'Success!',
//       error: 'Error',
//     },
//     // toastMessages: {
//     //   pending: {
//     //     message: 'Loading...',
//     //     heading: 'Heading...',
//     //   },
//     //   success: {
//     //     message: 'Success!',
//     //     heading: 'Heading...',
//     //   },
//     //   error: { message: 'Error!', heading: 'Heading...' },
//     // },
//     meta: {
//       persist: true, // Mark this query for persistence
//     },
//   })
// }


// export function useMuataion(onSuccess: (data: any) => void) {

//   const notify = useToast()

//   const mutationFn = async () => {
   
   
//   }

//   return useToastMutation({
//     mutationFn,
//     onSuccess: (data) => {
//       onSuccess(data)
//     },
//     toastMessages: {
//       pending: 'Minting SBT on Ethereum...',
//       success: 'SBT minted successfully on Ethereum!',
//       error: 'Failed to mint SBT on Ethereum',
//     },
//   })
// }
// **********************************************************************

const DEFAULT_TOAST_OPTIONS: ToastOptions = {
  position: 'top-right',
  autoClose: 15000, // 15 seconds
  pauseOnHover: true,
  pauseOnFocusLoss: true,
  // newestOnTop: true, // this is container prop
  closeButton: false,
  closeOnClick: true,
  icon: false,
  // transition: Bounce,
  // transition: Flip,
  transition: Slide,
  // transition: Zoom,
}

type ToastType =
  | 'default'
  | 'success'
  | 'info'
  | 'warn'
  | 'error'
  | 'privacy-mode'

type ToastMessageInput = string | { message: string; heading?: string }

type CustomToastOptions = ToastOptions & {
  animatePromise?: boolean
}

export const useToast = () => {
  const showToast = (
    type: ToastType,
    input: ToastMessageInput,
    options?: CustomToastOptions
  ) => {
    const { message, heading } =
      typeof input === 'string' ? { message: input } : input

    const toastOptions: ToastOptions = {
      ...DEFAULT_TOAST_OPTIONS,
      ...options,
    }

    switch (type) {
      case 'success':
        toast(
          React.createElement(SuccessToast, {
            heading,
            message: typeof message === 'string' ? message : undefined,
          }),
          {
            className: 'success-toast',
            ...toastOptions,
          }
        )
        break
      case 'info':
        toast(
          React.createElement(InfoToast, {
            heading,
            message: typeof message === 'string' ? message : undefined,
          }),
          {
            className: 'info-toast',
            ...toastOptions,
          }
        )
        break
      case 'warn':
        toast(
          React.createElement(WarningToast, {
            heading,
            message: typeof message === 'string' ? message : undefined,
          }),
          {
            className: 'warning-toast',
            ...toastOptions,
          }
        )
        break
      case 'error':
        toast(
          React.createElement(ErrorToast, {
            heading,
            message: typeof message === 'string' ? message : undefined,
          }),
          {
            className: 'error-toast',
            ...toastOptions,
          }
        )
        break
      case 'privacy-mode':
        toast(
          React.createElement(PrivacyModeToast, {
            heading,
            message: typeof message === 'string' ? message : undefined,
          }),
          {
            className: 'privacy-mode-toast',
            ...toastOptions,
          }
        )
        break
      default:
        toast(
          React.createElement(DefaultToast, {
            heading,
            message: typeof message === 'string' ? message : undefined,
          }),
          {
            className: 'default-toast',
            ...toastOptions,
          }
        )
        break
    }
  }

  // Add promise support
  showToast.promise = <T>(
    promise: Promise<T>,
    messages: {
      pending: string | { message: string; heading?: string }
      success: string | { message: string; heading?: string }
      error: string | { message: string; heading?: string }
    },
    options?: CustomToastOptions
  ) => {
    const { animatePromise, ...toastOptions } = options || {}
    const mergedOptions: ToastOptions = {
      ...DEFAULT_TOAST_OPTIONS,
      ...toastOptions,
    }

    // Helper to extract message and heading
    const getMsg = (input: string | { message: string; heading?: string }) =>
      typeof input === 'string' ? { message: input } : input

    // Create a loading toast
    const { message: pendingMsg, heading: pendingHeading } = getMsg(
      messages.pending
    )
    const toastId = toast(
      React.createElement(LoadingToast, {
        heading: pendingHeading,
        message: pendingMsg,
      }),
      { 
        ...mergedOptions,
        className: 'loading-toast', 
        closeButton: false,
        closeOnClick: false,
        autoClose: false,
      }
    )

    promise
      .then((data) => {
        const { message: successMsg, heading: successHeading } = getMsg(
          messages.success
        )
        if (animatePromise) {
          // Dismiss and create new toast with animation
          toast.dismiss(toastId)
          toast(
            React.createElement(SuccessToast, {
              heading: successHeading,
              message: successMsg,
            }),
            {
              className: 'success-toast from-loading',
              ...mergedOptions,
            }
          )
        } else {
          // Update existing toast without animation
          toast.update(toastId, {
            render: React.createElement(SuccessToast, {
              heading: successHeading,
              message: successMsg,
            }),
            className: 'success-toast from-loading',
            type: 'success',
            isLoading: false,
            ...mergedOptions,
          })
        }
        return data
      })
      .catch((error) => {
        const { message: errorMsg, heading: errorHeading } = getMsg(
          messages.error
        )
        if (animatePromise) {
          // Dismiss and create new toast with animation
          toast.dismiss(toastId)
          toast(
            React.createElement(ErrorToast, {
              heading: errorHeading,
              message: errorMsg,
            }),
            {
              className: 'error-toast from-loading',
              ...mergedOptions,
            }
          )
        } else {
          // Update existing toast without animation
          toast.update(toastId, {
            render: React.createElement(ErrorToast, {
              heading: errorHeading,
              message: errorMsg,
            }),
            className: 'error-toast from-loading',
            type: 'error',
            isLoading: false,
            ...mergedOptions,
          })
        }
        throw error
      })

    return promise
  }

  // Add dismiss method
  showToast.dismiss = (toastId?: string | number) => {
    toast.dismiss(toastId)
  }

  showToast.dismissAll = () => {
    toast.dismiss()
  }

  return showToast
}

// ------------------------------------------------------------

// Toast messages type
type ToastMessageObject = {
  message: string
  heading?: string
  options?: ToastOptions
}
type ToastMessages = {
  pending?: string | ToastMessageObject
  success?: string | ToastMessageObject
  error?: string | ToastMessageObject
}

// Toast-enabled React Query hooks
export function useToastQuery<
  TQueryFnData = unknown,
  TError = unknown,
  TData = TQueryFnData,
  TQueryKey extends Array<unknown> = unknown[]
>(
  options: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    'queryFn'
  > & {
    queryFn: QueryFunction<TQueryFnData, TQueryKey>
    toastMessages?: ToastMessages
    /**
     * When true, toast notifications will only be shown on the initial fetch,
     * not background refreshes
     */
    silentRefresh?: boolean
  }
) {
  const notify = useToast()
  const {
    toastMessages,
    queryFn,
    silentRefresh = true,
    ...queryOptions
  } = options

  return useQuery({
    ...queryOptions,
    queryFn: async (context) => {
      let toastId: string | number | undefined

      try {
        const result = queryFn(context)
        const resultPromise = Promise.resolve(result)

        // Show loading toast if messages are provided
        if (toastMessages && toastMessages.pending) {
          const isInitialLoad = !context.signal

          if (!silentRefresh || isInitialLoad) {
            const pendingMsg = typeof toastMessages.pending === 'object' 
              ? toastMessages.pending 
              : { message: toastMessages.pending }

            const pendingOptions = typeof toastMessages.pending === 'object' ? toastMessages.pending.options : {}
            const mergedOptions = {
              ...DEFAULT_TOAST_OPTIONS,
              ...pendingOptions
            }

            // Show loading toast
            toastId = toast(
              React.createElement(LoadingToast, {
                heading: pendingMsg.heading,
                message: pendingMsg.message,
              }),
              { 
                ...mergedOptions,
                className: 'loading-toast', 
                closeButton: false,
                closeOnClick: false,
                autoClose: false,
              }
            )
          }
        }

        const data = await resultPromise

        // Show success toast if we have a loading toast and success message
        if (toastId && toastMessages?.success) {
          const successMsg = typeof toastMessages.success === 'object' 
            ? toastMessages.success 
            : { message: toastMessages.success }

          const successOptions = typeof toastMessages.success === 'object' ? toastMessages.success.options : {}
          const mergedOptions = {
            ...DEFAULT_TOAST_OPTIONS,
            ...successOptions
          }

          toast.update(toastId, {
            render: React.createElement(SuccessToast, {
              heading: successMsg.heading,
              message: successMsg.message,
            }),
            className: 'success-toast from-loading',
            type: 'success',
            isLoading: false,
            ...mergedOptions,
          })
        }

        return data
      } catch (error) {
        // Show error toast if we have a loading toast and error message
        if (toastId && toastMessages?.error) {
          const errorMsg = typeof toastMessages.error === 'object' 
            ? toastMessages.error 
            : { message: toastMessages.error }

          const errorOptions = typeof toastMessages.error === 'object' ? toastMessages.error.options : {}
          const mergedOptions = {
            ...DEFAULT_TOAST_OPTIONS,
            ...errorOptions
          }

          toast.update(toastId, {
            render: React.createElement(ErrorToast, {
              heading: errorMsg.heading,
              message: errorMsg.message,
            }),
            className: 'error-toast from-loading',
            type: 'error',
            isLoading: false,
            ...mergedOptions,
          })
        } else if (toastMessages?.error && !toastId) {
          // Fallback for when there's no loading toast but we have an error
          if (typeof toastMessages.error === 'object') {
            notify(
              'error',
              {
                message: toastMessages.error.message,
                heading: toastMessages.error.heading,
              },
              toastMessages.error.options
            )
          } else {
            notify('error', toastMessages.error)
          }
        }
        throw error
      }
    },
  })
}
// ------------------------------------------------------------

export function useToastMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  options: Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    'mutationFn'
  > & {
    mutationFn: (variables: TVariables) => Promise<TData>
    toastMessages?: ToastMessages
  }
) {
  const notify = useToast()
  const { toastMessages, mutationFn, ...mutationOptions } = options
  const toastIdRef = React.useRef<string | number | undefined>(undefined)

  return useMutation({
    ...mutationOptions,
    mutationFn: async (variables) => {
      try {
        // Show loading toast if messages are provided
        if (toastMessages?.pending) {
          const pendingMsg = typeof toastMessages.pending === 'object' 
            ? toastMessages.pending 
            : { message: toastMessages.pending }

          const pendingOptions = typeof toastMessages.pending === 'object' ? toastMessages.pending.options : {}
          const mergedOptions = {
            ...DEFAULT_TOAST_OPTIONS,
            ...pendingOptions
          }

          toastIdRef.current = toast(
            React.createElement(LoadingToast, {
              heading: pendingMsg.heading,
              message: pendingMsg.message,
            }),
            { 
              ...mergedOptions,
              className: 'loading-toast', 
              closeButton: false,
              closeOnClick: false,
              autoClose: false,
            }
          )
        }

        const result = await mutationFn(variables)
        return result
      } catch (error) {
        // Show error toast if we have a loading toast and error message
        if (toastIdRef.current && toastMessages?.error) {
          const errorMsg = typeof toastMessages.error === 'object' 
            ? toastMessages.error 
            : { message: toastMessages.error }

          const errorOptions = typeof toastMessages.error === 'object' ? toastMessages.error.options : {}
          const mergedOptions = {
            ...DEFAULT_TOAST_OPTIONS,
            ...errorOptions
          }

          toast.update(toastIdRef.current, {
            render: React.createElement(ErrorToast, {
              heading: errorMsg.heading,
              message: errorMsg.message,
            }),
            className: 'error-toast from-loading',
            type: 'error',
            isLoading: false,
            ...mergedOptions,
          })
          toastIdRef.current = undefined // Reset so onError doesn't show duplicate
        }
        throw error
      }
    },
    onSuccess: (data, variables, context) => {
      // Show success toast if we have a loading toast and success message
      if (toastIdRef.current && toastMessages?.success) {
        const successMsg = typeof toastMessages.success === 'object' 
          ? toastMessages.success 
          : { message: toastMessages.success }

        const successOptions = typeof toastMessages.success === 'object' ? toastMessages.success.options : {}
        const mergedOptions = {
          ...DEFAULT_TOAST_OPTIONS,
          ...successOptions
        }

        toast.update(toastIdRef.current, {
          render: React.createElement(SuccessToast, {
            heading: successMsg.heading,
            message: successMsg.message,
          }),
          className: 'success-toast from-loading',
          type: 'success',
          isLoading: false,
          ...mergedOptions,
        })
        toastIdRef.current = undefined // Reset so we don't interfere with future calls
      } else if (toastMessages?.success && !toastIdRef.current) {
        // Fallback for when there's no loading toast but we have a success message
        if (typeof toastMessages.success === 'object') {
          notify(
            'success',
            {
              message: toastMessages.success.message,
              heading: toastMessages.success.heading,
            },
            toastMessages.success.options
          )
        } else {
          notify('success', toastMessages.success)
        }
      }
      
      if (mutationOptions.onSuccess) {
        mutationOptions.onSuccess(data, variables, context)
      }
    },
    onError: (error, variables, context) => {
      // Only show error toast if we don't have a loading toast (fallback)
      if (toastMessages?.error && !toastIdRef.current) {
        if (typeof toastMessages.error === 'object') {
          notify(
            'error',
            {
              message: toastMessages.error.message,
              heading: toastMessages.error.heading,
            },
            toastMessages.error.options
          )
        } else {
          notify('error', toastMessages.error)
        }
      }
      
      if (mutationOptions.onError) {
        mutationOptions.onError(error, variables, context)
      }
    },
  })
}
// ------------------------------------------------------------

export const showToast = (
  type: ToastType,
  input: ToastMessageInput,
  options?: ToastOptions
) => {
  const position: ToastPosition = 'top-right'
  const { message, heading } =
    typeof input === 'string' ? { message: input } : input

  const toastOptions: ToastOptions = {
    ...DEFAULT_TOAST_OPTIONS,
    ...options,
  }

  switch (type) {
    case 'success':
      toast(
        React.createElement(SuccessToast, {
          heading,
          message,
        }),
        { className: 'success-toast', ...toastOptions }
      )
      break
    case 'info':
      toast(
        React.createElement(InfoToast, {
          heading,
          message,
        }),
        { className: 'info-toast', ...toastOptions }
      )
      break
    case 'warn':
      toast(
        React.createElement(WarningToast, {
          heading,
          message,
        }),
        { className: 'warning-toast', ...toastOptions }
      )
      break
    case 'error':
      toast(
        React.createElement(ErrorToast, {
          heading,
          message,
        }),
        { className: 'error-toast', ...toastOptions }
      )
      break
    case 'privacy-mode':
      toast(
        React.createElement(PrivacyModeToast, {
          heading,
          message: typeof message === 'string' ? message : undefined,
        }),
        {
          className: 'privacy-mode-toast',
          toastId: 'privacy-mode-toastId',
          ...toastOptions,
        }
      )
      break
    default:
      toast(
        React.createElement(DefaultToast, {
          heading,
          message,
        }),
        { className: 'default-toast', ...toastOptions }
      )
      break
  }
}

showToast.dismiss = (toastId?: string | number) => {
  toast.dismiss(toastId)
}

showToast.dismissAll = () => {
  toast.dismiss()
}

showToast.promise = function <T>(
  promise: Promise<T>,
  messages: {
    pending: string | { message: string; heading?: string }
    success: string | { message: string; heading?: string }
    error: string | { message: string; heading?: string }
  },
  options?: CustomToastOptions
) {
  const { animatePromise, ...toastOptions } = options || {}
  const mergedOptions: ToastOptions = {
    ...DEFAULT_TOAST_OPTIONS,
    ...toastOptions,
  }

  const getMsg = (input: string | { message: string; heading?: string }) =>
    typeof input === 'string' ? { message: input } : input

  const { message: pendingMsg, heading: pendingHeading } = getMsg(messages.pending)
  const toastId = toast(
    React.createElement(LoadingToast, {
      heading: pendingHeading,
      message: pendingMsg,
    }),
    { 
      ...mergedOptions,
      className: 'loading-toast', 
      closeButton: false,
      closeOnClick: false,
      autoClose: false,
    }
  )

  promise
    .then((data) => {
      const { message: successMsg, heading: successHeading } = getMsg(messages.success)
      if (animatePromise) {
        toast.dismiss(toastId)
        toast(
          React.createElement(SuccessToast, {
            heading: successHeading,
            message: successMsg,
          }),
          { className: 'success-toast from-loading', ...mergedOptions }
        )
      } else {
        toast.update(toastId, {
          render: React.createElement(SuccessToast, {
            heading: successHeading,
            message: successMsg,
          }),
          className: 'success-toast from-loading',
          type: 'success',
          isLoading: false,
          ...mergedOptions,
        })
      }
      return data
    })
    .catch((error) => {
      const { message: errorMsg, heading: errorHeading } = getMsg(messages.error)
      if (animatePromise) {
        toast.dismiss(toastId)
        toast(
          React.createElement(ErrorToast, {
            heading: errorHeading,
            message: errorMsg,
          }),
          {
            className: 'error-toast from-loading',
            ...mergedOptions,
          }
        )
      } else {
        toast.update(toastId, {
          render: React.createElement(ErrorToast, {
            heading: errorHeading,
            message: errorMsg,
          }),
          className: 'error-toast from-loading',
          type: 'error',
          isLoading: false,
          ...mergedOptions,
        })
      }
      throw error
    })

  return promise
}
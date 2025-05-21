import { toast, ToastOptions } from 'react-toastify'
import { ReactNode } from 'react'
import {
  UseQueryOptions,
  UseMutationOptions,
  useQuery,
  useMutation,
  QueryFunction,
} from '@tanstack/react-query'
// import 'react-toastify/dist/ReactToastify.min.css' // we import it in _app.tsx

// USAGE:
//  const notify = useToast();
//  notify('error', 'Wallet not connected!');
//  notify('info', 'Airdrop requested:');
//  notify('warn', 'Airdrop requested:');
//  notify('success', 'Airdrop successful!',);
//  notify('error', `Airdrop failed! ${error?.message}`);
//  notify.promise(myPromise, {pending: 'Loading...', success: 'Success!', error: 'Error!'});

type ToastType = 'default' | 'success' | 'info' | 'warn' | 'error'

export const useToast = () => {
  const showToast = (
    type: ToastType,
    message: string | ReactNode,
    options?: ToastOptions
  ) => {
    // const position = toast. // adjust according to your needs
    const position = 'top-right'

    options = {
      autoClose: 10000, // 10 seconds
      ...options,
    }

    switch (type) {
      case 'success':
        toast.success(message, {
          position,
          ...options,
        })

        break

      case 'info':
        toast.info(message, {
          position,
          ...options,
        })

        break

      case 'warn':
        toast.warn(message, {
          position,
          ...options,
        })

        break

      case 'error':
        toast.error(message, {
          position,
          ...options,
        })

        break

      default:
        toast(message, {
          position,
          ...options,
        })

        break
    }
  }

  // Add promise support
  showToast.promise = <T>(
    promise: Promise<T>,
    messages: {
      pending: string
      success: string
      error: string | { render: (data: { data: any }) => string }
    },
    options?: ToastOptions
  ) => {
    const position = 'top-right'

    // Create a loading toast
    const toastId = toast.loading(messages.pending, {
      position,
      ...options,
    })

    // Handle the promise resolution
    promise
      .then((data) => {
        // Update with success message
        toast.update(toastId, {
          render: messages.success,
          type: 'success',
          isLoading: false,
          autoClose: 5000,
          ...options,
        })
        return data
      })
      .catch((error) => {
        // For errors, we'll dismiss this toast and create a new error toast
        // to avoid the generic "Error occurred" message
        toast.dismiss(toastId)

        // Create a custom error message that includes the actual error
        const errorMessage =
          typeof messages.error === 'string'
            ? `${messages.error}: ${error?.message || 'Unknown error'}`
            : messages.error.render({ data: error })

        // Show the detailed error message
        toast.error(errorMessage, {
          position,
          ...options,
        })

        throw error
      })

    return promise
  }

  return showToast
}

// NOTE: Handling promises
// https://fkhadra.github.io/react-toastify/promise
// https://blog.logrocket.com/using-react-toastify-style-toast-messages/
// const myPromise = new Promise((resolve) =>
//     fetch("https://jsonplaceholder.typicode.com/post")
//       .then((response) => response.json())
//       .then((json) => setTimeout(() => resolve(json), 3000))
//   );

//   useEffect(() => {
//     toast.promise(myPromise, {
//       pending: "Promise is pending",
//       success: "Promise  Loaded",
//       error: "error"
//     });
//   }, []);

// Toast messages type
type ToastMessages = {
  pending?: string
  success?: string
  error?: string
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
      // Execute the original queryFn
      try {
        const result = queryFn(context)
        // Ensure it's a promise
        const resultPromise = Promise.resolve(result)

        // Show toast if messages are provided and we're either not silencing refresh toasts
        // or if we're doing the initial fetch (isPending and no data)
        if (toastMessages && toastMessages.pending) {
          // Only show the toast if:
          // 1. We have a pending message AND
          // 2. Either:
          //    a. We're not silencing refreshes OR
          //    b. It's the initial load (no data exists yet)
          const isInitialLoad = !context.signal // Signal is undefined on initial load

          if (!silentRefresh || isInitialLoad) {
            notify.promise(resultPromise, {
              pending: toastMessages.pending || 'Loading...',
              success: toastMessages.success || 'Success!',
              error: toastMessages.error || 'An error occurred',
            })
          }
        }

        return result
      } catch (error) {
        // Handle synchronous errors
        if (toastMessages?.error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error'
          notify('error', `${toastMessages.error}: ${errorMsg}`)
        }
        throw error
      }
    },
  })
}

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

  return useMutation({
    ...mutationOptions,
    mutationFn: async (variables) => {
      try {
        // Execute the original mutationFn
        const resultPromise = mutationFn(variables)

        // Show toast if messages are provided
        if (toastMessages) {
          notify.promise(resultPromise, {
            pending: toastMessages.pending || 'Processing...',
            success: toastMessages.success || 'Success!',
            error: toastMessages.error || 'An error occurred',
          })
        }

        return resultPromise
      } catch (error) {
        // Handle synchronous errors
        if (toastMessages?.error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error'
          notify('error', `${toastMessages.error}: ${errorMsg}`)
        }
        throw error
      }
    },
  })
}

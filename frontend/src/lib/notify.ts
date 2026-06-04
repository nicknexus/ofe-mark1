import toast, { type ToastOptions } from 'react-hot-toast'

/**
 * Single funnel for user-facing toast notifications. Use this instead of
 * importing `react-hot-toast` directly so copy + behavior stay consistent.
 *
 * Copy rules (keep messages short, sentence case, no trailing period):
 * notify.success('Initiative created')
 * notify.error('Could not save changes')
 *
 * For async operations prefer `notify.promise` over manual loading/success/error.
 */
export const notify = {
 success: (message: string, opts?: ToastOptions) => toast.success(message, opts),
 error: (message: string, opts?: ToastOptions) => toast.error(message, opts),
 loading: (message: string, opts?: ToastOptions) => toast.loading(message, opts),
 dismiss: (id?: string) => toast.dismiss(id),
 /** Wire long-running actions to a single toast lifecycle. */
 promise: <T>(
 promise: Promise<T>,
 messages: { loading: string; success: string; error: string },
 opts?: ToastOptions,
 ) => toast.promise(promise, messages, opts),
}

export default notify

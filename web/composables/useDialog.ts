interface DialogState {
  open: boolean
  title: string
  message: string
  confirmText: string
  cancelText: string | null
  resolve?: (result: boolean) => void
}

export function useDialogState() {
  return useState<DialogState>('app-dialog', () => ({
    open: false,
    title: '',
    message: '',
    confirmText: 'OK',
    cancelText: null
  }))
}

export function useDialog() {
  const state = useDialogState()

  function show(opts: Partial<DialogState>): Promise<boolean> {
    return new Promise((resolve) => {
      state.value = {
        open: true,
        title: opts.title || '',
        message: opts.message || '',
        confirmText: opts.confirmText || 'OK',
        cancelText: opts.cancelText ?? null,
        resolve
      }
    })
  }

  return {
    /** Friendly replacement for alert() */
    notify: (message: string, title = 'Heads up') =>
      show({ message, title, confirmText: 'OK', cancelText: null }),
    /** Friendly replacement for confirm() — resolves true/false */
    confirm: (
      message: string,
      opts: { title?: string; confirmText?: string; cancelText?: string } = {}
    ) =>
      show({
        message,
        title: opts.title || 'Are you sure?',
        confirmText: opts.confirmText || 'Yes',
        cancelText: opts.cancelText || 'Cancel'
      })
  }
}

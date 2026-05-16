interface Window {
  TWIKEE_API_URL?: string
  twikee?: {
    init: (options: { el: string | Element; envId: string }) => void
    initAdmin: (options: { el: string | Element; envId: string }) => void
  }
}

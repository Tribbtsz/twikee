import { spawn } from 'child_process'
import { resolve } from 'path'

const rootDir = resolve(__dirname, '..')

console.log('🚀 Starting Twikee development server...\n')

const apiProcess = spawn('pnpm', ['dev'], {
  cwd: resolve(rootDir, 'packages/api'),
  stdio: 'inherit',
  shell: true
})

setTimeout(() => {
  const frontendProcess = spawn('pnpm', ['dev'], {
    cwd: resolve(rootDir, 'packages/frontend'),
    stdio: 'inherit',
    shell: true
  })

  frontendProcess.on('close', (code) => {
    apiProcess.kill()
    process.exit(code || 0)
  })
}, 2000)

apiProcess.on('close', (code) => {
  process.exit(code || 0)
})

process.on('SIGINT', () => {
  apiProcess.kill()
  process.exit(0)
})

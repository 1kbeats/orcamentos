import { readFile, readdir } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = new URL('../', import.meta.url)
const failures = []

async function filesUnder(directory) {
  const output = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === '.temp' || entry.name === 'node_modules') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) output.push(...await filesUnder(path))
    else output.push(path)
  }
  return output
}

function fail(message) {
  failures.push(message)
}

function display(path) {
  return relative(root.pathname.replace(/^\/([A-Za-z]:)/, '$1'), path).replaceAll('\\', '/')
}

const rootPath = root.pathname.replace(/^\/([A-Za-z]:)/, '$1')
const files = await filesUnder(rootPath)

for (const path of files.filter(path => extname(path) === '.js')) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' })
  if (result.status !== 0) fail(`JavaScript inválido: ${display(path)}\n${result.stderr}`)
}

for (const path of files.filter(path => extname(path) === '.json')) {
  try {
    JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    fail(`JSON inválido: ${display(path)} (${error.message})`)
  }
}

for (const path of files.filter(path => extname(path) === '.html')) {
  const source = await readFile(path, 'utf8')
  const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index)
  if (duplicates.length) fail(`IDs duplicados em ${display(path)}: ${[...new Set(duplicates)].join(', ')}`)
  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(source)) fail(`Script inline em ${display(path)}`)
  if (/\son[a-z]+=/i.test(source)) fail(`Evento inline em ${display(path)}`)
}

for (const path of files.filter(path => ['.html', '.js', '.ts'].includes(extname(path)))) {
  const source = await readFile(path, 'utf8')
  if (/sb_secret_[A-Za-z0-9_-]{20,}/.test(source)) fail(`Secret key encontrada em ${display(path)}`)
  if (/5521999999999/.test(source)) fail(`Telefone placeholder encontrado em ${display(path)}`)
  if (/[?&]n=/.test(source)) fail(`Link público enumerável encontrado em ${display(path)}`)

  for (const match of source.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'))
      if (payload.role && payload.role !== 'anon') {
        fail(`JWT privilegiado encontrado em ${display(path)}`)
      }
    } catch {
      fail(`JWT inválido encontrado em ${display(path)}`)
    }
  }
}

const serviceWorker = await readFile(join(rootPath, 'sw.js'), 'utf8')
const shellBlock = serviceWorker.match(/APP_SHELL\s*=\s*\[([\s\S]*?)\]/)?.[1] ?? ''
for (const match of shellBlock.matchAll(/['"](\.\/[^'"]+)['"]/g)) {
  const target = join(rootPath, match[1].slice(2))
  if (!files.includes(target) && match[1] !== './') fail(`Recurso offline ausente: ${match[1]}`)
}

if (failures.length) {
  console.error(failures.join('\n\n'))
  process.exit(1)
}

console.log(`Validação concluída: ${files.length} arquivos verificados.`)

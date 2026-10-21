// Build the setup zip and publish it as a GitHub release.
//
//   node scripts/publish.mjs             build + publish v<version>
//   node scripts/publish.mjs --dry-run   build only, print the gh command
//
// Requires the `gh` CLI, authenticated. The repo is private for now, so the
// release assets are only downloadable by people with access.

import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const NOTES = (tag) => [
  `Windows installer for subzer0 ${tag}.`,
  '',
  '- Unzip, run "subzer0 Setup.exe", then launch subzer0 from the Start menu.',
  '- If OpenCode is not running, the app starts its own background service.',
  '- No API keys: it uses the free models your local OpenCode already has.',
].join('\n')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const version = pkg.version || '0.1.0'
  const tag = `v${version}`
  const zip = path.join(ROOT, 'out', `subzer0-Setup-${version}-win-x64.zip`)

  console.log(`· building subzer0 ${tag}`)
  await run(process.execPath, [path.join(ROOT, 'scripts', 'build-setup.mjs'), '--zip'], {
    cwd: ROOT,
    stdio: 'inherit',
  })

  const args = ['release', 'create', tag, zip, '--title', `subzer0 ${tag}`, '--notes', NOTES(tag)]

  if (dryRun) {
    console.log('\n· dry run, would execute:\n  gh ' + args.join(' '))
    return
  }

  console.log(`· publishing ${tag}`)
  try {
    await run('gh', args, { cwd: ROOT, stdio: 'inherit' })
    console.log(`· released ${tag}`)
  } catch (error) {
    if (String(error.stderr || '').includes('already exists')) {
      console.log(`· ${tag} already exists — uploading the asset instead`)
      await run('gh', ['release', 'upload', tag, zip, '--clobber'], { cwd: ROOT, stdio: 'inherit' })
      console.log(`· updated ${tag}`)
    } else {
      throw error
    }
  }
}

main().catch((error) => {
  console.error('publish failed:', error.message)
  process.exit(1)
})

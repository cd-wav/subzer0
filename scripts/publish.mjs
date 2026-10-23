// Build the setup zip and publish it as a GitHub release.
//
//   node scripts/publish.mjs             build + publish v<version>
//   node scripts/publish.mjs --dry-run   build only, print the gh command
//
// Requires the `gh` CLI, authenticated. The repo is private for now, so the
// release assets are only downloadable by people with access.

import { execFile } from 'node:child_process'
import { copyFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const NOTES = (tag) => [
  `**subzer0 ${tag}** — an ai app that rewrites itself.`,
  '',
  'open it and you get a quiet, dark chat window. tell the ai what you want — a',
  'sidebar, a terminal look, purple — and it edits the app you are looking at. the',
  'window reloads and the change is there. the whole ui is three plain files, and',
  'the ai can rewrite any of them.',
  '',
  'what is inside',
  '',
  '- no api keys, no model downloads: it drives your local [opencode](https://opencode.ai)',
  '  and uses every model it can see — free, opencode go, or metered',
  '- 12 languages, dark / light / system, markdown replies and interactive polls',
  '- fast self-updates: only changed files are downloaded, usually a couple of seconds',
  '- everything is lowercase, flat and monochrome, on purpose',
  '',
  'install',
  '',
  '1. download `subzer0-Setup-' + tag.replace(/^v/, '') + '-win-x64.zip` and unzip it',
  '2. run `subzer0 Setup.exe`',
  '3. launch subzer0 from the start menu',
  '',
  'no opencode running? the app starts its own background service. it also',
  'updates itself when a newer release lands.',
  '',
  'built with ai, argued over by a human. see the readme for the honest version.',
].join('\n')

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  const version = pkg.version || '0.1.0'
  const tag = `v${version}`
  const zip = path.join(ROOT, 'out', `subzer0-Setup-${version}-win-x64.zip`)
  // The bare exe rides along for the in-app updater, which downloads this
  // exact name (see electron/update.js).
  const exeAsset = path.join(ROOT, 'out', `subzer0-Setup-${version}-win-x64.exe`)
  // The slim app archive + its manifest drive the fast in-place update.
  const appZip = path.join(ROOT, 'out', `subzer0-app-${version}.zip`)
  const appJson = path.join(ROOT, 'out', `subzer0-app-${version}.json`)

  console.log(`· building subzer0 ${tag}`)
  await run(process.execPath, [path.join(ROOT, 'scripts', 'build-setup.mjs'), '--zip'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  await copyFile(path.join(ROOT, 'out', 'setup', 'subzer0 Setup.exe'), exeAsset)
  console.log(`  ${exeAsset}`)

  const args = ['release', 'create', tag, zip, exeAsset, appZip, appJson, '--title', `subzer0 ${tag}`, '--notes', NOTES(tag)]

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
      console.log(`· ${tag} already exists — uploading the assets instead`)
      await run('gh', ['release', 'upload', tag, zip, exeAsset, appZip, appJson, '--clobber'], { cwd: ROOT, stdio: 'inherit' })
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

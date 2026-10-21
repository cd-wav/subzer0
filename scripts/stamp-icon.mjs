// Stamps the subzer0 icon and version info onto a Windows executable.
//
//   node scripts/stamp-icon.mjs "out/setup/subzer0 Setup.exe" 0.1.0
//
// Pure JS (resedit), no rcedit binary. Unsigned afterwards, which is fine for a
// locally built installer.

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { NtExecutable, NtExecutableResource, Resource, Data } from 'resedit'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ICON = path.join(ROOT, 'assets', 'subzer0.ico')

function fixedVersion(version) {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10) || 0)
  const [major = 0, minor = 0, patch = 0, build = 0] = parts
  return {
    fileVersionMS: (major << 16) | minor,
    fileVersionLS: (patch << 16) | build,
    productVersionMS: (major << 16) | minor,
    productVersionLS: (patch << 16) | build,
  }
}

export async function stamp(exePath, version = '0.1.0') {
  const exe = NtExecutable.from(await readFile(exePath), { ignoreCert: true })
  const resources = NtExecutableResource.from(exe)

  const iconFile = Data.IconFile.from(await readFile(ICON))
  Resource.IconGroupEntry.replaceIconsForResource(
    resources.entries,
    1,
    1033,
    iconFile.icons.map((icon) => icon.data)
  )

  const [info] = Resource.VersionInfo.fromEntries(resources.entries)
  if (info) {
    Object.assign(info.fixedInfo, fixedVersion(version))
    info.setStringValues(
      { lang: 1033, codepage: 1200 },
      {
        CompanyName: 'subzer0',
        FileDescription: 'subzer0',
        FileVersion: version,
        InternalName: 'subzer0',
        LegalCopyright: 'MIT License',
        OriginalFilename: path.basename(exePath),
        ProductName: 'subzer0',
        ProductVersion: version,
      }
    )
    info.outputToResourceEntries(resources.entries)
  }

  resources.outputResource(exe)
  await writeFile(exePath, Buffer.from(exe.generate()))
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2]
  if (!target) {
    console.error('usage: node scripts/stamp-icon.mjs <exe> [version]')
    process.exit(1)
  }
  await stamp(path.resolve(target), process.argv[3] || '0.1.0')
  console.log(`stamped: ${target}`)
}

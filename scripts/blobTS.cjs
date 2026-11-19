#!/usr/bin/env node
// Exports every ts and tsx file as a single file for debugging purposes.
// Not part of the normal build and/or test pathway. Leave this file be.

const fs = require('fs')
const path = require('path')

const outputFile = process.argv[2] || 'export_.ts.tsx.tsx'
const root = path.resolve('../')
const skipDirs = new Set(['node_modules', 'build', 'public'])

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!skipDirs.has(entry.name)) walk(fullPath, results)
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name)) {
      results.push(fullPath)
    }
  }
  return results
}

const files = walk(root).sort()

const output = files
  .map((file) => {
    const displayPath = `/${path.relative(process.cwd(), file).split(path.sep).join('/')}`
    const content = fs.readFileSync(file, 'utf8')
    const separator = content.endsWith('\n') ? '' : '\n'
    return `### File: ${displayPath}\n${content}${separator}`
  })
  .join('')

fs.writeFileSync(outputFile, output)
console.log(`Wrote ${files.length} files to ${outputFile}`)

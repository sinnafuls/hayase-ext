import esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

const config = {
  entryPoints: {
    index: 'src/index.ts',
    nyaa: 'src/nyaa.ts'
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  outdir: '.',
  minify: !watch,
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'info'
}

if (watch) {
  const ctx = await esbuild.context(config)
  await ctx.watch()
  console.log('watching src/ — index.js and nyaa.js will rebuild on save')
} else {
  await esbuild.build(config)
}

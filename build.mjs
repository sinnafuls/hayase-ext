import esbuild from 'esbuild'

const watch = process.argv.includes('--watch')

const config = {
  entryPoints: {
    nzbgeek: 'src/nzbgeek.ts',
    althub: 'src/althub.ts',
    animetosho: 'src/animetosho.ts',
    nyaa: 'src/nyaa.ts',
    nekobt: 'src/nekobt.js',
    seadex: 'src/seadex.js',
    'animetosho-torrent': 'src/animetosho-torrent.js'
  },
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  outdir: 'dist',
  minify: !watch,
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'info'
}

if (watch) {
  const ctx = await esbuild.context(config)
  await ctx.watch()
  console.log('watching src/ — dist/*.js will rebuild on save')
} else {
  await esbuild.build(config)
}

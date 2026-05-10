import { createNewznabExtension } from './newznab-extension.js'

export default createNewznabExtension({
  base: 'https://api.nzbgeek.info',
  animeCat: '5070',
  movieCats: '2000,2020,2030,2040,2045,2050,2060',
  serviceName: 'NZBGeek'
})

export const initialMapZoom = 2
export const initialMapCenter = [10, 0]

export const baseMap = {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>'
}

export const schemaUrl = 
    'https://raw.githubusercontent.com/covjson/playground/letmaik/2021/src/covjson.schema.json'

const relUrl = basename => `coverages/${basename}.covjson`
export const examples = [{
  title: 'Grid',
  url: relUrl('grid')
}, {
  title: 'Grid (Categorical)',
  url: relUrl('grid-categorical')
}, {
  title: 'Grid (Tiled)',
  url: relUrl('grid-tiled')
}, {
  title: 'Trajectory',
  url: relUrl('trajectory')
}, {
  title: 'Profile',
  url: relUrl('profile')
}, {
  title: 'PointSeries',
  url: relUrl('pointseries')
}, {
  title: 'Point',
  url: relUrl('point')
}, {
  title: 'Point Collection',
  url: relUrl('point-collection')
}, {
  title: 'Profile Collection',
  url: relUrl('profile-collection')
}, {
  title: 'MultiPolygon',
  url: relUrl('multipolygon')
}, {
  title: 'PolygonSeries',
  url: relUrl('polygonseries')
}, {
  title: 'Grid (Domain)',
  url: relUrl('grid-domain')
}, {
  title: 'Grid BNG (Domain)',
  url: relUrl('grid-domain-bng')
}]

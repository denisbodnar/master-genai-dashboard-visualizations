// SYNC WITH server/src/modules/chartSelector/constants.js

export const SUPPORTED_CHART_TYPES = Object.freeze([
  'bar',
  'grouped-bar',
  'line',
  'multiline',
  'scatter',
  'scatter-color',
  'pie',
  'heatmap',
]);

export const CHART_TYPE_LABELS = Object.freeze({
  'bar':           'Bar chart',
  'grouped-bar':   'Grouped bar chart',
  'line':          'Line chart',
  'multiline':     'Multi-line chart',
  'scatter':       'Scatter plot',
  'scatter-color': 'Scatter plot (color-encoded)',
  'pie':           'Pie chart',
  'heatmap':       'Heatmap',
});
